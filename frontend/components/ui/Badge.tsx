import React from 'react'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'error'
}

const variantStyles: Record<string, string> = {
  default:  'bg-verdant-surface-accent text-verdant-text-muted border-[#D5E8E0]',
  success:  'bg-verdant-surface-accent text-verdant-profit border-[#A8D5BE]',
  warning:  'bg-amber-50 text-amber-700 border-amber-200',
  error:    'bg-red-50 text-verdant-loss border-red-200',
}

export function Badge({ children, variant = 'default', className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}
