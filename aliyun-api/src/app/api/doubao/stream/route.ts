import { NextRequest } from 'next/server'
import { createDoubaoClient, DoubaoConfig } from '@/lib/doubao-client'
import { DoubaoUtils } from '@/lib/doubao-utils'
import fs from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null

  try {
    // 处理CORS预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      })
    }

    // 解析表单数据或JSON
    let appKey: string
    let accessKey: string
    let audioFile: File | null = null
    let audioUrl = ''
    let enableItn = false
    let language = ''

    const contentType = request.headers.get('content-type')

    if (contentType && contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      appKey = formData.get('appKey') as string || formData.get('appkey') as string
      accessKey = formData.get('accessKey') as string || formData.get('accesskey') as string
      audioFile = formData.get('audio') as File | null
      audioUrl = formData.get('audioUrl') as string || formData.get('audiourl') as string || ''
      enableItn = formData.get('enableItn') === 'true'
      language = formData.get('language') as string || ''
    } else {
      // 处理JSON请求
      const body = await request.json()
      appKey = body.appKey || body.appkey
      accessKey = body.accessKey || body.accesskey
      audioUrl = body.audioUrl || body.audiourl || ''
      enableItn = body.enableItn || false
      language = body.language || ''
    }

    if (!appKey || !accessKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'appKey 和 accessKey 都是必需的'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        }
      })
    }

    if (!audioFile && !audioUrl) {
      return new Response(JSON.stringify({
        success: false,
        error: '需要提供音频文件或音频URL'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        }
      })
    }

    // 验证配置
    const config: DoubaoConfig = {
      app_key: appKey.trim(),
      access_key: accessKey.trim()
    }

    const validation = DoubaoUtils.validateConfig(config)
    if (!validation.isValid) {
      return new Response(JSON.stringify({
        success: false,
        error: validation.error
      }), {
        status: 400,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        }
      })
    }

    console.log('Starting Doubao streaming transcription...')
    console.log('App Key provided:', appKey ? 'Yes' : 'No')
    console.log('Access Key provided:', accessKey ? 'Yes' : 'No')
    console.log('Audio file:', audioFile ? audioFile.name : 'None')
    console.log('Audio URL:', audioUrl || 'None')
    console.log('Enable ITN:', enableItn)
    console.log('Language:', language || 'Auto-detect')

    let audioData: Buffer

    if (audioFile) {
      // 处理本地音频文件
      const tempDir = await DoubaoUtils.ensureTempDir()
      tempFilePath = path.join(tempDir, `stream_${Date.now()}_${audioFile.name}`)

      // 保存上传的文件
      const buffer = Buffer.from(await audioFile.arrayBuffer())
      await fs.writeFile(tempFilePath, buffer)

      console.log('Processing audio file for streaming:', tempFilePath)
      audioData = await DoubaoUtils.processAudioFile(tempFilePath)

    } else {
      // 处理远程音频URL - 先下载
      console.log('Downloading audio from URL:', audioUrl)
      audioData = await DoubaoUtils.downloadAudioFromUrl(audioUrl)
    }

    // 创建一个自定义的ReadableStream用于SSE
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 发送开始信号
          const startMessage = {
            type: 'start',
            message: '开始连接豆包API...'
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(startMessage)}\n\n`))

          // 创建豆包客户端
          const client = createDoubaoClient({
            url: 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel',
            config: config,
            segmentDuration: 200
          })

          console.log('Connecting to Doubao WebSocket for streaming...')
          await client.connect()

          // 发送连接成功信号
          const connectedMessage = {
            type: 'connected',
            message: '已连接，开始转录...'
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(connectedMessage)}\n\n`))

          let accumulatedText = ''

          try {
            // 开始流式转录
            for await (const response of client.startStreaming(audioData)) {
              console.log('Received streaming response:', response.toDict())

              // 提取文本结果
              const text = DoubaoUtils.extractTextFromResponse(response.toDict())

              if (text) {
                // 如果文本有变化，发送更新
                if (text !== accumulatedText) {
                  accumulatedText = text

                  const textMessage = {
                    type: 'text',
                    text: text,
                    done: false
                  }
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(textMessage)}\n\n`))
                }
              }

              // 如果是最后一个包，发送完成信号
              if (response.isLastPackage) {
                console.log('Streaming transcription complete')

                const finalLanguage = DoubaoUtils.extractLanguageFromResponse(response.toDict())
                const finalConfidence = DoubaoUtils.extractConfidenceFromResponse(response.toDict())

                const completeMessage = {
                  type: 'complete',
                  text: accumulatedText,
                  language: finalLanguage,
                  confidence: finalConfidence,
                  done: true
                }
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(completeMessage)}\n\n`))
                break
              }
            }

          } finally {
            client.close()
          }

        } catch (error) {
          console.error('Streaming transcription error:', error)

          const errorMessage = {
            type: 'error',
            error: DoubaoUtils.formatError(error),
            done: true
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorMessage)}\n\n`))
        } finally {
          // 清理临时文件
          if (tempFilePath) {
            await DoubaoUtils.cleanupTempFile(tempFilePath)
          }
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      }
    })

  } catch (error) {
    console.error('Doubao streaming setup error:', error)

    // 清理临时文件
    if (tempFilePath) {
      await DoubaoUtils.cleanupTempFile(tempFilePath)
    }

    const errorMessage = {
      type: 'error',
      error: DoubaoUtils.formatError(error),
      done: true
    }

    return new Response(`data: ${JSON.stringify(errorMessage)}\n\n`, {
      status: 500,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      }
    })
  }
}