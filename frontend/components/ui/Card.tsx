import type React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className = '', hover = false }: CardProps) {
  return (
    <div
      className={`bg-verdant-surface border border-verdant-rule rounded-xl p-5 shadow-organic ${
        hover
          ? 'hover:shadow-organic-lg hover:border-verdant-rule-strong transition-[box-shadow,border-color]'
          : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
