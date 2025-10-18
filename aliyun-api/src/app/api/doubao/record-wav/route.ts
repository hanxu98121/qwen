import { NextRequest, NextResponse } from 'next/server'

// WAV conversion utilities (ported from frontend)
function bufferToWav(buffer: AudioBuffer, sampleRate: number = 16000): Blob {
  const numChannels = 1; // Force mono for ASR
  const targetSampleRate = sampleRate;
  const numSamples = Math.floor(buffer.length * targetSampleRate / buffer.sampleRate);
  const dataLength = numSamples * numChannels * 2; // 16-bit samples
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

  // Resample and convert to mono
  const originalData = buffer.getChannelData(0); // Use first channel
  const resampledData = new Float32Array(numSamples);

  // Simple linear interpolation resampling
  const ratio = buffer.sampleRate / targetSampleRate;
  for (let i = 0; i < numSamples; i++) {
    const sourceIndex = i * ratio;
    const index = Math.floor(sourceIndex);
    const fraction = sourceIndex - index;

    if (index + 1 < originalData.length) {
      resampledData[i] = originalData[index] * (1 - fraction) + originalData[index + 1] * fraction;
    } else {
      resampledData[i] = originalData[index] || 0;
    }
  }

  // Write samples as 16-bit PCM
  for (let i = 0; i < numSamples; i++) {
    let sample = Math.max(-1, Math.min(1, resampledData[i]));
    sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(pos, sample, true);
    pos += 2;
  }

  return new Blob([arrBuffer], { type: 'audio/wav' });
}

async function convertAudioToWav(audioBuffer: ArrayBuffer, originalMimeType: string, targetSampleRate: number = 16000): Promise<Blob> {
  try {
    // Create audio context for processing
    const audioContext = new (globalThis.AudioContext || (globalThis as any).webkitAudioContext)();

    // Decode the audio data
    const decodedBuffer = await audioContext.decodeAudioData(audioBuffer);

    // Convert to WAV with optimal ASR settings (16kHz mono)
    const wavBlob = bufferToWav(decodedBuffer, targetSampleRate);

    // Clean up audio context
    await audioContext.close();

    return wavBlob;
  } catch (error) {
    console.error('Error converting audio to WAV:', error);
    throw new Error('Failed to convert audio to WAV format');
  }
}

export async function POST(request: NextRequest) {
  try {
    // Handle CORS preflight request
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    // Only handle POST requests
    if (request.method !== 'POST') {
      return NextResponse.json(
        { success: false, error: 'Method not allowed' },
        { status: 405 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null
    const sampleRate = parseInt(formData.get('sampleRate') as string) || 16000

    if (!audioFile) {
      return NextResponse.json(
        { success: false, error: '需要提供音频文件' },
        { status: 400 }
      )
    }

    console.log('Processing audio for WAV conversion:', audioFile.name)
    console.log('Original MIME type:', audioFile.type)
    console.log('Target sample rate:', sampleRate)

    // Convert file to array buffer
    const audioBuffer = await audioFile.arrayBuffer()

    // Convert to WAV format
    const wavBlob = await convertAudioToWav(audioBuffer, audioFile.type, sampleRate)

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const wavFileName = `recording-${timestamp}.wav`

    // Convert blob to buffer for response
    const wavBuffer = await wavBlob.arrayBuffer()
    const buffer = Buffer.from(wavBuffer)

    console.log('WAV conversion completed successfully')
    console.log('Original size:', audioFile.size, 'bytes')
    console.log('WAV size:', buffer.length, 'bytes')

    // Return the WAV file
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Disposition': `attachment; filename="${wavFileName}"`,
        'Access-Control-Allow-Origin': '*',
        'Content-Length': buffer.length.toString(),
      },
    })

  } catch (error) {
    console.error('WAV conversion error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

    return NextResponse.json(
      {
        success: false,
        error: 'WAV转换失败',
        details: errorMessage,
      },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    )
  }
}