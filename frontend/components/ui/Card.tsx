import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
}

export function Card({ children, className = '', hover = false }: CardProps) {
  return (
    <div
      className={`bg-zinc-900 border border-zinc-800 rounded-xl p-5 ${
        hover ? 'hover:border-zinc-700 transition-colors' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}
