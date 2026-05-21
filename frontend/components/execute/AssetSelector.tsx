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
      <h3 className="text-sm text-zinc-500 uppercase tracking-wider font-semibold">
        Select Asset to Move
      </h3>

      {positions.length === 0 ? (
        <Card className="text-center py-8">
          <p className="text-zinc-500 text-sm">No positions found to move</p>
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
          <label className="text-sm text-zinc-400 block">Amount</label>
          <div className="relative">
            <input
              type="number"
              value={customAmount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder="0.00"
              step="any"
              min="0"
              max={selectedPosition.amount}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              onClick={() => onAmountChange(selectedPosition.amount.toString())}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-emerald-400 hover:text-emerald-300 font-medium"
            >
              MAX
            </button>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-zinc-500">
              ≈ {formatUsd(amountUsd)}
            </span>
            <span className="text-zinc-500">
              Balance: {formatToken(selectedPosition.amount)} {selectedPosition.asset}
            </span>
          </div>
          {isBelowMinimum && (
            <p className="text-xs text-amber-400">
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
      <p className="text-xs text-zinc-500 mb-2">{label}</p>
      <div className="space-y-2">
        {positions.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
              selectedId === p.id
                ? 'bg-emerald-900/20 border-emerald-800 text-white'
                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
            }`}
          >
            <div className="flex justify-between">
              <span className="font-medium">
                {p.asset} on{' '}
                {p.protocol.charAt(0).toUpperCase() + p.protocol.slice(1)}
              </span>
              <span className="text-sm">{formatUsd(p.amountUsd)}</span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              {formatToken(p.amount)} {p.asset} • {(p.currentApy * 100).toFixed(2)}% APY
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
