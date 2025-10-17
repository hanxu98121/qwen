// 豆包WebSocket客户端
// 基于Python版本的TypeScript实现

import WebSocket from 'ws'
import {
  DoubaoConfig,
  RequestBuilder,
  ResponseParser,
  AudioUtils,
  AsrResponse
} from './doubao-protocol'

export interface DoubaoClientOptions {
  url: string
  segmentDuration?: number
  config: DoubaoConfig
}

export class DoubaoWsClient {
  private seq = 1
  private url: string
  private segmentDuration: number
  private config: DoubaoConfig
  private conn: WebSocket | null = null

  constructor(options: DoubaoClientOptions) {
    this.url = options.url
    this.segmentDuration = options.segmentDuration || 200
    this.config = options.config
  }

  async connect(): Promise<void> {
    const headers = RequestBuilder.newAuthHeaders(this.config)

    return new Promise((resolve, reject) => {
      try {
        this.conn = new WebSocket(this.url, { headers })

        this.conn.on('open', () => {
          console.log(`Connected to ${this.url}`)
          resolve()
        })

        this.conn.on('error', (error) => {
          console.error('WebSocket error:', error)
          reject(error)
        })

        this.conn.on('close', () => {
          console.log('WebSocket connection closed')
        })

      } catch (error) {
        reject(error)
      }
    })
  }

  async sendFullClientRequest(): Promise<void> {
    if (!this.conn || this.conn.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket connection not open')
    }

    const request = await RequestBuilder.newFullClientRequest(this.seq)
    this.seq += 1

    return new Promise((resolve, reject) => {
      if (!this.conn) {
        reject(new Error('Connection lost'))
        return
      }

      const timeout = setTimeout(() => {
        reject(new Error('Full request timeout'))
      }, 10000)

      const tempMessageHandler = async (data: Buffer) => {
        try {
          const response = await ResponseParser.parseResponse(data)
          console.log('Full request response:', response.toDict())
          clearTimeout(timeout)

          if (this.conn) {
            this.conn.removeListener('message', tempMessageHandler)
          }
          resolve()
        } catch (error) {
          clearTimeout(timeout)
          if (this.conn) {
            this.conn.removeListener('message', tempMessageHandler)
          }
          reject(error)
        }
      }

      this.conn.on('message', tempMessageHandler)
      this.conn.send(request)
      console.log(`Sent full client request with seq: ${this.seq - 1}`)
    })
  }

  async *sendAudioSegments(audioData: Buffer): AsyncGenerator<AsrResponse, void, unknown> {
    if (!this.conn || this.conn.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket connection not open')
    }

    const segmentSize = AudioUtils.getSegmentSize(audioData, this.segmentDuration)
    const audioSegments = AudioUtils.splitAudio(audioData, segmentSize)
    const totalSegments = audioSegments.length

    console.log(`Split audio into ${totalSegments} segments of ${segmentSize} bytes each`)

    for (let i = 0; i < audioSegments.length; i++) {
      const segment = audioSegments[i]
      const isLast = (i === totalSegments - 1)

      const request = await RequestBuilder.newAudioOnlyRequest(
        this.seq,
        segment,
        isLast
      )

      await this.sendMessage(request)

      if (!isLast) {
        this.seq += 1
      }

      // 模拟实时流，添加延迟
      await new Promise(resolve => setTimeout(resolve, this.segmentDuration))

      // 让出控制权，允许接收消息
      yield await this.waitForResponse()
    }
  }

  private async sendMessage(data: Uint8Array): Promise<void> {
    if (!this.conn || this.conn.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket connection not open')
    }

    return new Promise((resolve, reject) => {
      if (this.conn) {
        this.conn.send(data, (error) => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        })
      } else {
        reject(new Error('Connection lost'))
      }
    })
  }

  private async waitForResponse(): Promise<AsrResponse> {
    return new Promise((resolve, reject) => {
      if (!this.conn) {
        reject(new Error('Connection lost'))
        return
      }

      const timeout = setTimeout(() => {
        reject(new Error('Response timeout'))
      }, 5000)

      const tempMessageHandler = async (data: Buffer) => {
        try {
          const response = await ResponseParser.parseResponse(data)
          clearTimeout(timeout)

          if (this.conn) {
            this.conn.removeListener('message', tempMessageHandler)
          }
          resolve(response)
        } catch (error) {
          clearTimeout(timeout)
          if (this.conn) {
            this.conn.removeListener('message', tempMessageHandler)
          }
          reject(error)
        }
      }

      this.conn.on('message', tempMessageHandler)
    })
  }

  async *startStreaming(audioData: Buffer): AsyncGenerator<AsrResponse, void, unknown> {
    try {
      // 1. 发送完整客户端请求
      await this.sendFullClientRequest()

      // 2. 发送音频片段并接收响应
      yield* this.sendAudioSegments(audioData)

    } catch (error) {
      console.error('Streaming error:', error)
      throw error
    }
  }

  close(): void {
    if (this.conn && this.conn.readyState === WebSocket.OPEN) {
      this.conn.close()
      this.conn = null
    }
  }

  isConnected(): boolean {
    return this.conn !== null && this.conn.readyState === WebSocket.OPEN
  }
}

// 工厂函数
export function createDoubaoClient(options: DoubaoClientOptions): DoubaoWsClient {
  return new DoubaoWsClient(options)
}