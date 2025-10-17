// 豆包ASR协议实现
// 基于sauc_websocket_demo.py的TypeScript版本

import { gzip, ungzip } from 'node-gzip'
import { v4 as uuidv4 } from 'uuid'

// 协议常量定义
export const DEFAULT_SAMPLE_RATE = 16000

export class ProtocolVersion {
  static readonly V1 = 0b0001
}

export class MessageType {
  static readonly CLIENT_FULL_REQUEST = 0b0001
  static readonly CLIENT_AUDIO_ONLY_REQUEST = 0b0010
  static readonly SERVER_FULL_RESPONSE = 0b1001
  static readonly SERVER_ERROR_RESPONSE = 0b1111
}

export class MessageTypeSpecificFlags {
  static readonly NO_SEQUENCE = 0b0000
  static readonly POS_SEQUENCE = 0b0001
  static readonly NEG_SEQUENCE = 0b0010
  static readonly NEG_WITH_SEQUENCE = 0b0011
}

export class SerializationType {
  static readonly NO_SERIALIZATION = 0b0000
  static readonly JSON = 0b0001
}

export class CompressionType {
  static readonly GZIP = 0b0001
}

// 配置接口
export interface DoubaoConfig {
  app_key: string
  access_key: string
}

// 请求头类
export class AsrRequestHeader {
  private messageType = MessageType.CLIENT_FULL_REQUEST
  private messageTypeSpecificFlags = MessageTypeSpecificFlags.POS_SEQUENCE
  private serializationType = SerializationType.JSON
  private compressionType = CompressionType.GZIP
  private reservedData = new Uint8Array([0x00])

  withMessageType(messageType: number): this {
    this.messageType = messageType
    return this
  }

  withMessageTypeSpecificFlags(flags: number): this {
    this.messageTypeSpecificFlags = flags
    return this
  }

  withSerializationType(serializationType: number): this {
    this.serializationType = serializationType
    return this
  }

  withCompressionType(compressionType: number): this {
    this.compressionType = compressionType
    return this
  }

  withReservedData(reservedData: Uint8Array): this {
    this.reservedData = reservedData
    return this
  }

  toBytes(): Uint8Array {
    const header = new Uint8Array(4)
    header[0] = (ProtocolVersion.V1 << 4) | 1
    header[1] = (this.messageType << 4) | this.messageTypeSpecificFlags
    header[2] = (this.serializationType << 4) | this.compressionType
    header[3] = this.reservedData[0]
    return header
  }

  static defaultHeader(): AsrRequestHeader {
    return new AsrRequestHeader()
  }
}

// 请求构建器
export class RequestBuilder {
  static newAuthHeaders(config: DoubaoConfig): Record<string, string> {
    const reqid = uuidv4()
    return {
      'X-Api-Resource-Id': 'volc.bigasr.sauc.duration',
      'X-Api-Request-Id': reqid,
      'X-Api-Access-Key': config.access_key,
      'X-Api-App-Key': config.app_key
    }
  }

  static async newFullClientRequest(seq: number): Promise<Uint8Array> {
    const header = AsrRequestHeader.defaultHeader()
      .withMessageTypeSpecificFlags(MessageTypeSpecificFlags.POS_SEQUENCE)

    const payload = {
      user: {
        uid: 'demo_uid'
      },
      audio: {
        format: 'wav',
        codec: 'raw',
        rate: 16000,
        bits: 16,
        channel: 1
      },
      request: {
        model_name: 'bigmodel',
        enable_itn: true,
        enable_punc: true,
        enable_ddc: true,
        show_utterances: true,
        enable_nonstream: false
      }
    }

    const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf-8')
    const compressedPayload = await gzip(payloadBytes)
    const payloadSize = compressedPayload.length

    const request = new Uint8Array(header.toBytes().length + 4 + 4 + payloadSize)
    let offset = 0

    // 复制header
    const headerBytes = header.toBytes()
    request.set(headerBytes, offset)
    offset += headerBytes.length

    // 复制序列号
    const seqBytes = Buffer.alloc(4)
    seqBytes.writeInt32BE(seq, 0)
    request.set(seqBytes, offset)
    offset += 4

    // 复制payload大小
    const sizeBytes = Buffer.alloc(4)
    sizeBytes.writeUInt32BE(payloadSize, 0)
    request.set(sizeBytes, offset)
    offset += 4

    // 复制压缩的payload
    request.set(compressedPayload, offset)

    return request
  }

  static async newAudioOnlyRequest(seq: number, segment: Buffer, isLast: boolean = false): Promise<Uint8Array> {
    const header = AsrRequestHeader.defaultHeader()

    if (isLast) {
      header.withMessageTypeSpecificFlags(MessageTypeSpecificFlags.NEG_WITH_SEQUENCE)
      seq = -seq
    } else {
      header.withMessageTypeSpecificFlags(MessageTypeSpecificFlags.POS_SEQUENCE)
    }
    header.withMessageType(MessageType.CLIENT_AUDIO_ONLY_REQUEST)

    const headerBytes = header.toBytes()
    const seqBytes = Buffer.alloc(4)
    seqBytes.writeInt32BE(seq, 0)

    const compressedSegment = await gzip(segment)
    const sizeBytes = Buffer.alloc(4)
    sizeBytes.writeUInt32BE(compressedSegment.length, 0)

    const request = new Uint8Array(headerBytes.length + 4 + 4 + compressedSegment.length)
    let offset = 0

    request.set(headerBytes, offset)
    offset += headerBytes.length

    request.set(seqBytes, offset)
    offset += 4

    request.set(sizeBytes, offset)
    offset += 4

    request.set(compressedSegment, offset)

    return request
  }
}

