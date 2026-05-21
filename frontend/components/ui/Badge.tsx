import React from 'react'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'error'
}

const variantStyles: Record<string, string> = {
  default: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  success: 'bg-emerald-900/40 text-emerald-300 border-emerald-800',
  warning: 'bg-amber-900/40 text-amber-300 border-amber-800',
  error: 'bg-red-900/40 text-red-300 border-red-800',
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
