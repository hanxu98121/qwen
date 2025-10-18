// FFmpeg音频转换工具 - Vercel Serverless兼容版本
import ffmpeg from 'fluent-ffmpeg';
import wavDecoder from 'wav-decoder';
import wavEncoder from 'wav-encoder';

export class FFmpegConverter {
  private static isFFmpegAvailable: boolean | null = null;

  /**
   * 检查FFmpeg是否可用
   */
  static async checkFFmpegAvailability(): Promise<boolean> {
    if (this.isFFmpegAvailable !== null) {
      return this.isFFmpegAvailable;
    }

    return new Promise((resolve) => {
      const command = ffmpeg();
      command.on('error', () => {
        this.isFFmpegAvailable = false;
        resolve(false);
      });
      command.on('start', () => {
        this.isFFmpegAvailable = true;
        resolve(true);
      });
      // 尝试获取FFmpeg版本
      command.input('dummy')
        .outputFormat('null')
        .on('error', () => {
          this.isFFmpegAvailable = false;
          resolve(false);
        })
        .on('start', () => {
          this.isFFmpegAvailable = true;
          resolve(true);
        });
      // 超时处理
      setTimeout(() => {
        this.isFFmpegAvailable = false;
        resolve(false);
      }, 2000);
    });
  }

  /**
   * 设置FFmpeg路径 (Vercel需要)
   */
  static setupFFmpeg(): void {
    // 在Vercel环境中，FFmpeg通常在 /opt/ffmpeg/ 或 /usr/bin/ffmpeg
    const possiblePaths = [
      '/opt/ffmpeg/ffmpeg',
      '/usr/bin/ffmpeg',
      '/usr/local/bin/ffmpeg',
      'ffmpeg'
    ];

    for (const path of possiblePaths) {
      try {
        ffmpeg.setFfmpegPath(path);
        break;
      } catch (error) {
        // 继续尝试下一个路径
      }
    }
  }

