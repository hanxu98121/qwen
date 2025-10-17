// FFmpeg音频转换工具 - Vercel Serverless版本
import ffmpeg from '@ffmpeg/ffmpeg';

export class FFmpegConverter {
  /**
   * 设置FFmpeg路径 (Vercel需要)
   */
  static setupFFmpeg(): void {
    // 设置FFmpeg路径为Vercel可用的路径
    ffmpeg.setFfmpegPath('/opt/ffmpeg/ffmpeg');
    ffmpeg.setFfprobePath('/opt/ffmpeg/ffprobe');
  }

  /**
   * 转换音频为豆包要求的格式
   */
  static async convertToDoubaoFormat(
    inputBuffer: Buffer,
    inputFormat?: string
  ): Promise<Buffer> {
    try {
      console.log('Starting audio conversion for Doubao API...');

      // 创建临时文件名
      const timestamp = Date.now();
      const inputFile = `input_${timestamp}.${inputFormat || 'mp3'}`;
      const outputFile = `output_${timestamp}.wav`;

      // 创建FFmpeg命令
      const command = ffmpeg()
        .input(inputBuffer)
        .outputOptions([
          '-f wav',
          '-acodec pcm_s16le',
          '-ac 1',
          '-ar 16000',
          '-y'
        ])
        .output(outputFile);

      // 执行转换
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        command.on('error', (error) => {
          console.error('FFmpeg conversion error:', error);
          reject(error);
        });

        command.on('end', () => {
          console.log('Audio conversion completed');
          resolve();
        });

        command.on('stderr', (stderrLine) => {
          console.log('FFmpeg stderr:', stderrLine);
        });

        command.on('stdout', (stdoutLine) => {
          chunks.push(Buffer.from(stdoutLine));
        });

        command.run();
      });

      // 等待转换完成并返回结果
      return Buffer.concat(chunks);

    } catch (error) {
      console.error('Audio conversion failed:', error);
      throw new Error(`音频转换失败: ${error}`);
    }
  }

  /**
   * 检查音频格式
   */
  static detectFormat(buffer: Buffer): string {
    // 简单的格式检测
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
   * 转换音频并确保符合豆包要求
   */
  static async ensureDoubaoFormat(buffer: Buffer): Promise<Buffer> {
    // 检查当前格式
    const validation = this.validateWavFormat(buffer);

    if (validation.isValid && !validation.needsConversion) {
      console.log('Audio already in Doubao-compatible format');
      return buffer;
    }

    console.log('Converting audio to Doubao-compatible format...');
    const currentFormat = this.detectFormat(buffer);
    return await this.convertToDoubaoFormat(buffer, currentFormat);
  }
}