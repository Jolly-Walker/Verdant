import React from 'react'

interface HealthFactorProps {
  value: number
}

export function HealthFactor({ value }: HealthFactorProps) {
  let colorClass = 'text-red-400'

  if (value >= 2.0) {
    colorClass = 'text-emerald-400'
  } else if (value >= 1.2) {
    colorClass = 'text-amber-400'
  }

  return (
    <div className="flex flex-col items-end">
      <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Health Factor</p>
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${colorClass.replace('text', 'bg')}`} />
        <p className={`font-medium ${colorClass}`}>
          {value.toFixed(2)}
        </p>
      </div>
    </div>
  )
}
