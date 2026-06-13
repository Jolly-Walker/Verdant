import React from 'react'

interface HealthFactorProps {
  /** Aave-style health factor. e.g. 1.05 = near liquidation, 2.5 = safe, Infinity = no debt. */
  value: number
  /** Optional override for the upper bound of the meter scale (defaults to 3.0). */
  maxScale?: number
  /** Hide the small "Health Factor" caption (e.g. when used inline). */
  showLabel?: boolean
}

type Zone = 'danger' | 'caution' | 'healthy'

// Risk thresholds (Aave-style): < 1.2 danger, 1.2–2.0 caution, >= 2.0 healthy.
const DANGER_MAX = 1.2
const CAUTION_MAX = 2.0

function classifyZone(value: number): Zone {
  if (value >= CAUTION_MAX) return 'healthy'
  if (value >= DANGER_MAX) return 'caution'
  return 'danger'
}

const ZONE_TEXT: Record<Zone, string> = {
  danger: 'text-verdant-loss',
  caution: 'text-amber-600',
  healthy: 'text-verdant-profit',
}

const ZONE_BG: Record<Zone, string> = {
  danger: 'bg-verdant-loss',
  caution: 'bg-amber-600',
  healthy: 'bg-verdant-profit',
}

export function HealthFactor({ value, maxScale = 3.0, showLabel = true }: HealthFactorProps) {
  // Guard against NaN / Infinity / non-finite input.
  const isFinite = Number.isFinite(value)
  // A non-finite or very large value means "no debt" -> fully healthy, meter pinned to the end.
  const safeValue = isFinite ? Math.max(value, 0) : maxScale

  const zone = classifyZone(safeValue)
  const textClass = ZONE_TEXT[zone]
  const barClass = ZONE_BG[zone]

  // Position the indicator across the meter [0, maxScale], clamped so huge HFs don't overflow.
  const fraction = Math.min(safeValue / maxScale, 1)
  const indicatorPct = Math.max(0, Math.min(fraction * 100, 100))

  // Zone widths as % of the scale, so the colored backdrop matches the thresholds.
  const dangerWidthPct = Math.min((DANGER_MAX / maxScale) * 100, 100)
  const cautionWidthPct = Math.max(Math.min((CAUTION_MAX / maxScale) * 100, 100) - dangerWidthPct, 0)
  const healthyWidthPct = Math.max(100 - dangerWidthPct - cautionWidthPct, 0)

  const displayValue = isFinite ? safeValue.toFixed(2) : '∞'
  const ariaLabel = `Health factor ${displayValue}, ${zone}`

  return (
    <div className="flex flex-col items-end gap-1">
      {showLabel && (
        <p className="text-xs text-verdant-text-muted uppercase tracking-wider font-semibold">
          Health Factor
        </p>
      )}

      <div className="flex items-center gap-2">
        {/* Segmented risk meter */}
        <div
          className="relative h-1.5 w-20 rounded-full overflow-hidden"
          role="meter"
          aria-valuenow={isFinite ? Number(safeValue.toFixed(2)) : maxScale}
          aria-valuemin={0}
          aria-valuemax={maxScale}
          aria-label={ariaLabel}
          title={`Health factor: ${displayValue}`}
        >
          {/* Muted zone backdrop: danger / caution / healthy bands */}
          <div className="absolute inset-0 flex">
            <span className="h-full bg-verdant-loss/25" style={{ width: `${dangerWidthPct}%` }} />
            <span className="h-full bg-amber-600/25" style={{ width: `${cautionWidthPct}%` }} />
            <span className="h-full bg-verdant-profit/25" style={{ width: `${healthyWidthPct}%` }} />
          </div>

          {/* Filled portion up to the current value, tinted by the active zone */}
          <div
            className={`absolute inset-y-0 left-0 ${barClass} opacity-80 transition-[width] duration-300 ease-out`}
            style={{ width: `${indicatorPct}%` }}
          />

          {/* Moving indicator marker */}
          <div
            className="absolute top-1/2 h-2.5 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-verdant-text-primary shadow-organic transition-[left] duration-300 ease-out"
            style={{ left: `${indicatorPct}%` }}
          />
        </div>

        <p className={`font-mono text-sm font-medium tabular-nums ${textClass}`}>
          {displayValue}
        </p>
      </div>
    </div>
  )
}
