import React from 'react'

interface WarningBannerProps {
  message: string
  variant?: 'warning' | 'error'
}

export function WarningBanner({ message, variant = 'warning' }: WarningBannerProps) {
  const styles = variant === 'error'
    ? 'bg-red-50 border-red-200 text-verdant-loss'
    : 'bg-amber-50 border-amber-200 text-amber-700'

  return (
    <div className={`border text-sm px-4 py-2 rounded-lg ${styles}`}>
      ⚠️ {message}
    </div>
  )
}
