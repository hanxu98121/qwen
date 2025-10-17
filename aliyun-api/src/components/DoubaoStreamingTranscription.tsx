'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Square, Play, Text, AlertCircle } from 'lucide-react'

interface DoubaoStreamingTranscriptionProps {
  appKey: string
  accessKey: string
  audioFile: File | null
  audioUrl: string
  context: string
  enableItn: boolean
  language: string
  onResult: (result: string) => void
  onComplete: (finalResult: string, language?: string, confidence?: number) => void
  onError: (error: string) => void
}

export default function DoubaoStreamingTranscription({
  appKey,
  accessKey,
  audioFile,
  audioUrl,
  context,
  enableItn,
  language,
  onResult,
  onComplete,
  onError
}: DoubaoStreamingTranscriptionProps) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentText, setCurrentText] = useState('')
  const [status, setStatus] = useState('准备就绪')
  const eventSourceRef = useRef<EventSource | null>(null)

  const startStreaming = async () => {
    if (!appKey.trim() || !accessKey.trim()) {
      onError('请输入豆包API的 app_key 和 access_key')
      return
    }

    if (!audioFile && !audioUrl.trim()) {
      onError('请选择音频文件或输入音频 URL')
      return
    }

    setIsStreaming(true)
    setCurrentText('')
    setStatus('正在连接豆包API...')

    try {
      // Prepare the request data
      const requestData: any = {
        appKey: appKey.trim(),
        accessKey: accessKey.trim(),
        context,
        enableItn,
        language,
        stream: true
      }

      if (audioFile) {
        // For file upload, we need to use FormData
        const formData = new FormData()
        formData.append('appKey', appKey.trim())
        formData.append('accessKey', accessKey.trim())
        formData.append('audio', audioFile)
        formData.append('context', context)
        formData.append('enableItn', enableItn.toString())
        if (language) formData.append('language', language)

        const response = await fetch('/api/doubao/stream', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        if (!response.body) {
          throw new Error('No response body')
        }

        setStatus('正在转录...')
        await handleDoubaoStreamResponse(response)

      } else {
        // For URL, use JSON
        requestData.audioUrl = audioUrl.trim()

        const response = await fetch('/api/doubao/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData)
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        if (!response.body) {
          throw new Error('No response body')
        }

        setStatus('正在转录...')
        await handleDoubaoStreamResponse(response)
      }

    } catch (error) {
      console.error('Doubao streaming error:', error)
      onError(error instanceof Error ? error.message : '豆包流式转录失败')
      setIsStreaming(false)
      setStatus('错误')
    }
  }

  const handleDoubaoStreamResponse = async (response: Response) => {
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    if (!reader) {
      throw new Error('No stream reader available')
    }

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          setStatus('转录完成')
          setIsStreaming(false)
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep the incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = line.slice(6) // Remove 'data: ' prefix
              if (data.trim()) {
                const parsed = JSON.parse(data)

                // Handle different message types
                if (parsed.type === 'start') {
                  setStatus(parsed.message || '正在连接...')
                } else if (parsed.type === 'connected') {
                  setStatus(parsed.message || '连接成功')
                } else if (parsed.type === 'text') {
                  // New text chunk received
                  setCurrentText(parsed.text)
                  onResult(parsed.text)
                } else if (parsed.type === 'complete') {
                  // Stream completed
                  setIsStreaming(false)
                  setStatus('转录完成')
                  onComplete(parsed.text, parsed.language, parsed.confidence)
                } else if (parsed.type === 'error') {
                  // Error occurred
                  throw new Error(parsed.error || 'Stream error')
                }
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError)
              // Don't throw on parse errors, continue processing
            }
          }
        }
      }
    } catch (error) {
      console.error('Doubao stream processing error:', error)
      onError(error instanceof Error ? error.message : '豆包流式处理失败')
      setIsStreaming(false)
      setStatus('错误')
    }
  }

  const stopStreaming = () => {
    setIsStreaming(false)
    setStatus('已停止')
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Text className="w-5 h-5" />
          豆包流式转录
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <Badge variant={isStreaming ? "default" : "secondary"}>
              {status}
            </Badge>
            {isStreaming && (
              <Badge variant="outline" className="animate-pulse">
                实时转录中
              </Badge>
            )}
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            {!isStreaming ? (
              <Button onClick={startStreaming} className="flex items-center gap-2">
                <Play className="w-4 h-4" />
                开始豆包流式转录
              </Button>
            ) : (
              <Button onClick={stopStreaming} variant="destructive" className="flex items-center gap-2">
                <Square className="w-4 h-4" />
                停止转录
              </Button>
            )}
          </div>

          {/* Real-time transcription display */}
          {currentText && (
            <div>
              <label className="text-sm font-medium mb-2 block">实时转录结果</label>
              <div className="bg-gray-50 border rounded-lg p-4 min-h-[100px] max-h-[200px] overflow-y-auto">
                <p className="text-gray-900 whitespace-pre-wrap">{currentText}</p>
              </div>
            </div>
          )}

          {/* Streaming info */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>豆包流式转录说明：</strong>
              基于WebSocket的实时语音识别，提供低延迟的转录体验。
              系统会实时返回中间结果，最终结果由完整音频处理生成。
              {enableItn && ' ITN 功能在豆包流式模式下同样有效。'}
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  )
}