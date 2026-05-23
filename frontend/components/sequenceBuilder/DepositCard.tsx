'use client'

import React, { useState } from 'react'
import { TokenState, DepositDestination } from '@/lib/sequenceBuilder/types'
import { getDepositDestinations } from '@/lib/sequenceBuilder/destinations'
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
  const destinations = getDepositDestinations(tokenIn.token, tokenIn.chain)
  const [selectedId, setSelectedId] = useState<string | null>(selectedDestination?.id || null)

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
            {selectedDestination.chain} · <span className="font-mono font-semibold text-verdant-profit">{formatPercent(selectedDestination.apy)} APY</span>
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
          {destinations.map(dest => {
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
                <div className="font-medium text-verdant-text-primary leading-snug">
                  {dest.displayName}
                </div>
                <div className="flex items-center justify-between mt-1 text-[10px]">
                  <span className="text-verdant-text-muted capitalize">{dest.chain}</span>
                  <span className="font-mono font-semibold text-verdant-profit">
                    {formatPercent(dest.apy)}
                  </span>
                </div>
              </div>
            )}
          )}
          
          {destinations.length === 0 && (
            <div className="text-xs text-verdant-text-muted text-center py-6">
              No supported destinations for {tokenIn.token} on {tokenIn.chain}.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
