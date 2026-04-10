import React from 'react'

export function WarningBanner({ message }: { message: string }) {
  return (
    <div className="bg-amber-900/40 border border-amber-800 text-amber-200 text-sm px-4 py-2 rounded-lg">
      ⚠️ {message}
    </div>
  )
}
