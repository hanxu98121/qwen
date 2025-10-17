// 豆包API工具函数 - Vercel Serverless兼容版本

import fs from 'fs/promises'
import path from 'path'
import { AudioUtils } from './doubao-protocol'

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

      // 直接下载到Buffer，不保存到文件系统
      const response = await fetch(audioUrl)
      if (!response.ok) {
        throw new Error(`Failed to download audio: HTTP ${response.status}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      console.log(`Downloaded ${buffer.length} bytes from URL`)
      return buffer
    } catch (error) {
      console.error('Failed to download audio from URL:', error)
      throw new Error(`从URL下载音频失败: ${error}`)
    }
  }

  /**
   * 处理上传的音频文件 (Serverless版本)
   */
  static async processUploadedFile(audioFile: File): Promise<Buffer> {
    try {
      console.log('Processing uploaded file:', audioFile.name)

      // 直接从File转换为Buffer，不保存到文件系统
      const arrayBuffer = await audioFile.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      console.log(`Processed ${buffer.length} bytes from uploaded file`)
      return buffer
    } catch (error) {
      console.error('Failed to process uploaded file:', error)
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