// 响应类
export class AsrResponse {
  code = 0
  event = 0
  isLastPackage = false
  payloadSequence = 0
  payloadSize = 0
  payloadMsg: any = null

  toDict(): Record<string, any> {
    return {
      code: this.code,
      event: this.event,
      is_last_package: this.isLastPackage,
      payload_sequence: this.payloadSequence,
      payload_size: this.payloadSize,
      payload_msg: this.payloadMsg
    }
  }
}

// 响应解析器
export class ResponseParser {
  static async parseResponse(msg: Buffer): Promise<AsrResponse> {
    const response = new AsrResponse()

    const headerSize = msg[0] & 0x0f
    const messageType = msg[1] >> 4
    const messageTypeSpecificFlags = msg[1] & 0x0f
    const serializationMethod = msg[2] >> 4
    const messageCompression = msg[2] & 0x0f

    let payload = msg.slice(headerSize * 4)

    // 解析message_type_specific_flags
    if (messageTypeSpecificFlags & 0x01) {
      response.payloadSequence = payload.readInt32BE(0)
      payload = payload.slice(4)
    }
    if (messageTypeSpecificFlags & 0x02) {
      response.isLastPackage = true
    }
    if (messageTypeSpecificFlags & 0x04) {
      response.event = payload.readInt32BE(0)
      payload = payload.slice(4)
    }

    // 解析message_type
    if (messageType === MessageType.SERVER_FULL_RESPONSE) {
      response.payloadSize = payload.readUInt32BE(0)
      payload = payload.slice(4)
    } else if (messageType === MessageType.SERVER_ERROR_RESPONSE) {
      response.code = payload.readInt32BE(0)
      response.payloadSize = payload.readUInt32BE(4)
      payload = payload.slice(8)
    }

    if (!payload || payload.length === 0) {
      return response
    }

    // 解压缩
    if (messageCompression === CompressionType.GZIP) {
      try {
        payload = Buffer.from(await ungzip(payload))
      } catch (e) {
        console.error('Failed to decompress payload:', e)
        return response
      }
    }

    // 解析payload
    try {
      if (serializationMethod === SerializationType.JSON) {
        response.payloadMsg = JSON.parse(payload.toString('utf-8'))
      }
    } catch (e) {
      console.error('Failed to parse payload:', e)
    }

    return response
  }
}

// 音频处理工具类
export class AudioUtils {
  static judgeWav(data: Buffer): boolean {
    if (data.length < 44) return false
    return data.slice(0, 4).equals(Buffer.from('RIFF')) &&
           data.slice(8, 12).equals(Buffer.from('WAVE'))
  }

  static readWavInfo(data: Buffer): {
    numChannels: number
    sampWidth: number
    frameRate: number
    frames: number
    waveData: Buffer
  } {
    if (data.length < 44) {
      throw new Error('Invalid WAV file: too short')
    }

    const chunkId = data.slice(0, 4)
    if (!chunkId.equals(Buffer.from('RIFF'))) {
      throw new Error('Invalid WAV file: not RIFF format')
    }

    const format = data.slice(8, 12)
    if (!format.equals(Buffer.from('WAVE'))) {
      throw new Error('Invalid WAV file: not WAVE format')
    }

    // 解析fmt子块
    const audioFormat = data.readUInt16LE(20)
    const numChannels = data.readUInt16LE(22)
    const frameRate = data.readUInt32LE(24)
    const bitsPerSample = data.readUInt16LE(34)

    // 查找data子块
    let pos = 36
    while (pos < data.length - 8) {
      const subchunkId = data.slice(pos, pos + 4)
      const subchunkSize = data.readUInt32LE(pos + 4)

      if (subchunkId.equals(Buffer.from('data'))) {
        const waveData = data.slice(pos + 8, pos + 8 + subchunkSize)
        return {
          numChannels,
          sampWidth: bitsPerSample / 8,
          frameRate,
          frames: subchunkSize / (numChannels * (bitsPerSample / 8)),
          waveData
        }
      }
      pos += 8 + subchunkSize
    }

    throw new Error('Invalid WAV file: no data subchunk found')
  }

  static splitAudio(data: Buffer, segmentSize: number): Buffer[] {
    if (segmentSize <= 0) return []

    const segments: Buffer[] = []
    for (let i = 0; i < data.length; i += segmentSize) {
      const end = Math.min(i + segmentSize, data.length)
      segments.push(data.slice(i, end))
    }
    return segments
  }

  static getSegmentSize(content: Buffer, segmentDuration: number = 200): number {
    try {
      const { numChannels, sampWidth, frameRate } = this.readWavInfo(content)
      const sizePerSec = numChannels * sampWidth * frameRate
      return Math.floor(sizePerSec * segmentDuration / 1000)
    } catch (e) {
      console.error('Failed to calculate segment size:', e)
      return 3200 // 默认200ms的16kHz单声道16位音频大小
    }
  }
}