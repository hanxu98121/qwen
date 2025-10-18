// 豆包API工具函数 - Vercel Serverless兼容版本

import fs from 'fs/promises'
import path from 'path'
import { AudioUtils } from './doubao-protocol'
import { FFmpegConverter } from './ffmpeg-converter'

export interface AudioInfo {
  format: string
  duration: number
  sampleRate: number
  channels: number
  bitRate: number
}

export class DoubaoUtilsServerless {
  /**
   * 从Buffer中提取文本结果
   */
  static extractTextFromResponse(response: any): string {
    try {
      if (response && response.payload_msg) {
        const payload = response.payload_msg

        // 检查不同的响应格式
        if (payload.result) {
          // 标准格式
          if (payload.result.text) {
            return payload.result.text
          }

          // 如果有多个段落，合并它们
          if (payload.result.segments && Array.isArray(payload.result.segments)) {
            return payload.result.segments
              .map((segment: any) => segment.text || segment.transcript || '')
              .join(' ')
              .trim()
          }

          // 如果有utterances
          if (payload.result.utterances && Array.isArray(payload.result.utterances)) {
            return payload.result.utterances
              .map((utterance: any) => utterance.text || utterance.transcript || '')
              .join(' ')
              .trim()
          }
        }

        // 直接检查payload中的文本字段
        if (payload.text) {
          return payload.text
        }

        if (payload.transcript) {
          return payload.transcript
        }

        // 检查是否是直接的文本响应
        if (typeof payload === 'string') {
          return payload
        }
      }

      return ''
    } catch (error) {
      console.error('Failed to extract text from response:', error)
      return ''
    }
  }

  /**
   * 获取响应的语言信息
   */
  static extractLanguageFromResponse(response: any): string | undefined {
    try {
      if (response && response.payload_msg) {
        const payload = response.payload_msg

        if (payload.result && payload.result.language) {
          return payload.result.language
        }

        if (payload.language) {
          return payload.language
        }
      }

      return undefined
    } catch (error) {
      console.error('Failed to extract language from response:', error)
      return undefined
    }
  }

  /**
   * 获取响应的置信度信息
   */
  static extractConfidenceFromResponse(response: any): number | undefined {
    try {
      if (response && response.payload_msg) {
        const payload = response.payload_msg

        if (payload.result && payload.result.confidence !== undefined) {
          return payload.result.confidence
        }

        if (payload.confidence !== undefined) {
          return payload.confidence
        }
      }

      return undefined
    } catch (error) {
      console.error('Failed to extract confidence from response:', error)
      return undefined
    }
  }

  /**
   * 格式化错误信息
   */
  static formatError(error: any): string {
    if (typeof error === 'string') {
      return error
    }

    if (error && error.message) {
      return error.message
    }

    if (error && error.payload_msg && error.payload_msg.error) {
      return error.payload_msg.error
    }

    return '未知错误'
  }

  /**
   * 验证配置
   */
  static validateConfig(config: any): { isValid: boolean; error?: string } {
    if (!config) {
      return { isValid: false, error: '配置不能为空' }
    }

    if (!config.app_key || typeof config.app_key !== 'string' || config.app_key.trim() === '') {
      return { isValid: false, error: 'app_key 不能为空' }
    }

    if (!config.access_key || typeof config.access_key !== 'string' || config.access_key.trim() === '') {
      return { isValid: false, error: 'access_key 不能为空' }
    }

    return { isValid: true }
  }

