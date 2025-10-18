'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { Mic, MicOff, Loader2, Play } from 'lucide-react'

interface VoiceRecorderProps {
  onRecordingComplete: (file: File) => void
  onError: (error: string) => void
  disabled?: boolean
  autoTranscribe?: boolean
  onAutoTranscribeChange?: (enabled: boolean) => void
}

export default function VoiceRecorder({ onRecordingComplete, onError, disabled, autoTranscribe = false, onAutoTranscribeChange }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [isProcessingWav, setIsProcessingWav] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const animationFrameIdRef = useRef<number | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)

  
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60)
    const seconds = Math.floor(timeInSeconds % 60)
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  const drawIdleLine = useCallback(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    if (!context) return

    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }

    // Clear canvas with a subtle background
    context.fillStyle = '#f9fafb'
    context.fillRect(0, 0, canvas.width, canvas.height)

    // Draw center line
    context.strokeStyle = '#d1d5db'
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(0, canvas.height / 2)
    context.lineTo(canvas.width, canvas.height / 2)
    context.stroke()
  }, [])

  const drawWaveform = useCallback(() => {
    if (!analyserRef.current || !canvasRef.current || !dataArrayRef.current) return

    const analyser = analyserRef.current
    const canvas = canvasRef.current
    const dataArray = dataArrayRef.current
    const context = canvas.getContext('2d')
    if (!context) return

    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }

    analyser.getByteTimeDomainData(dataArray)

    // Clear canvas with a subtle background
    context.fillStyle = '#f9fafb'
    context.fillRect(0, 0, canvas.width, canvas.height)

    // Draw center line
    context.strokeStyle = '#e5e7eb'
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(0, canvas.height / 2)
    context.lineTo(canvas.width, canvas.height / 2)
    context.stroke()

    // Draw waveform
    context.strokeStyle = '#3b82f6'
    context.lineWidth = 2
    context.beginPath()

    const sliceWidth = canvas.width / dataArray.length
    let x = 0

    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 128.0
      const y = v * canvas.height / 2

      if (i === 0) {
        context.moveTo(x, y)
      } else {
        context.lineTo(x, y)
      }
      x += sliceWidth
    }

    context.lineTo(canvas.width, canvas.height / 2)
    context.stroke()

    // Add glow effect
    context.shadowBlur = 10
    context.shadowColor = '#3b82f6'
    context.stroke()
    context.shadowBlur = 0

    animationFrameIdRef.current = requestAnimationFrame(drawWaveform)
  }, [])

  const cleanupAudio = useCallback(() => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current)
      animationFrameIdRef.current = null
    }
    sourceRef.current?.disconnect()
    sourceRef.current = null
    analyserRef.current = null
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error)
    }
    audioContextRef.current = null
  }, [])

  useEffect(() => {
    if (isRecording) {
      drawWaveform()
    } else {
      drawIdleLine()
    }
    return cleanupAudio
  }, [isRecording, drawIdleLine, drawWaveform, cleanupAudio])

  const startTimer = () => {
    stopTimer()
    setRecordingTime(0)
    timerIntervalRef.current = setInterval(() => {
      setRecordingTime(prevTime => prevTime + 1)
    }, 1000)
  }

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
  }

  const convertToWav = async (audioFile: File): Promise<File> => {
    try {
      // Read the audio file as array buffer
      const arrayBuffer = await audioFile.arrayBuffer()

      // Create audio context for decoding
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

      // Decode the audio data
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

      // Convert to WAV with optimal ASR settings (16kHz mono)
      const wavBlob = bufferToWav(audioBuffer, 16000)

      // Clean up audio context
      await audioContext.close()

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const wavFileName = `recording-wav-${timestamp}.wav`

      return new File([wavBlob], wavFileName, { type: 'audio/wav' })
    } catch (error) {
      console.error('WAV conversion failed:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to convert to WAV')
    }
  }

  const bufferToWav = (audioBuffer: AudioBuffer, targetSampleRate: number = 16000): Blob => {
    const numChannels = 1; // Force mono for ASR
    const originalSampleRate = audioBuffer.sampleRate;
    const originalLength = audioBuffer.length;
    const targetLength = Math.floor(originalLength * targetSampleRate / originalSampleRate);
    const dataLength = targetLength * numChannels * 2; // 16-bit samples
    const bufferLength = 44 + dataLength;

    const arrBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrBuffer);

    let pos = 0;

    const writeString = (str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(pos + i, str.charCodeAt(i));
      }
      pos += str.length;
    };

    // RIFF chunk descriptor
    writeString('RIFF');
    view.setUint32(pos, 36 + dataLength, true); pos += 4;
    writeString('WAVE');

    // fmt sub-chunk
    writeString('fmt ');
    view.setUint32(pos, 16, true); pos += 4; // Subchunk1Size
    view.setUint16(pos, 1, true); pos += 2; // AudioFormat (1 = PCM)
    view.setUint16(pos, numChannels, true); pos += 2;
    view.setUint32(pos, targetSampleRate, true); pos += 4;
    view.setUint32(pos, targetSampleRate * numChannels * 2, true); pos += 4; // ByteRate
    view.setUint16(pos, numChannels * 2, true); pos += 2; // BlockAlign
    view.setUint16(pos, 16, true); pos += 2; // BitsPerSample

    // data sub-chunk
    writeString('data');
    view.setUint32(pos, dataLength, true); pos += 4;

    // Convert to mono and resample
    const channelData = audioBuffer.getChannelData(0); // Use first channel
    const resampledData = new Float32Array(targetLength);

    // Simple linear interpolation resampling
    const ratio = originalSampleRate / targetSampleRate;
    for (let i = 0; i < targetLength; i++) {
      const sourceIndex = i * ratio;
      const index = Math.floor(sourceIndex);
      const fraction = sourceIndex - index;

      if (index + 1 < channelData.length) {
        resampledData[i] = channelData[index] * (1 - fraction) + channelData[index + 1] * fraction;
      } else {
        resampledData[i] = channelData[index] || 0;
      }
    }

    // Write samples as 16-bit PCM
    for (let i = 0; i < targetLength; i++) {
      let sample = Math.max(-1, Math.min(1, resampledData[i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(pos, sample, true);
      pos += 2;
    }

    return new Blob([arrBuffer], { type: 'audio/wav' });
  }

  const startRecording = async () => {
    if (disabled) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      })

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      sourceRef.current = source

      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 2048
      analyserRef.current = analyser

      const bufferLength = analyser.frequencyBinCount
      dataArrayRef.current = new Uint8Array(bufferLength)

      source.connect(analyser)

      setIsRecording(true)
      startTimer()

      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }

      recorder.onstop = async () => {
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm'
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        const fileExtension = mimeType.split('/')[1]?.split(';')[0] || 'webm'

        const now = new Date()
        const year = now.getFullYear()
        const month = (now.getMonth() + 1).toString().padStart(2, '0')
        const day = now.getDate().toString().padStart(2, '0')
        const hours = now.getHours().toString().padStart(2, '0')
        const minutes = now.getMinutes().toString().padStart(2, '0')
        const formattedDate = `${year}-${month}-${day}_${hours}-${minutes}`
        const originalAudioFile = new File([audioBlob], `recording-${formattedDate}.${fileExtension}`, { type: mimeType })

        let finalAudioFile = originalAudioFile

        // Always convert to WAV format
        try {
          setIsProcessingWav(true)
          onError('正在转换为WAV格式...')
          finalAudioFile = await convertToWav(originalAudioFile)
          onError('')
        } catch (error) {
          console.error('WAV conversion failed:', error)
          onError(error instanceof Error ? error.message : 'WAV转换失败，使用原始格式')
          finalAudioFile = originalAudioFile
        } finally {
          setIsProcessingWav(false)
        }

        onRecordingComplete(finalAudioFile)
        audioChunksRef.current = []
        stream.getTracks().forEach(track => track.stop())
        cleanupAudio()
      }

      recorder.start()
    } catch (err) {
      console.error("Error accessing microphone:", err)
      onError("麦克风访问被拒绝或不可用。请检查浏览器权限设置。")
    }
  }

  const stopRecording = () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      stopTimer()
    }
  }

  useEffect(() => {
    return () => {
      stopTimer()
      cleanupAudio()
    }
  }, [cleanupAudio])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="w-5 h-5" />
          语音录制
        </CardTitle>
        <CardDescription>
          直接录制音频，自动转换为高质量WAV格式，优化语音识别效果
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Recording Timer */}
          <div className="text-center">
            <div className="text-2xl font-mono text-gray-900">
              {formatTime(recordingTime)}
            </div>
          </div>

          {/* Waveform Visualization */}
          <div className="w-full h-24 bg-gray-50 rounded-lg overflow-hidden border">
            <canvas
              ref={canvasRef}
              className="w-full h-full"
            />
          </div>

          {/* Recording Controls */}
          <div className="flex justify-center">
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={disabled || isProcessingWav}
              size="lg"
              className={isRecording ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}
            >
              {isProcessingWav ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  WAV处理中...
                </>
              ) : isRecording ? (
                <>
                  <MicOff className="w-4 h-4 mr-2" />
                  停止录音
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  开始录音
                </>
              )}
            </Button>
          </div>

          {/*
            <Alert>
              <AlertDescription>
                💡 录音将自动转换为WAV格式，提供更高质量音频，优化语音识别效果。音频将转换为16kHz单声道格式。
              </AlertDescription>
            </Alert>
          */}

          {/* Auto-transcribe option */}
          <div className="flex items-center space-x-2">
            <Switch
              id="auto-transcribe"
              checked={autoTranscribe}
              onCheckedChange={onAutoTranscribeChange}
            />
            <Label htmlFor="auto-transcribe" className="text-sm">
              录音后自动转录
            </Label>
          </div>

          {/* Instructions */}
          <div className="text-xs text-gray-500 text-center">
            点击"开始录音"按钮，或按住空格键快速录音
          </div>
        </div>
      </CardContent>
    </Card>
  )
}