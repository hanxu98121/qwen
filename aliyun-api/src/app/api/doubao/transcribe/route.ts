import { NextRequest, NextResponse } from 'next/server'
import { createDoubaoClient, DoubaoConfig } from '@/lib/doubao-client'
import { DoubaoUtils } from '@/lib/doubao-utils'
import fs from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null

  try {
    // 处理CORS预检请求
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      })
    }

    // 解析表单数据
    const formData = await request.formData()
    const appKey = formData.get('appKey') as string || formData.get('appkey') as string
    const accessKey = formData.get('accessKey') as string || formData.get('accesskey') as string
    const audioFile = formData.get('audio') as File | null
    const audioUrl = formData.get('audioUrl') as string || formData.get('audiourl') as string

    if (!appKey || !accessKey) {
      return NextResponse.json(
        { success: false, error: 'appKey 和 accessKey 都是必需的' },
        { status: 400 }
      )
    }

    if (!audioFile && !audioUrl) {
      return NextResponse.json(
        { success: false, error: '需要提供音频文件或音频URL' },
        { status: 400 }
      )
    }

    // 验证配置
    const config: DoubaoConfig = {
      app_key: appKey.trim(),
      access_key: accessKey.trim()
    }

    const validation = DoubaoUtils.validateConfig(config)
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }

    console.log('Starting Doubao transcription process...')
    console.log('App Key provided:', appKey ? 'Yes' : 'No')
    console.log('Access Key provided:', accessKey ? 'Yes' : 'No')
    console.log('Audio file:', audioFile ? audioFile.name : 'None')
    console.log('Audio URL:', audioUrl || 'None')

    let audioData: Buffer

    if (audioFile) {
      // 处理本地音频文件
      const tempDir = await DoubaoUtils.ensureTempDir()
      tempFilePath = path.join(tempDir, `upload_${Date.now()}_${audioFile.name}`)

      // 保存上传的文件
      const buffer = Buffer.from(await audioFile.arrayBuffer())
      await fs.writeFile(tempFilePath, buffer)

      console.log('Processing audio file:', tempFilePath)
      audioData = await DoubaoUtils.processAudioFile(tempFilePath)

    } else {
      // 处理远程音频URL - 先下载
      console.log('Downloading audio from URL:', audioUrl)
      audioData = await DoubaoUtils.downloadAudioFromUrl(audioUrl)
    }

    // 创建豆包客户端
    const client = createDoubaoClient({
      url: 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream',
      config: config,
      segmentDuration: 200
    })

    console.log('Connecting to Doubao WebSocket...')
    await client.connect()

    console.log('Starting transcription streaming...')
    let finalText = ''
    let finalLanguage: string | undefined
    let finalConfidence: number | undefined

    try {
      // 开始流式转录
      for await (const response of client.startStreaming(audioData)) {
        console.log('Received response:', response.toDict())

        // 提取文本结果
        const text = DoubaoUtils.extractTextFromResponse(response.toDict())
        if (text) {
          finalText = text // 最后一个响应包含完整结果
        }

        // 提取语言信息
        const language = DoubaoUtils.extractLanguageFromResponse(response.toDict())
        if (language) {
          finalLanguage = language
        }

        // 提取置信度
        const confidence = DoubaoUtils.extractConfidenceFromResponse(response.toDict())
        if (confidence !== undefined) {
          finalConfidence = confidence
        }

        // 如果是最后一个包，结束处理
        if (response.isLastPackage) {
          console.log('Received final package, transcription complete')
          break
        }
      }

    } finally {
      client.close()
    }

    // 返回结果
    const result = {
      success: true,
      data: {
        text: finalText || '无法识别音频内容',
        language: finalLanguage,
        confidence: finalConfidence,
        provider: 'doubao'
      }
    }

    console.log('Transcription completed successfully:', result)
    return NextResponse.json(result, {
      headers: {
        'Access-Control-Allow-Origin': '*',
      }
    })

  } catch (error) {
    console.error('Doubao transcription error:', error)

    const errorMessage = DoubaoUtils.formatError(error)

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: error instanceof Error ? error.stack : error.toString(),
        provider: 'doubao'
      },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    )

  } finally {
    // 清理临时文件
    if (tempFilePath) {
      await DoubaoUtils.cleanupTempFile(tempFilePath)
    }
  }
}