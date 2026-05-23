'use client'

import React, { useState } from 'react'
import { Position } from '@/types/position'
import { TokenState } from '@/lib/sequenceBuilder/types'
import { formatUsd, formatToken } from '@/lib/utils/formatting'

interface RepayAndWithdrawCardProps {
  tokenIn: TokenState
  userPositions: Position[]
  selectedPositionId?: string
  isActive: boolean
  onSelect: (positionId: string, tokenOut: TokenState) => void
  onFocus: () => void
}

export function RepayAndWithdrawCard({
  tokenIn,
  userPositions,
  selectedPositionId,
  isActive,
  onSelect,
  onFocus
}: RepayAndWithdrawCardProps) {
  const matchingBorrows = userPositions.filter(
    p => p.positionType === 'borrow' &&
         p.chain === tokenIn.chain &&
         p.asset === tokenIn.token
  )

  const [selectedId, setSelectedId] = useState<string | null>(selectedPositionId || null)

  const getCollateralPosition = (borrowPos: Position) => {
    const potentialCollaterals = userPositions.filter(
      p => p.chain === borrowPos.chain &&
           p.protocol === borrowPos.protocol &&
           p.positionType === 'supply'
    )
    return potentialCollaterals.length > 0
      ? [...potentialCollaterals].sort((a, b) => b.amountUsd - a.amountUsd)[0]
      : undefined
  }

  const handleRowClick = (pos: Position) => {
    setSelectedId(pos.id)
    const collateral = getCollateralPosition(pos)
    if (collateral) {
      onSelect(pos.id, {
        token: collateral.asset,
        chain: collateral.chain,
        amount: collateral.amount,
        amountUsd: collateral.amountUsd,
        sourcePositionId: collateral.id,
        positionType: 'supply'
      })
    } else {
      // Emit fallback empty state if no collateral found
      onSelect(pos.id, {
        token: 'WETH', // default fallback
        chain: pos.chain,
        amount: 0,
        amountUsd: 0,
        positionType: 'supply'
      })
    }
  }

  const selectedPosition = userPositions.find(p => p.id === selectedPositionId)
  const collateralPosition = selectedPosition ? getCollateralPosition(selectedPosition) : undefined

  // Complete (read-only) view
  if (!isActive && selectedPosition) {
    const displayProtocol = selectedPosition.protocol === 'aave' ? 'Aave' : selectedPosition.protocol === 'morpho' ? 'Morpho' : selectedPosition.protocol
    return (
      <div
        onClick={onFocus}
        className="w-56 min-h-48 bg-verdant-surface-accent border border-[#D5E8E0] rounded-xl p-4 cursor-pointer hover:border-verdant-moss transition-all flex flex-col justify-between"
      >
        <div>
          <div className="text-[10px] text-verdant-text-muted uppercase tracking-wider font-semibold mb-2">
            REPAY & WITHDRAW
          </div>
          <div className="font-semibold text-verdant-text-primary text-sm leading-snug">
            {displayProtocol} {selectedPosition.asset} debt · <span className="font-mono">{formatUsd(selectedPosition.amountUsd)}</span>
          </div>
        </div>
        <div className="mt-4 pt-2 border-t border-[#D5E8E0]">
          {collateralPosition ? (
            <div className="text-xs text-verdant-text-primary">
              → Frees:{' '}
              <span className="font-mono font-semibold">
                {formatToken(collateralPosition.amount)} {collateralPosition.asset}
              </span>{' '}
              <span className="text-verdant-text-muted">
                ({formatUsd(collateralPosition.amountUsd)})
              </span>
            </div>
          ) : (
            <div className="text-xs text-verdant-loss">
              Collateral position not found — proceed manually.
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="w-56 min-h-48 bg-verdant-surface border-2 border-verdant-moss rounded-xl p-4 shadow-organic flex flex-col justify-between">
      <div>
        <div className="text-[10px] text-verdant-text-muted uppercase tracking-wider font-semibold mb-2">
          REPAY & WITHDRAW
        </div>

        <div className="space-y-2 max-h-36 overflow-y-auto pr-1 scrollbar-thin">
          {matchingBorrows.map(pos => {
            const isSel = pos.id === selectedId
            const displayProtocol = pos.protocol === 'aave' ? 'Aave V3' : pos.protocol === 'morpho' ? 'Morpho' : pos.protocol
            const col = getCollateralPosition(pos)
            return (
              <div
                key={pos.id}
                onClick={() => handleRowClick(pos)}
                className={`p-2 rounded text-xs cursor-pointer border transition-colors ${
                  isSel
                    ? 'bg-verdant-surface-accent border-verdant-moss border-l-2'
                    : 'border-[#E5E0D8] hover:bg-[#FAF9F6]'
                }`}
              >
                <div className="font-medium text-verdant-text-primary leading-snug">
                  {displayProtocol} — {pos.asset} Debt
                </div>
                <div className="flex items-center justify-between mt-1 text-[10px]">
                  <span className="text-verdant-text-muted capitalize">{pos.chain}</span>
                  <span className="font-mono font-semibold text-verdant-loss">
                    {formatUsd(pos.amountUsd)}
                  </span>
                </div>
                {col && (
                  <div className="text-[9px] text-verdant-profit mt-1">
                    Frees {formatToken(col.amount)} {col.asset}
                  </div>
                )}
              </div>
            )
          })}

          {matchingBorrows.length === 0 && (
            <div className="text-xs text-verdant-text-muted text-center py-6">
              No matching debt positions on {tokenIn.chain}.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
