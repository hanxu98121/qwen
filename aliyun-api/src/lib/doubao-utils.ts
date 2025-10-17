// 豆包API工具函数

import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import { AudioUtils } from './doubao-protocol'

const execAsync = promisify(exec)

export interface AudioInfo {
  format: string
  duration: number
  sampleRate: number
  channels: number
  bitRate: number
}

export class DoubaoUtils {
  /**
   * 检查是否安装了FFmpeg
   */
  static async checkFFmpeg(): Promise<boolean> {
    try {
      // 使用系统安装的ffmpeg
      await execAsync('ffmpeg -version')
      return true
    } catch {
      return false
    }
  }

  /**
   * 将音频文件转换为WAV格式
   */
  static async convertToWav(inputPath: string, outputPath?: string, sampleRate: number = 16000): Promise<Buffer> {
    const tempOutputPath = outputPath || path.join(process.cwd(), 'temp', `converted_${Date.now()}.wav`)

    try {
      // 确保临时目录存在
      await fs.mkdir(path.dirname(tempOutputPath), { recursive: true })

      const command = [
        'ffmpeg',
        '-v', 'quiet',
        '-y', // 覆盖输出文件
        '-i', inputPath,
        '-acodec', 'pcm_s16le', // PCM 16位
        '-ac', '1', // 单声道
        '-ar', sampleRate.toString(), // 采样率
        '-f', 'wav', // 输出格式
        tempOutputPath
      ]

      await execAsync(command.join(' '))

      // 读取转换后的文件
      const wavData = await fs.readFile(tempOutputPath)

      // 清理临时文件
      try {
        await fs.unlink(tempOutputPath)
      } catch {
        // 忽略删除错误
      }

      return wavData
    } catch (error) {
      // 清理临时文件（如果存在）
      try {
        await fs.unlink(tempOutputPath)
      } catch {
        // 忽略删除错误
      }
      throw new Error(`音频转换失败: ${error}`)
    }
  }

  /**
   * 从URL下载音频文件并转换为WAV格式
   */
  static async downloadAudioFromUrl(audioUrl: string): Promise<Buffer> {
    try {
      console.log('Downloading audio from URL:', audioUrl)

      // 创建临时目录
      const tempDir = await this.ensureTempDir()
      const tempFile = path.join(tempDir, `download_${Date.now()}.mp3`)

      // 下载文件
      const response = await fetch(audioUrl)
      if (!response.ok) {
        throw new Error(`Failed to download audio: HTTP ${response.status}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // 保存到临时文件
      await fs.writeFile(tempFile, buffer)
      console.log(`Downloaded ${buffer.length} bytes to ${tempFile}`)

      // 处理音频文件
      const processedAudio = await this.processAudioFile(tempFile)

      // 清理临时文件
      await this.cleanupTempFile(tempFile)

      return processedAudio
    } catch (error) {
      console.error('Failed to download audio from URL:', error)
      throw new Error(`从URL下载音频失败: ${error}`)
    }
  }

  /**
   * 处理音频文件 - 自动检测格式并转换为WAV
   */
  static async processAudioFile(filePath: string): Promise<Buffer> {
    try {
      // 读取文件内容
      let audioData = await fs.readFile(filePath)

      // 检查是否已经是WAV格式
      if (AudioUtils.judgeWav(audioData)) {
        console.log('File is already in WAV format')

        // 验证WAV文件格式
        const wavInfo = AudioUtils.readWavInfo(audioData)
        console.log('WAV info:', {
          channels: wavInfo.numChannels,
          sampleRate: wavInfo.frameRate,
          sampWidth: wavInfo.sampWidth,
          frames: wavInfo.frames
        })

        // 如果格式不符合要求，进行转换
        if (wavInfo.frameRate !== 16000 || wavInfo.numChannels !== 1 || wavInfo.sampWidth !== 2) {
          console.log('Converting WAV to required format (16kHz, mono, 16-bit)')
          audioData = await this.convertToWav(filePath)
        }

        return audioData
      } else {
        console.log('Converting audio to WAV format...')
        return await this.convertToWav(filePath)
      }
    } catch (error) {
      console.error('Failed to process audio file:', error)
      throw new Error(`音频处理失败: ${error}`)
    }
  }

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
   * 创建临时目录
   */
  static async ensureTempDir(): Promise<string> {
    const tempDir = path.join(process.cwd(), 'temp')
    await fs.mkdir(tempDir, { recursive: true })
    return tempDir
  }

  /**
   * 清理临时文件
   */
  static async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath)
    } catch {
      // 忽略删除错误
    }
  }
}