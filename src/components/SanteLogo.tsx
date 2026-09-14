import React from 'react';
interface SanteLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

export default function SanteLogo({ className = '', size = 'md', showSubtitle = true }: SanteLogoProps) {
  const logoSize = size === 'sm' ? 'h-11 w-11' : size === 'lg' ? 'h-24 w-24' : 'h-16 w-16';

  return (
    <div className={`flex items-center select-none ${className}`}>
      <img
        src="/logo.jpeg"
        alt="Santé+"
        className={`${logoSize} object-contain object-left`}
      />
      {showSubtitle && (
        <span className="sr-only">Bénin, plateforme e-santé</span>
      )}
    </div>
  );
}
