import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'urgency';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    className = '',
    disabled = false,
    children,
    ...props
  }, ref) => {
    const baseStyles = 'btn font-bold inline-flex items-center justify-center gap-2 cursor-pointer select-none transition-all duration-200';

    const variantStyles = {
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      ghost: 'bg-white text-[#007048] border-2 border-[#e4f0e9] hover:bg-[#f1faf6] hover:-translate-y-0.5 active:translate-y-0.5 shadow-sm',
      danger: 'btn-danger',
      urgency: 'btn-danger rounded-full',
    };

    const sizeStyles = {
      sm: 'px-4 py-2 text-sm min-h-[42px] rounded-xl',
      md: 'px-6 py-3 text-base min-h-[50px] rounded-2xl',
      lg: 'px-8 py-4 text-lg min-h-[56px] rounded-2xl',
    };

    const disabledStyles = disabled || loading ? 'opacity-50 cursor-not-allowed pointer-events-none' : '';
    const widthStyles = fullWidth ? 'w-full' : '';

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${disabledStyles} ${widthStyles} ${className}`}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
