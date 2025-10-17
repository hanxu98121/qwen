import React, { useEffect } from 'react';
import { CloseIcon } from './icons/CloseIcon';

interface ToastProps {
  message: string;
  onClose: () => void;
  type?: 'error' | 'success';
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose, type = 'error', duration = 5000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => {
      clearTimeout(timer);
    };
  }, [onClose, duration]);

  const baseClasses = "fixed bottom-5 right-5 w-full max-w-sm p-4 text-white rounded-lg shadow-lg flex items-start justify-between animate-fade-in-up";
  const typeClasses = type === 'error'
    ? 'bg-red-600'
    : 'bg-brand-secondary';
  const buttonHoverClass = type === 'error' ? 'hover:bg-red-700' : 'hover:bg-brand-primary';

  return (
    <div className={`${baseClasses} ${typeClasses}`}>
      <p className="flex-grow pr-4">{message}</p>
      <button onClick={onClose} className={`p-1 -m-1 rounded-full ${buttonHoverClass}`}>
        <CloseIcon className="w-5 h-5" />
      </button>
      <style>{`
        @keyframes fade-in-up {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};