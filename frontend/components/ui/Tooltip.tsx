import React, { useState } from 'react'

interface TooltipProps {
  children: React.ReactNode
  content: string
  className?: string
}

export function Tooltip({ children, content, className = '' }: TooltipProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none z-50">
          <div className="bg-verdant-black text-verdant-canvas text-xs rounded-lg px-3 py-1.5 whitespace-nowrap border border-verdant-black shadow-lg">
            {content}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
            <div className="border-4 border-transparent border-t-verdant-black" />
          </div>
        </div>
      )}
    </div>
  )
}
