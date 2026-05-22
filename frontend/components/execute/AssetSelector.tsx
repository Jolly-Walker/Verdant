'use client'

import React from 'react'
import { Position } from '@/types/position'
import { Card } from '@/components/ui/Card'
import { formatUsd, formatToken } from '@/lib/utils/formatting'
import { DEFAULT_MIN_USD_THRESHOLD } from '@/constants/settings'

interface AssetSelectorProps {
  positions: Position[]
  selectedPosition: Position | null
  onSelect: (p: Position) => void
  customAmount: string
  onAmountChange: (v: string) => void
}

export function AssetSelector({
  positions,
  selectedPosition,
  onSelect,
  customAmount,
  onAmountChange,
}: AssetSelectorProps) {
  const ethPositions = positions.filter((p) => p.chain === 'ethereum')
  const arbPositions = positions.filter((p) => p.chain === 'arbitrum')

  const amountNum = parseFloat(customAmount) || 0
  const amountUsd = selectedPosition
    ? (amountNum / selectedPosition.amount) * selectedPosition.amountUsd
    : 0
  const isBelowMinimum = amountUsd > 0 && amountUsd < DEFAULT_MIN_USD_THRESHOLD

  return (
    <div className="space-y-4">
      <h3 className="text-sm text-verdant-text-muted uppercase tracking-wider font-semibold">
        Select Asset to Move
      </h3>

      {positions.length === 0 ? (
        <Card className="text-center py-8">
          <p className="text-verdant-text-muted text-sm">No positions found to move</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {ethPositions.length > 0 && (
            <PositionGroup
              label="Ethereum"
              positions={ethPositions}
              selectedId={selectedPosition?.id}
              onSelect={onSelect}
            />
          )}
          {arbPositions.length > 0 && (
            <PositionGroup
              label="Arbitrum"
              positions={arbPositions}
              selectedId={selectedPosition?.id}
              onSelect={onSelect}
            />
          )}
        </div>
      )}

      {/* Amount input */}
      {selectedPosition && (
        <div className="space-y-2">
          <label className="text-sm text-verdant-text-muted block">Amount</label>
          <div className="relative">
            <input
              type="number"
              value={customAmount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder="0.00"
              step="any"
              min="0"
              max={selectedPosition.amount}
              className="w-full bg-verdant-surface border border-[#E5E0D8] rounded-md px-4 py-3 text-verdant-text-primary placeholder-verdant-text-muted/50 focus:outline-none focus:border-verdant-moss transition-colors font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              onClick={() => onAmountChange(selectedPosition.amount.toString())}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-verdant-moss hover:text-verdant-moss-dark font-semibold"
            >
              MAX
            </button>
          </div>
          <div className="flex justify-between text-xs font-mono text-verdant-text-muted">
            <span>
              ≈ {formatUsd(amountUsd)}
            </span>
            <span>
              Balance: {formatToken(selectedPosition.amount)} {selectedPosition.asset}
            </span>
          </div>
          {isBelowMinimum && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              ⚠️ Minimum transaction is ${DEFAULT_MIN_USD_THRESHOLD.toLocaleString()} to cover fees
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function PositionGroup({
  label,
  positions,
  selectedId,
  onSelect,
}: {
  label: string
  positions: Position[]
  selectedId?: string
  onSelect: (p: Position) => void
}) {
  return (
    <div>
      <p className="text-xs text-verdant-text-muted mb-2 font-semibold">{label}</p>
      <div className="space-y-2">
        {positions.map((p) => {
          const isSelected = selectedId === p.id
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                isSelected
                  ? 'bg-verdant-surface-accent border-verdant-moss text-verdant-text-primary'
                  : 'bg-verdant-surface border-[#E5E0D8] text-verdant-text-primary hover:bg-verdant-surface-accent/30 hover:border-verdant-moss/50'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-semibold text-verdant-text-primary">
                  {p.asset} on{' '}
                  {p.protocol.charAt(0).toUpperCase() + p.protocol.slice(1)}
                </span>
                <span className="text-sm font-semibold font-mono text-verdant-text-primary">{formatUsd(p.amountUsd)}</span>
              </div>
              <p className="text-xs text-verdant-text-muted mt-1 font-mono">
                {formatToken(p.amount)} {p.asset} • <span className="text-verdant-profit font-semibold">{(p.currentApy * 100).toFixed(2)}% APY</span>
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
