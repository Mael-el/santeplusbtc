import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  actionButton?: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ title, description, icon, actionButton, className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          card bg-white rounded-2xl p-6 border border-[#e4f0e9]
          shadow-[0_5px_0_#c8e6d5,0_10px_24px_rgba(0,100,65,0.08)]
          hover:shadow-[0_9px_0_#c8e6d5,0_18px_36px_rgba(0,100,65,0.14)]
          hover:-translate-y-1 active:translate-y-0.5
          transition-all duration-200
          ${className}
        `}
        {...props}
      >
        {icon && <div className="text-3xl mb-3 text-[#00a86b]">{icon}</div>}
        {title && <h3 className="text-xl font-bold text-[#0f1f1a] mb-2 font-display">{title}</h3>}
        {description && <p className="text-sm text-[#4d665c] mb-4 font-sans leading-relaxed">{description}</p>}
        {children}
        {actionButton && <div className="mt-4">{actionButton}</div>}
      </div>
    );
  }
);

Card.displayName = 'Card';
