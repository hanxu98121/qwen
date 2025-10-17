import React, { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { MicrophoneIcon } from './icons/MicrophoneIcon';
import { StopIcon } from './icons/StopIcon';
import { setCachedRecording } from '../services/cacheService';

interface AudioRecorderProps {
  onFileChange: (file: File | null) => void;
  onRecordingChange: (isRecording: boolean) => void;
  disabled?: boolean;
  onRecordingError: (message: string) => void;
  theme: 'light' | 'dark';
  selectedDeviceId: string;
}

export interface AudioRecorderHandle {
  stopRecording: () => void;
  startRecording: () => void;
}

const formatTime = (timeInSeconds: number) => {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const AudioRecorder = forwardRef<AudioRecorderHandle, AudioRecorderProps>(({ onFileChange, onRecordingChange, disabled, onRecordingError, theme, selectedDeviceId }, ref) => {
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording'>('idle');
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);


  useEffect(() => {
    onRecordingChange(recordingStatus === 'recording');
  }, [recordingStatus, onRecordingChange]);
  
  const drawIdleLine = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const parent = canvas.parentElement;
    if (!context || !parent) return;

    if (canvas.width !== parent.clientWidth || canvas.height !== parent.clientHeight) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }
    
    context.clearRect(0, 0, canvas.width, canvas.height);

    const computedStyle = getComputedStyle(canvas);
    const strokeColor = computedStyle.getPropertyValue('--color-brand-primary').trim() || '#10b981';

    context.lineWidth = 2.5;
    context.strokeStyle = strokeColor;
    context.beginPath();
    context.moveTo(0, canvas.height / 2);
    context.lineTo(canvas.width, canvas.height / 2);
    context.stroke();
  }, []);

  const cleanupAudio = useCallback(() => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    analyserRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error);
    }
    audioContextRef.current = null;
    
    if (canvasRef.current) {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        context?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

  useEffect(() => {
    if (recordingStatus === 'recording') {
        const animationLoop = () => {
            if (!analyserRef.current || !canvasRef.current || !dataArrayRef.current) {
                return;
            }
            const analyser = analyserRef.current;
            const canvas = canvasRef.current;
            const dataArray = dataArrayRef.current;
            const context = canvas.getContext('2d');
            if (!context) return;
            
            const parent = canvas.parentElement;
            if (parent && (canvas.width !== parent.clientWidth || canvas.height !== parent.clientHeight)) {
                canvas.width = parent.clientWidth;
                canvas.height = parent.clientHeight;
            }

            const computedStyle = getComputedStyle(canvas);
            const strokeColor = computedStyle.getPropertyValue('--color-brand-primary').trim() || '#10b981';

            analyser.getByteTimeDomainData(dataArray);
            
            context.clearRect(0, 0, canvas.width, canvas.height);

            context.lineWidth = 2.5;
            context.strokeStyle = strokeColor;
            context.beginPath();
            const sliceWidth = (canvas.width * 1.0) / analyser.fftSize;
            let x = 0;
            for (let i = 0; i < analyser.fftSize; i++) {
                const v = dataArray[i] / 128.0;
                const y = (v * canvas.height) / 2;
                if (i === 0) {
                    context.moveTo(x, y);
                } else {
                    context.lineTo(x, y);
                }
                x += sliceWidth;
            }
            context.lineTo(canvas.width, canvas.height / 2);
            context.stroke();

            animationFrameIdRef.current = requestAnimationFrame(animationLoop);
        };
        
        animationFrameIdRef.current = requestAnimationFrame(animationLoop);
    } else {
        drawIdleLine();
    }

    return () => {
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
        }
    };
}, [recordingStatus, theme, drawIdleLine]);

  const startTimer = () => {
    stopTimer();
    setRecordingTime(0);
    timerIntervalRef.current = window.setInterval(() => {
        setRecordingTime(prevTime => prevTime + 1);
    }, 1000);
  }

  const stopTimer = () => {
    if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
    }
  }

  const handleStopRecording = useCallback(() => {
    if (recordingStatus !== 'recording' || !mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    setRecordingStatus('idle');
    stopTimer();
    cleanupAudio();
  }, [recordingStatus, cleanupAudio]);

  const handleStartRecording = async () => {
    if (recordingStatus === 'recording' || !navigator.mediaDevices) {
        onRecordingError("您的浏览器不支持录音功能。");
        return;
    }
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: selectedDeviceId === 'default' ? undefined : { exact: selectedDeviceId },
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          }
        });
        
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
        
        const source = audioContext.createMediaStreamSource(stream);
        sourceRef.current = source;
        
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;
        
        const bufferLength = analyser.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);
        
        source.connect(analyser);

        setRecordingStatus('recording');
        startTimer();
        
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        audioChunksRef.current = [];
        
        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };
        
        recorder.onstop = () => {
            const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
            const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
            const fileExtension = mimeType.split('/')[1]?.split(';')[0] || 'webm';
            
            const now = new Date();
            const year = now.getFullYear();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const day = now.getDate().toString().padStart(2, '0');
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            const formattedDate = `${year}-${month}-${day}_${hours}-${minutes}`;
            const audioFile = new File([audioBlob], `recording-${formattedDate}.${fileExtension}`, { type: mimeType });
            
            setCachedRecording(audioFile).catch(err => {
              console.error("Failed to cache recording:", err);
            });

            onFileChange(audioFile);

            audioChunksRef.current = [];
            stream.getTracks().forEach(track => track.stop());
        };
        
        recorder.start();
    } catch (err) {
        console.error("Error accessing microphone:", err);
        setRecordingStatus('idle');
        onRecordingError("麦克风访问被拒绝或不可用。");
    }
  };

  useImperativeHandle(ref, () => ({
    stopRecording: handleStopRecording,
    startRecording: handleStartRecording,
  }));

  return (
    <div className="flex flex-col min-[250px]:flex-row items-stretch w-full gap-4">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="flex items-baseline gap-3 mb-2">
            <p className="text-xl sm:text-2xl font-mono text-content-100 tracking-wider">
              {formatTime(recordingTime)}
            </p>
        </div>
        <button
          onClick={recordingStatus === 'idle' ? handleStartRecording : handleStopRecording}
          disabled={disabled}
          title={recordingStatus === 'idle' ? '按住空格键快捷录音' : '松开空格键快捷停止'}
          className={`flex-shrink-0 flex items-center justify-center w-full min-[250px]:w-36 h-12 sm:h-14 px-4 py-2 font-semibold text-white transition-colors duration-300 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-base-200 ${
            recordingStatus === 'idle' 
              ? 'bg-brand-primary hover:bg-brand-secondary focus:ring-brand-primary' 
              : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {recordingStatus === 'idle' ? (
            <>
              <MicrophoneIcon className="w-6 h-6 mr-2" />
              <div className="flex flex-col items-center">
                <span className="leading-tight">开始</span>
                <span className="mt-1 text-xs font-normal opacity-80 border border-white/40 rounded px-1.5">
                  SPACE
                </span>
              </div>
            </>
          ) : (
            <>
              <StopIcon className="w-6 h-6 mr-2" />
              <span>停止录音</span>
            </>
          )}
        </button>
      </div>
      <div className="flex flex-col flex-grow text-left">
        <div className="w-full h-20 sm:h-24 bg-base-100 rounded-md overflow-hidden">
            <canvas ref={canvasRef} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
});