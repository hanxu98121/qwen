
import React from 'react';
import { KeyboardIcon } from './icons/KeyboardIcon';
import { SettingsIcon } from './icons/SettingsIcon';

interface HeaderProps {
  onSettingsClick: () => void;
  onPipClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onSettingsClick, onPipClick }) => {

  return (
    <header className="flex items-center justify-between">
      <div className="flex-1"></div>
      <div className="flex items-center justify-center flex-shrink-0 mx-4">
        <a href="https://qwen3-asr-studio.pages.dev/" target="_blank" rel="noopener noreferrer">
          <img
            src="https://modelscope.oss-cn-beijing.aliyuncs.com/resource/00EE8C99-9C05-4236-A6D0-B58FF172D31B.png"
            alt="Qwen3 ASR Studio"
            className="h-12 sm:h-16 w-auto cursor-pointer"
          />
        </a>
      </div>
      <div className="flex-1 flex justify-end items-center gap-2">
        <button
          onClick={onPipClick}
          title="输入法模式 (画中画)"
          aria-label="打开输入法模式"
          className="flex items-center gap-2 p-2 sm:px-3 text-sm font-medium rounded-lg text-content-200 hover:bg-base-200 hover:text-content-100 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary"
        >
          <KeyboardIcon className="w-5 h-5" />
          <span className="hidden sm:inline">输入法模式</span>
        </button>
        <button
          onClick={onSettingsClick}
          title="设置"
          aria-label="打开设置"
          className="p-2 rounded-full text-content-200 hover:bg-base-200 hover:text-content-100 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary"
        >
          <SettingsIcon className="w-6 h-6" />
        </button>
      </div>
    </header>
  );
};
