import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
}

export function Card({ children, className = '', hover = false }: CardProps) {
  return (
    <div
      className={`bg-verdant-surface border border-[#E5E0D8] rounded-xl p-5 shadow-organic ${
        hover ? 'hover:shadow-organic-lg transition-shadow' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}
