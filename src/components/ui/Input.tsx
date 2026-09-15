import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-bold text-[#3d5c52] mb-1.5 font-sans">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#4d665c] pointer-events-none">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`
              w-full min-h-[52px] px-4 ${icon ? 'pl-12' : ''} rounded-2xl text-base
              bg-white border-2 border-[#d0e8db] text-[#0f1f1a]
              placeholder-[#8aa89a] font-sans
              transition-all duration-200
              focus:outline-none focus:border-[#00a86b] focus:ring-4 focus:ring-[#00a86b]/15
              shadow-[0_2px_0_#e4f0e9]
              disabled:bg-[#f7fcf9] disabled:border-[#e4f0e9] disabled:text-[#8aa89a] disabled:cursor-not-allowed
              ${error ? 'border-[#ef4444] focus:border-[#ef4444] focus:ring-[#ef4444]/15' : ''}
              ${className}
            `}
            {...props}
          />
        </div>
        {error && <p className="mt-1.5 text-xs font-bold text-[#ef4444]">{error}</p>}
        {helperText && <p className="mt-1 text-xs text-[#6d877c]">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
