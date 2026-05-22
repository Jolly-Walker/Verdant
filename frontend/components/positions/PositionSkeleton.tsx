import React from 'react'

export function PositionSkeleton() {
  return (
    <div className="animate-pulse bg-verdant-surface border border-[#E5E0D8] rounded-xl p-5 shadow-organic h-56 flex flex-col justify-between">
      <div className="space-y-3">
        <div className="h-6 bg-verdant-surface-accent rounded w-1/3"></div>
        <div className="h-4 bg-verdant-surface-accent rounded w-1/2"></div>
      </div>
      <div className="h-10 bg-verdant-surface-accent rounded w-1/4 self-end"></div>
    </div>
  )
}
