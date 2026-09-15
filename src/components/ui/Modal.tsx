import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal = ({ isOpen, onClose, title, children, footer, size = 'md' }: ModalProps) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 bg-[#0f1f1a]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className={`w-full bg-white rounded-3xl border border-[#e4f0e9] shadow-[0_16px_48px_rgba(0,100,65,0.14)] max-h-[90vh] flex flex-col overflow-hidden ${sizeStyles[size]}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#e4f0e9] bg-[#f7fcf9]">
          {title && <h2 className="text-xl sm:text-2xl font-bold text-[#0f1f1a] font-display">{title}</h2>}
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[#4d665c] hover:bg-[#e3f6ec] hover:text-[#007048] transition cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">{children}</div>

        {/* Footer */}
        {footer && <div className="px-6 py-4 border-t border-[#e4f0e9] bg-[#f7fcf9]">{footer}</div>}
      </div>
    </div>
  );
};
