
import React, { useState, forwardRef, useImperativeHandle, useRef } from 'react';
import { FileUpload, type FileUploadHandle } from './FileUpload';
import { AudioRecorder, type AudioRecorderHandle } from './AudioRecorder';
import { UploadIcon } from './icons/UploadIcon';
import { MicrophoneIcon } from './icons/MicrophoneIcon';

interface AudioUploaderProps {
  onFileChange: (file: File | null) => void;
  onRecordingChange: (isRecording: boolean) => void;
  disabled?: boolean;
  onRecordingError: (message: string) => void;
  theme: 'light' | 'dark';
  selectedDeviceId: string;
}

export interface AudioUploaderHandle {
  stopRecording: () => void;
  startRecording: () => void;
  clearInput: () => void;
}

export const AudioUploader = forwardRef<AudioUploaderHandle, AudioUploaderProps>(({ onFileChange, onRecordingChange, disabled, onRecordingError, theme, selectedDeviceId }, ref) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'record'>('record');
  const recorderRef = useRef<AudioRecorderHandle>(null);
  const uploaderRef = useRef<FileUploadHandle>(null);

  useImperativeHandle(ref, () => ({
    stopRecording: () => {
      recorderRef.current?.stopRecording();
    },
    startRecording: () => {
      recorderRef.current?.startRecording();
    },
    clearInput: () => {
      uploaderRef.current?.clear();
    }
  }));

  const handleFileSelect = (selectedFile: File) => {
    onFileChange(selectedFile);
  };
  
  return (
    <div className="p-4 rounded-lg bg-base-200 border border-base-300">
      {/* Tab switcher */}
      <div role="tablist" aria-label="Audio input method">
        <div className="flex -mx-4 -mt-4 mb-4 border-b border-base-300">
          <button
            onClick={() => setActiveTab('record')}
            className={`flex-1 flex items-center justify-center gap-2 p-3 text-center font-medium transition-colors ${activeTab === 'record' ? 'font-semibold text-brand-primary' : 'text-content-200 hover:bg-base-300/50'}`}
            aria-selected={activeTab === 'record'}
            role="tab"
          >
            <MicrophoneIcon className="w-5 h-5" />
            <span>录音</span>
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 flex items-center justify-center gap-2 p-3 text-center font-medium transition-colors ${activeTab === 'upload' ? 'font-semibold text-brand-primary' : 'text-content-200 hover:bg-base-300/50'}`}
            aria-selected={activeTab === 'upload'}
            role="tab"
          >
            <UploadIcon className="w-5 h-5" />
            <span>文件上传</span>
          </button>
        </div>
      </div>
    
      <div>
        <div className={activeTab === 'upload' ? 'block' : 'hidden'} role="tabpanel">
          <FileUpload 
            ref={uploaderRef}
            onFileSelect={handleFileSelect} 
            disabled={disabled} 
          />
        </div>
        
        <div className={activeTab === 'record' ? 'block' : 'hidden'} role="tabpanel">
          <div className="relative flex flex-col items-center justify-center w-full text-center transition-all duration-300">
            <AudioRecorder 
              ref={recorderRef}
              onFileChange={onFileChange}
              onRecordingChange={onRecordingChange}
              disabled={disabled}
              onRecordingError={onRecordingError}
              theme={theme}
              selectedDeviceId={selectedDeviceId}
            />
          </div>
        </div>
      </div>
    </div>
  );
});
