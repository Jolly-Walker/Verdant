'use client'

import React, { useState, useEffect } from 'react'
import { TokenState, DepositDestination } from '@/lib/sequenceBuilder/types'
import { useDestinations } from '@/hooks/useDestinations'
import { formatPercent } from '@/lib/utils/formatting'

interface DepositCardProps {
  tokenIn: TokenState
  selectedDestination?: DepositDestination
  isActive: boolean
  onSelect: (dest: DepositDestination) => void
  onFocus: () => void
}

export function DepositCard({
  tokenIn,
  selectedDestination,
  isActive,
  onSelect,
  onFocus
}: DepositCardProps) {
  const { destinations, isLoading, error, refetch } = useDestinations(tokenIn.token, tokenIn.chain)
  const [selectedId, setSelectedId] = useState<string | null>(selectedDestination?.id || null)

  // Keep selectedId in sync with selectedDestination when selectedDestination changes
  useEffect(() => {
    if (selectedDestination) {
      setSelectedId(selectedDestination.id)
    } else {
      setSelectedId(null)
    }
  }, [selectedDestination])

  const handleRowClick = (dest: DepositDestination) => {
    setSelectedId(dest.id)
    onSelect(dest)
  }

  // Complete (read-only) view
  if (!isActive && selectedDestination) {
    return (
      <div
        onClick={onFocus}
        className="w-56 min-h-48 bg-verdant-surface-accent border border-[#D5E8E0] rounded-xl p-4 cursor-pointer hover:border-verdant-moss transition-all flex flex-col justify-between"
      >
        <div>
          <div className="text-[10px] text-verdant-text-muted uppercase tracking-wider font-semibold mb-2">
            DEPOSIT
          </div>
          <div className="font-semibold text-verdant-text-primary text-sm leading-snug">
            {selectedDestination.displayName}
          </div>
          <div className="text-xs text-verdant-text-muted mt-1 capitalize">
            {selectedDestination.chain} ·{' '}
            <span className="font-mono font-semibold text-verdant-profit">
              {formatPercent(selectedDestination.apy)}
            </span>
            {selectedDestination.apyMean30d != null && (
              <span className="font-mono text-verdant-text-muted ml-1">
                ({formatPercent(selectedDestination.apyMean30d)} 30d avg)
              </span>
            )}
            {selectedDestination.lockPeriodDays != null && (
              <span className="ml-1 text-amber-600">· 🔒 {selectedDestination.lockPeriodDays}d lock</span>
            )}
          </div>
        </div>
        <div className="mt-4 pt-2 border-t border-[#D5E8E0] font-mono text-xs text-verdant-text-muted">
          → {selectedDestination.outputTokenSymbol}
        </div>
      </div>
    )
  }

  return (
    <div className="w-56 min-h-48 bg-verdant-surface border-2 border-verdant-moss rounded-xl p-4 shadow-organic flex flex-col justify-between">
      <div>
        <div className="text-[10px] text-verdant-text-muted uppercase tracking-wider font-semibold mb-2">
          DEPOSIT
        </div>

        <div className="space-y-2 max-h-36 overflow-y-auto pr-1 scrollbar-thin">
          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-verdant-surface-accent rounded animate-pulse" />
              ))}
            </div>
          )}

          {error && !isLoading && (
            <div className="text-xs text-verdant-loss text-center py-4">
              Failed to load destinations. <button onClick={() => refetch()} className="underline font-semibold cursor-pointer">Retry</button>
            </div>
          )}

          {!isLoading && !error && destinations.map(dest => {
            const isSel = dest.id === selectedId
            return (
              <div
                key={dest.id}
                onClick={() => handleRowClick(dest)}
                className={`p-2 rounded text-xs cursor-pointer border transition-colors ${
                  isSel
                    ? 'bg-verdant-surface-accent border-verdant-moss border-l-2'
                    : 'border-[#E5E0D8] hover:bg-[#FAF9F6]'
                }`}
              >
                {/* Name row */}
                <div className="font-medium text-verdant-text-primary leading-snug flex items-center gap-1 flex-wrap">
                  {dest.displayName}
                  {dest.lockPeriodDays != null && (
                    <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200
                                     px-1 py-0.5 rounded font-semibold uppercase tracking-wide">
                      🔒 {dest.lockPeriodDays}d
                    </span>
                  )}
                  {dest.lockDescription && dest.lockPeriodDays == null && (
                    <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200
                                     px-1 py-0.5 rounded font-semibold uppercase tracking-wide">
                      🔒 Locked
                    </span>
                  )}
                </div>

                {/* APY row */}
                <div className="flex items-center justify-between mt-1 text-[10px]">
                  <span className="text-verdant-text-muted capitalize">{dest.chain}</span>
                  <div className="flex items-center gap-1.5">
                    {dest.apyMean30d != null && (
                      <span className="text-verdant-text-muted font-mono">
                        {formatPercent(dest.apyMean30d)} 30d
                      </span>
                    )}
                    <span className="font-mono font-semibold text-verdant-profit">
                      {formatPercent(dest.apy)}
                    </span>
                  </div>
                </div>

                {/* Reward tokens */}
                {dest.rewardTokens.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {dest.rewardTokens.slice(0, 3).map((addr, i) => (
                      <span
                        key={i}
                        className="text-[9px] bg-verdant-surface-accent text-verdant-text-muted
                                   border border-[#D5E8E0] px-1 py-0.5 rounded font-mono"
                      >
                        +{addr.slice(0, 6)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          
          {!isLoading && !error && destinations.length === 0 && (
            <div className="text-xs text-verdant-text-muted text-center py-6">
              No supported destinations for {tokenIn.token} on {tokenIn.chain}.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