  /**
   * 使用fluent-ffmpeg转换音频为豆包要求的格式
   */
  static async convertToDoubaoFormat(
    inputBuffer: Buffer,
    inputFormat?: string
  ): Promise<Buffer> {
    try {
      console.log('Starting audio conversion for Doubao API...');

      // 检查FFmpeg可用性
      const isAvailable = await this.checkFFmpegAvailability();
      if (!isAvailable) {
        throw new Error('FFmpeg is not available in this environment');
      }

      // 设置FFmpeg路径
      this.setupFFmpeg();

      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];

        // 创建FFmpeg命令
        const command = ffmpeg()
          .input(Buffer.from(inputBuffer))
          .inputFormat(inputFormat || 'auto')
          .outputOptions([
            '-f wav',
            '-acodec pcm_s16le',
            '-ac 1',
            '-ar 16000',
            '-y'
          ])
          .on('error', (error) => {
            console.error('FFmpeg conversion error:', error);
            reject(new Error(`FFmpeg conversion failed: ${error.message}`));
          })
          .on('end', () => {
            console.log('Audio conversion completed');
            const result = Buffer.concat(chunks);
            resolve(result);
          })
          .on('data', (chunk) => {
            chunks.push(chunk);
          });

        // 输出到流
        command.pipe();
        command.run();
      });

    } catch (error) {
      console.error('Audio conversion failed:', error);
      throw new Error(`音频转换失败: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * 使用WebAssembly库进行音频转换 (FFmpeg不可用时的后备方案)
   */
  static async convertWithWebAssembly(inputBuffer: Buffer): Promise<Buffer> {
    try {
      console.log('Attempting WebAssembly audio conversion...');

      // 首先尝试解码音频
      let audioData;
      try {
        audioData = await wavDecoder.decode(inputBuffer);
      } catch (decodeError) {
        // 如果不是WAV格式，我们无法直接处理
        throw new Error('WebAssembly converter only supports WAV input');
      }

      // 重新编码为豆包要求的格式
      const targetSampleRate = 16000;
      const targetChannels = 1;

      // 重采样到目标格式
      const resampledData = this.resampleAudioData(
        audioData.channelData[0],
        audioData.sampleRate,
        targetSampleRate
      );

      // 编码为WAV
      const wavBuffer = await wavEncoder.encode({
        sampleRate: targetSampleRate,
        channelData: [resampledData]
      });

      console.log('WebAssembly conversion completed');
      return Buffer.from(wavBuffer);

    } catch (error) {
      console.error('WebAssembly conversion failed:', error);
      throw new Error(`WebAssembly转换失败: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * 简单的音频重采样 (线性插值)
   */
  static resampleAudioData(
    audioData: Float32Array,
    fromSampleRate: number,
    toSampleRate: number
  ): Float32Array {
    const ratio = fromSampleRate / toSampleRate;
    const outputLength = Math.floor(audioData.length / ratio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const sourceIndex = i * ratio;
      const index = Math.floor(sourceIndex);
      const fraction = sourceIndex - index;

      if (index < audioData.length - 1) {
        output[i] = audioData[index] * (1 - fraction) + audioData[index + 1] * fraction;
      } else {
        output[i] = audioData[index];
      }
    }

    return output;
  }

  /**
   * 检测音频格式
   */
  static detectFormat(buffer: Buffer): string {
    if (buffer.length < 12) return 'unknown';

    // WAV格式
    if (buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WAVE') {
      return 'wav';
    }

    // MP3格式
    if (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0) {
      return 'mp3';
    }

    // M4A格式
    if (buffer.length > 8) {
      const boxType = buffer.toString('ascii', 4, 8);
      if (boxType === 'ftyp') {
        return 'm4a';
      }
    }

    // FLAC格式
    if (buffer.toString('ascii', 0, 4) === 'fLaC') {
      return 'flac';
    }

    return 'unknown';
  }

  /**
   * 验证WAV格式
   */
  static validateWavFormat(buffer: Buffer): {
    isValid: boolean;
    needsConversion: boolean;
    sampleRate?: number;
    channels?: number;
    bitsPerSample?: number;
  } {
    if (this.detectFormat(buffer) !== 'wav' || buffer.length < 44) {
      return { isValid: false, needsConversion: true };
    }

    try {
      const channels = buffer.readUInt16LE(22);
      const sampleRate = buffer.readUInt32LE(24);
      const bitsPerSample = buffer.readUInt16LE(34);

      const isValidFormat =
        sampleRate === 16000 &&
        channels === 1 &&
        bitsPerSample === 16;

      return {
        isValid: true,
        needsConversion: !isValidFormat,
        sampleRate,
        channels,
        bitsPerSample
      };
    } catch {
      return { isValid: false, needsConversion: true };
    }
  }

  /**
   * 转换音频并确保符合豆包要求 (多层次策略)
   */
  static async ensureDoubaoFormat(buffer: Buffer): Promise<Buffer> {
    console.log('Converting audio to Doubao-compatible format...');

    const currentFormat = this.detectFormat(buffer);
    console.log(`Detected audio format: ${currentFormat}`);

    // 首先检查当前格式
    const validation = this.validateWavFormat(buffer);
    if (validation.isValid && !validation.needsConversion) {
      console.log('Audio already in Doubao-compatible format');
      return buffer;
    }

    let convertedBuffer: Buffer;

    // 策略1: 尝试使用FFmpeg
    try {
      console.log('Attempting FFmpeg conversion...');
      convertedBuffer = await this.convertToDoubaoFormat(buffer, currentFormat);
      console.log('FFmpeg conversion successful');
      return convertedBuffer;
    } catch (ffmpegError) {
      console.warn('FFmpeg conversion failed, trying WebAssembly:', ffmpegError);
    }

    // 策略2: 尝试使用WebAssembly (仅适用于WAV输入)
    try {
      console.log('Attempting WebAssembly conversion...');
      convertedBuffer = await this.convertWithWebAssembly(buffer);
      console.log('WebAssembly conversion successful');
      return convertedBuffer;
    } catch (webAssemblyError) {
      console.warn('WebAssembly conversion failed:', webAssemblyError);
    }

    // 策略3: 如果是MP3，抛出特定错误建议使用在线转换
    if (currentFormat === 'mp3') {
      throw new Error('MP3 conversion requires FFmpeg. Please convert to WAV format manually or ensure FFmpeg is available.');
    }

    // 策略4: 最后的后备方案 - 如果已经是WAV但参数不对，尝试手动修正
    if (currentFormat === 'wav') {
      try {
        console.log('Attempting manual WAV format correction...');
        convertedBuffer = this.correctWavFormat(buffer);
        console.log('Manual WAV correction successful');
        return convertedBuffer;
      } catch (correctionError) {
        console.warn('Manual WAV correction failed:', correctionError);
      }
    }

    // 所有策略都失败了
    throw new Error('Unable to convert audio to Doubao-compatible format. Please ensure the audio is in WAV format (16kHz, mono, 16-bit).');
  }

  /**
   * 手动修正WAV格式 (简单实现)
   */
  static correctWavFormat(buffer: Buffer): Buffer {
    if (buffer.length < 44) {
      throw new Error('WAV file too small');
    }

    try {
      // 读取WAV头信息
      const channels = buffer.readUInt16LE(22);
      const sampleRate = buffer.readUInt32LE(24);
      const bitsPerSample = buffer.readUInt16LE(34);

      // 如果已经是正确格式，直接返回
      if (sampleRate === 16000 && channels === 1 && bitsPerSample === 16) {
        return buffer;
      }

      // 对于不符合要求的WAV，我们暂时抛出错误
      // 在实际实现中，这里可以进行更复杂的格式转换
      throw new Error(`WAV format not supported: ${sampleRate}Hz, ${channels} channels, ${bitsPerSample} bits. Required: 16000Hz, 1 channel, 16 bits.`);

    } catch (error) {
      throw new Error(`Failed to correct WAV format: ${error}`);
    }
  }
}