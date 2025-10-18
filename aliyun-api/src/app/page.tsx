'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, FileText, Key, Loader2, Globe, Code, Zap, Text, Mic } from 'lucide-react'
import APIDocumentation from '@/components/APIDocumentation'
import StreamingTranscription from '@/components/StreamingTranscription'
import APISelector, { APIProvider } from '@/components/APISelector'
import DoubaoStreamingTranscription from '@/components/DoubaoStreamingTranscription'
import VoiceRecorder from '@/components/VoiceRecorder'

interface TranscriptionResult {
  text: string
  language?: string
  confidence?: number
}

export default function Home() {
  const [baseUrl, setBaseUrl] = useState('')
  const [apiProvider, setApiProvider] = useState<APIProvider>('doubao') // 默认选择豆包
  const [apiKey, setApiKey] = useState('')
  const [appKey, setAppKey] = useState('') // 预填豆包App Key
  const [accessKey, setAccessKey] = useState('') // 预填豆包Access Key
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [audioUrl, setAudioUrl] = useState('')
  const [audioInputMethod, setAudioInputMethod] = useState<'file' | 'url' | 'record'>('file')
  const [context, setContext] = useState('')
  const [enableItn, setEnableItn] = useState(false)
  const [language, setLanguage] = useState('auto')  // 改为 'auto' 而不是空字符串
  const [stream, setStream] = useState(false)
  const [autoTranscribe, setAutoTranscribe] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [result, setResult] = useState<TranscriptionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [isStreaming, setIsStreaming] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Set baseUrl and load saved credentials on client side only
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin)

      // Load saved API credentials from localStorage
      const savedProvider = localStorage.getItem('apiProvider') as APIProvider || 'doubao'
      const savedApiKey = localStorage.getItem('apiKey') || ''
      const savedAppKey = localStorage.getItem('appKey') || ''
      const savedAccessKey = localStorage.getItem('accessKey') || ''

      setApiProvider(savedProvider)
      setApiKey(savedApiKey)
      setAppKey(savedAppKey)
      setAccessKey(savedAccessKey)
    }
  }, [])

  // Save API credentials to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('apiProvider', apiProvider)
    }
  }, [apiProvider])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('apiKey', apiKey)
    }
  }, [apiKey])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('appKey', appKey)
    }
  }, [appKey])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessKey', accessKey)
    }
  }, [accessKey])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        setError('音频文件大小不能超过 10MB')
        return
      }

      // Check file type
      const allowedTypes = [
        'audio/aac', 'audio/amr', 'video/avi', 'audio/aiff', 'audio/flac', 'video/x-flv',
        'audio/mp4', 'video/x-matroska', 'audio/mpeg', 'audio/ogg', 'audio/opus',
        'audio/wav', 'video/webm', 'audio/x-ms-wma', 'video/x-ms-wmv'
      ]

      if (!allowedTypes.includes(file.type) && !file.name.match(/\.(aac|amr|avi|aiff|flac|flv|m4a|mkv|mp3|mp4|mpeg|ogg|opus|wav|webm|wma|wmv)$/i)) {
        setError('不支持的音频格式')
        return
      }

      setAudioFile(file)
      setAudioUrl('')
      setError(null)
    }
  }

  const handleRecordingComplete = (file: File) => {
    setAudioFile(file)
    setAudioUrl('')
    setError(null)
    // Keep on record tab, don't switch to file tab
    // setAudioInputMethod('file') // Removed this line to stay on record tab

    // Auto start transcription if autoTranscribe is enabled
    if (autoTranscribe && hasValidCredentials()) {
      setTimeout(() => {
        handleTranscribe()
      }, 500) // Small delay to ensure file is properly set
    }
  }

  const handleRecordingError = (error: string) => {
    setError(error)
  }

  const handleStreamingResult = (text: string) => {
    setStreamingText(text)
  }

  const handleStreamingComplete = (finalResult: string, language?: string, confidence?: number) => {
    setStreamingText('')
    setIsStreaming(false)
    setResult({
      text: finalResult,
      language,
      confidence
    })
  }

  const handleStreamingError = (error: string) => {
    setError(error)
    setStreamingText('')
    setIsStreaming(false)
  }

  const handleTranscribe = async () => {
    // 验证认证信息
    if (apiProvider === 'qwen') {
      if (!apiKey.trim()) {
        setError('请输入阿里云 API Key')
        return
      }
    } else {
      if (!appKey.trim() || !accessKey.trim()) {
        setError('请输入豆包API的 app_key 和 access_key')
        return
      }
    }

    if (!audioFile && !audioUrl.trim()) {
      setError('请选择音频文件、输入音频 URL 或录制音频')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setProgress(0)

    try {
      let apiUrl = ''
      const formData = new FormData()

      if (apiProvider === 'qwen') {
        apiUrl = '/api/transcribe'
        formData.append('apiKey', apiKey.trim())
      } else {
        apiUrl = '/api/doubao/transcribe'
        formData.append('appKey', appKey.trim())
        formData.append('accessKey', accessKey.trim())
      }

      if (audioFile) {
        formData.append('audio', audioFile)
      } else {
        formData.append('audioUrl', audioUrl.trim())
      }

      if (context.trim()) {
        formData.append('context', context.trim())
      }
      formData.append('enableItn', enableItn.toString())
      if (language && language !== 'auto') {
        formData.append('language', language.trim())
      }
      formData.append('stream', stream.toString())

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setProgress(100)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '转录失败')
      }

      const data = await response.json()

      if (data.success) {
        setResult(data.data)
      } else {
        throw new Error(data.error || '转录失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '转录失败')
    } finally {
      setLoading(false)
      setTimeout(() => setProgress(0), 1000)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('audio/')) {
      if (file.size > 10 * 1024 * 1024) {
        setError('音频文件大小不能超过 10MB')
        return
      }
      setAudioFile(file)
      setAudioUrl('')
      setError(null)
      setAudioInputMethod('file')
    }
  }

  const hasValidCredentials = () => {
    if (apiProvider === 'qwen') {
      return apiKey.trim() !== ''
    } else {
      return appKey.trim() !== '' && accessKey.trim() !== ''
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto p-4">
        <div className="text-center py-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            智能语音识别 API 服务器
          </h1>
          <p className="text-lg text-gray-600">
            支持阿里云通义千问和字节跳动豆包的音频转录服务，提供完整的 API 文档和代理接口
          </p>
        </div>

        <Tabs defaultValue="demo" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto mb-8">
            <TabsTrigger value="demo" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              在线演示
            </TabsTrigger>
            <TabsTrigger value="api" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              API 文档
            </TabsTrigger>
            <TabsTrigger value="proxy" className="flex items-center gap-2">
              <Code className="w-4 h-4" />
              代理信息
            </TabsTrigger>
          </TabsList>

          <TabsContent value="demo" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  API 配置
                </CardTitle>
                <CardDescription>
                  选择API提供商并配置相应的认证信息
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* API Provider Selector */}
                  <APISelector
                    value={apiProvider}
                    onChange={setApiProvider}
                    disabled={loading || isStreaming}
                  />

                  {/* Dynamic Auth Fields */}
                  {apiProvider === 'qwen' ? (
                    <div>
                      <Label htmlFor="apiKey">阿里云 API Key</Label>
                      <Input
                        id="apiKey"
                        type="password"
                        placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="mt-1"
                        disabled={loading || isStreaming}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        从阿里云百炼平台获取的API Key
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="appKey">豆包 App Key</Label>
                        <Input
                          id="appKey"
                          type="text"
                          placeholder="请输入豆包应用的App Key"
                          value={appKey}
                          onChange={(e) => setAppKey(e.target.value)}
                          className="mt-1"
                          disabled={loading || isStreaming}
                        />
                      </div>
                      <div>
                        <Label htmlFor="accessKey">豆包 Access Key</Label>
                        <Input
                          id="accessKey"
                          type="text"
                          placeholder="请输入豆包应用的Access Key"
                          value={accessKey}
                          onChange={(e) => setAccessKey(e.target.value)}
                          className="mt-1"
                          disabled={loading || isStreaming}
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        从字节跳动控制台获取的应用认证信息
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  音频输入
                </CardTitle>
                <CardDescription>
                  支持本地文件上传、在线URL或直接录制音频，文件大小不超过 10MB，时长不超过 3 分钟
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={audioInputMethod} onValueChange={(value: 'file' | 'url' | 'record') => setAudioInputMethod(value)} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="file" className="flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      文件上传
                    </TabsTrigger>
                    <TabsTrigger value="url" className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      在线URL
                    </TabsTrigger>
                    <TabsTrigger value="record" className="flex items-center gap-2">
                      <Mic className="w-4 h-4" />
                      语音录制
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="file" className="space-y-4">
                    <div>
                      <Label>音频文件</Label>
                      <div
                        className="mt-1 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="audio/*,.aac,.amr,.avi,.aiff,.flac,.flv,.m4a,.mkv,.mp3,.mp4,.mpeg,.ogg,.opus,.wav,.webm,.wma,.wmv"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                          点击或拖拽音频文件到此处
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          支持：aac, amr, avi, aiff, flac, flv, m4a, mkv, mp3, mp4, mpeg, ogg, opus, wav, webm, wma, wmv
                        </p>
                        {audioFile && (
                          <p className="text-sm text-green-600 mt-2">
                            已选择：{audioFile.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="url" className="space-y-4">
                    <div>
                      <Label htmlFor="audioUrl">音频 URL</Label>
                      <Input
                        id="audioUrl"
                        placeholder="https://example.com/audio.mp3"
                        value={audioUrl}
                        onChange={(e) => {
                          setAudioUrl(e.target.value)
                          setAudioFile(null)
                        }}
                        className="mt-1"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="record" className="space-y-4">
                    <VoiceRecorder
                      onRecordingComplete={handleRecordingComplete}
                      onError={handleRecordingError}
                      disabled={loading || isStreaming}
                      autoTranscribe={autoTranscribe}
                      onAutoTranscribeChange={setAutoTranscribe}
                    />
                  </TabsContent>
                </Tabs>

                {/* Context */}
                <div>
                  <Label htmlFor="context">上下文增强（可选）</Label>
                  <Textarea
                    id="context"
                    placeholder="输入相关词汇或文本，可以提高识别准确率"
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    className="mt-1"
                    rows={3}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    可以输入热词列表、相关文本段落等，不超过 10000 Token
                  </p>
                </div>

                {/* ITN and Language Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="itn"
                      checked={enableItn}
                      onCheckedChange={setEnableItn}
                    />
                    <Label htmlFor="itn" className="text-sm">
                      启用逆文本规范化 (ITN)
                    </Label>
                  </div>
                  <div>
                    <Label htmlFor="language">识别语言（可选）</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="自动检测" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">自动检测</SelectItem>
                        <SelectItem value="zh">中文</SelectItem>
                        <SelectItem value="en">英文</SelectItem>
                        <SelectItem value="ja">日语</SelectItem>
                        <SelectItem value="de">德语</SelectItem>
                        <SelectItem value="ko">韩语</SelectItem>
                        <SelectItem value="ru">俄语</SelectItem>
                        <SelectItem value="fr">法语</SelectItem>
                        <SelectItem value="pt">葡萄牙语</SelectItem>
                        <SelectItem value="ar">阿拉伯语</SelectItem>
                        <SelectItem value="it">意大利语</SelectItem>
                        <SelectItem value="es">西班牙语</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Streaming Option */}
                <div className="flex items-center space-x-2">
                  <Switch
                    id="stream"
                    checked={stream}
                    onCheckedChange={setStream}
                  />
                  <Label htmlFor="stream" className="text-sm">
                    启用流式输出 (实时转录)
                  </Label>
                </div>

                {enableItn && (
                  <Alert>
                    <AlertDescription>
                      <strong>ITN 功能说明：</strong>启用逆文本规范化后，系统会将口语化的数字表达转换为标准格式，
                      例如"一百二十三"转换为"123"，"二零二四年"转换为"2024年"等。
                      目前仅支持中文和英文音频。
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-center gap-4">
              <Button
                onClick={handleTranscribe}
                disabled={loading || isStreaming || stream || !hasValidCredentials() || (!audioFile && !audioUrl.trim())}
                className="px-8 py-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    转录中...
                  </>
                ) : (
                  '开始转录'
                )}
              </Button>
              
              {stream && apiProvider === 'qwen' && (
                <StreamingTranscription
                  apiKey={apiKey}
                  audioFile={audioFile}
                  audioUrl={audioUrl}
                  context={context}
                  enableItn={enableItn}
                  language={language === 'auto' ? '' : language}
                  onResult={handleStreamingResult}
                  onComplete={handleStreamingComplete}
                  onError={handleStreamingError}
                />
              )}

              {stream && apiProvider === 'doubao' && (
                <DoubaoStreamingTranscription
                  appKey={appKey}
                  accessKey={accessKey}
                  audioFile={audioFile}
                  audioUrl={audioUrl}
                  context={context}
                  enableItn={enableItn}
                  language={language === 'auto' ? '' : language}
                  onResult={handleStreamingResult}
                  onComplete={handleStreamingComplete}
                  onError={handleStreamingError}
                />
              )}
            </div>

            {/* Streaming Result */}
            {streamingText && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Text className="w-5 h-5" />
                    实时转录结果
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-50 border rounded-lg p-4">
                    <p className="text-gray-900 whitespace-pre-wrap">{streamingText}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Progress */}
            {loading && (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>转录进度</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Error */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Result */}
            {result && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    转录结果
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label>识别文本</Label>
                      <div className="mt-1 p-4 bg-gray-50 rounded-lg">
                        <p className="text-gray-900 whitespace-pre-wrap">{result.text}</p>
                      </div>
                    </div>
                    {result.language && (
                      <div className="flex gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">检测语言：</span>
                          <span className="font-medium">{result.language}</span>
                        </div>
                        {result.confidence && (
                          <div>
                            <span className="text-gray-600">置信度：</span>
                            <span className="font-medium">{(result.confidence * 100).toFixed(1)}%</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="api">
            <APIDocumentation baseUrl={baseUrl} />
          </TabsContent>

          <TabsContent value="proxy" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  代理服务器信息
                </CardTitle>
                <CardDescription>
                  此服务器作为 API 代理，解决跨域请求问题
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>服务器地址</Label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                      <code className="text-sm font-mono">{baseUrl}</code>
                    </div>
                  </div>
                  
                  <div>
                    <Label>代理端点</Label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                      <code className="text-sm font-mono">{baseUrl}/api/proxy/transcribe</code>
                    </div>
                  </div>

                  <Alert>
                    <AlertDescription>
                      <strong>主要功能：</strong>
                      <ul className="mt-2 space-y-1 text-sm">
                        <li>• 解决 JavaScript 跨域请求问题</li>
                        <li>• 提供统一的 API 接口</li>
                        <li>• 支持多种认证方式</li>
                        <li>• 完整的错误处理和日志记录</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>使用说明</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">1. 获取 API Key</h4>
                    <p className="text-sm text-gray-600">
                      前往阿里云百炼平台获取您的 API Key，格式为 sk-xxxxxxxxxxxxxxxxxxxxxxxx
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">2. 调用代理 API</h4>
                    <p className="text-sm text-gray-600">
                      使用提供的代理端点，在请求头中添加 Authorization: Bearer YOUR_API_KEY
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">3. 处理响应</h4>
                    <p className="text-sm text-gray-600">
                      代理服务器会返回标准化的 JSON 响应，包含转录结果和错误信息
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}