import React from 'react'

interface HealthFactorProps {
  value: number
}

export function HealthFactor({ value }: HealthFactorProps) {
  let colorClass = 'text-verdant-loss'

  if (value >= 2.0) {
    colorClass = 'text-verdant-profit'
  } else if (value >= 1.2) {
    colorClass = 'text-amber-600'
  }

  return (
    <div className="flex flex-col items-end">
      <p className="text-xs text-verdant-text-muted uppercase tracking-wider font-semibold mb-1">Health Factor</p>
      <div className="flex items-center gap-1.5 font-mono">
        <span className={`h-1.5 w-1.5 rounded-full ${colorClass.replace('text', 'bg')}`} />
        <p className={`font-medium ${colorClass}`}>
          {value.toFixed(2)}
        </p>
      </div>
    </div>
  )
}