  /**
   * 从URL下载音频文件并转换为Buffer (Serverless版本)
   */
  static async downloadAudioFromUrl(audioUrl: string): Promise<Buffer> {
    try {
      console.log('Downloading audio from URL:', audioUrl)

      // 验证URL格式
      if (!audioUrl || !audioUrl.startsWith('http')) {
        throw new Error('Invalid audio URL provided')
      }

      // 直接下载到Buffer，不保存到文件系统
      const response = await fetch(audioUrl)
      if (!response.ok) {
        throw new Error(`Failed to download audio: HTTP ${response.status} ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      let buffer = Buffer.from(arrayBuffer)

      console.log(`Downloaded ${buffer.length} bytes, checking format...`)

      // 验证音频文件有效性
      if (buffer.length < 100) {
        throw new Error('Downloaded audio file is too small to be valid')
      }

      // 使用新的转换系统
      try {
        console.log('Converting audio to Doubao format...');
        buffer = await FFmpegConverter.ensureDoubaoFormat(buffer);
        console.log(`Audio converted successfully (${buffer.length} bytes)`);

        // 验证转换后的格式
        const validation = this.validateWavFormat(buffer);
        if (validation.isValid && !validation.needsConversion) {
          console.log('Audio format validation passed');
        } else {
          console.warn('Audio format validation failed, but proceeding anyway');
        }

      } catch (conversionError) {
        console.error('Audio conversion failed:', conversionError);

        // 提供更详细的错误信息
        const errorMessage = conversionError instanceof Error ? conversionError.message : 'Unknown conversion error';
        throw new Error(`Audio conversion failed: ${errorMessage}. Please ensure the audio file is in a supported format (MP3, WAV, M4A, FLAC) and try again.`);
      }

      console.log(`Final audio buffer size: ${buffer.length} bytes`)
      return buffer
    } catch (error) {
      console.error('Failed to download audio from URL:', error)

      // 提供更友好的错误信息
      if (error instanceof Error) {
        if (error.message.includes('Failed to download')) {
          throw new Error(`无法下载音频文件: ${error.message}. 请检查URL是否正确且可访问。`);
        }
        if (error.message.includes('Audio conversion failed')) {
          throw new Error(`音频格式转换失败: ${error.message}. 请尝试使用WAV格式的音频文件。`);
        }
        if (error.message.includes('Invalid audio URL')) {
          throw new Error(`无效的音频URL: ${audioUrl}. 请提供有效的HTTP或HTTPS链接。`);
        }
      }

      throw new Error(`从URL下载音频失败: ${error}`)
    }
  }

  /**
   * 处理上传的音频文件 (Serverless版本)
   */
  static async processUploadedFile(audioFile: File): Promise<Buffer> {
    try {
      console.log('Processing uploaded file:', audioFile.name)

      // 验证文件
      if (!audioFile || audioFile.size === 0) {
        throw new Error('No audio file provided or file is empty')
      }

      // 检查文件大小限制 (10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (audioFile.size > maxSize) {
        throw new Error(`Audio file is too large. Maximum size is 10MB, got ${Math.round(audioFile.size / 1024 / 1024)}MB`)
      }

      // 检查文件类型
      const supportedTypes = ['audio/mpeg', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mp4', 'audio/m4a', 'audio/flac', 'audio/x-flac'];
      if (!supportedTypes.includes(audioFile.type) && !audioFile.name.match(/\.(mp3|wav|m4a|flac)$/i)) {
        console.warn('Unsupported file type:', audioFile.type, 'but will attempt processing anyway');
      }

      // 直接从File转换为Buffer，不保存到文件系统
      const arrayBuffer = await audioFile.arrayBuffer()
      let buffer = Buffer.from(arrayBuffer)

      console.log(`Loaded ${buffer.length} bytes from ${audioFile.name}, checking format...`)

      // 验证音频文件有效性
      if (buffer.length < 100) {
        throw new Error('Audio file is too small to be valid')
      }

      // 使用新的转换系统
      try {
        console.log('Converting audio to Doubao format...');
        buffer = await FFmpegConverter.ensureDoubaoFormat(buffer);
        console.log(`Audio converted successfully (${buffer.length} bytes)`);

        // 验证转换后的格式
        const validation = this.validateWavFormat(buffer);
        if (validation.isValid && !validation.needsConversion) {
          console.log('Audio format validation passed');
        } else {
          console.warn('Audio format validation failed, but proceeding anyway');
        }

      } catch (conversionError) {
        console.error('Audio conversion failed:', conversionError);

        // 提供更详细的错误信息
        const errorMessage = conversionError instanceof Error ? conversionError.message : 'Unknown conversion error';
        throw new Error(`Audio conversion failed: ${errorMessage}. Please ensure the audio file is in a supported format (MP3, WAV, M4A, FLAC) and try again.`);
      }

      console.log(`Final audio buffer size: ${buffer.length} bytes`)
      return buffer
    } catch (error) {
      console.error('Failed to process uploaded file:', error)

      // 提供更友好的错误信息
      if (error instanceof Error) {
        if (error.message.includes('too large')) {
          throw new Error(`文件过大: ${error.message}. 请使用小于10MB的音频文件。`);
        }
        if (error.message.includes('No audio file provided')) {
          throw new Error(`未提供音频文件: ${error.message}. 请选择一个音频文件。`);
        }
        if (error.message.includes('Audio conversion failed')) {
          throw new Error(`音频格式转换失败: ${error.message}. 请尝试使用WAV格式的音频文件。`);
        }
        if (error.message.includes('too small to be valid')) {
          throw new Error(`音频文件无效: ${error.message}. 请选择一个有效的音频文件。`);
        }
      }

      throw new Error(`处理上传文件失败: ${error}`)
    }
  }

  /**
   * 检查音频格式是否为WAV
   */
  static isWavFormat(buffer: Buffer): boolean {
    try {
      return AudioUtils.judgeWav(buffer)
    } catch {
      return false
    }
  }

  /**
   * 检查WAV格式是否符合豆包要求
   */
  static validateWavFormat(buffer: Buffer): { isValid: boolean; needsConversion: boolean } {
    try {
      if (!this.isWavFormat(buffer)) {
        return { isValid: false, needsConversion: true }
      }

      const wavInfo = AudioUtils.readWavInfo(buffer)
      console.log('WAV info:', {
        channels: wavInfo.numChannels,
        sampleRate: wavInfo.frameRate,
        sampWidth: wavInfo.sampWidth,
        frames: wavInfo.frames
      })

      // 检查是否符合豆包要求：16kHz, 单声道, 16位
      const isValidFormat =
        wavInfo.frameRate === 16000 &&
        wavInfo.numChannels === 1 &&
        wavInfo.sampWidth === 2

      return {
        isValid: true,
        needsConversion: !isValidFormat
      }
    } catch (error) {
      console.error('Failed to validate WAV format:', error)
      return { isValid: false, needsConversion: true }
    }
  }
}