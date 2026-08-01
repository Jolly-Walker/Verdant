import type React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

const variantStyles: Record<string, string> = {
  default: 'bg-verdant-paper-deep/60 text-verdant-text-muted border-verdant-rule',
  success: 'bg-verdant-profit/10 text-verdant-profit border-verdant-profit/25',
  warning: 'bg-verdant-caution/10 text-verdant-caution border-verdant-caution/25',
  error: 'bg-verdant-loss/10 text-verdant-loss border-verdant-loss/25',
};

export function Badge({ children, variant = 'default', className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
