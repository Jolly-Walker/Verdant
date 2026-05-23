'use client'

import React, { useState, useEffect } from 'react'
import { ChainId, BridgeId, ALL_CHAINS } from '@/types/shared'
import { TokenState } from '@/lib/sequenceBuilder/types'
import { DEMO_BRIDGE_QUOTES } from '@/lib/sequenceBuilder/fixtures'
import { formatUsd } from '@/lib/utils/formatting'

interface BridgeCardProps {
  tokenIn: TokenState
  selectedToChain?: ChainId
  selectedBridgeId?: BridgeId
  selectedFeeUsd?: number
  isActive: boolean
  onSelect: (toChain: ChainId, bridgeId: BridgeId, feeUsd: number, tokenOut: TokenState) => void
  onFocus: () => void
}

export function BridgeCard({
  tokenIn,
  selectedToChain,
  selectedBridgeId,
  selectedFeeUsd,
  isActive,
  onSelect,
  onFocus
}: BridgeCardProps) {
  // Exclude current chain and solana (EVM only for now per spec)
  const availableChains = ALL_CHAINS.filter(c => c !== tokenIn.chain && c !== 'solana')
  
  const [toChain, setToChain] = useState<ChainId>(selectedToChain || (availableChains[0] as ChainId))
  const [bridgeId, setBridgeId] = useState<BridgeId | null>(selectedBridgeId || null)

  const quotes = DEMO_BRIDGE_QUOTES[toChain] || []

  // Handle chain change
  const handleChainChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newChain = e.target.value as ChainId
    setToChain(newChain)
    setBridgeId(null)
  }

  // Handle bridge selection
  const handleBridgeClick = (q: typeof quotes[number]) => {
    setBridgeId(q.bridgeId)

    const priceUsd = tokenIn.amountUsd / tokenIn.amount
    const feeAmount = q.feeUsd / priceUsd
    const outputAmount = Math.max(tokenIn.amount - feeAmount, 0)
    const outputAmountUsd = Math.max(tokenIn.amountUsd - q.feeUsd, 0)

    onSelect(toChain, q.bridgeId, q.feeUsd, {
      token: tokenIn.token,
      chain: toChain,
      amount: outputAmount,
      amountUsd: outputAmountUsd,
      positionType: 'wallet' // bridge funds exit in wallet
    })
  }

  // Re-emit if chain changes but a valid bridge is already selected or matches
  useEffect(() => {
    if (bridgeId) {
      const match = quotes.find(q => q.bridgeId === bridgeId)
      if (match) {
        const priceUsd = tokenIn.amountUsd / tokenIn.amount
        const feeAmount = match.feeUsd / priceUsd
        const outputAmount = Math.max(tokenIn.amount - feeAmount, 0)
        const outputAmountUsd = Math.max(tokenIn.amountUsd - match.feeUsd, 0)

        onSelect(toChain, match.bridgeId, match.feeUsd, {
          token: tokenIn.token,
          chain: toChain,
          amount: outputAmount,
          amountUsd: outputAmountUsd,
          positionType: 'wallet'
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toChain])

  const selectedQuote = quotes.find(q => q.bridgeId === selectedBridgeId)

  // Complete (read-only) view
  if (!isActive && selectedToChain && selectedBridgeId) {
    const displayQuote = selectedQuote || { label: selectedBridgeId, feeUsd: selectedFeeUsd || 0, timeSeconds: 60 }
    return (
      <div
        onClick={onFocus}
        className="w-56 min-h-48 bg-verdant-surface-accent border border-[#D5E8E0] rounded-xl p-4 cursor-pointer hover:border-verdant-moss transition-all flex flex-col justify-between"
      >
        <div>
          <div className="text-[10px] text-verdant-text-muted uppercase tracking-wider font-semibold mb-2">
            BRIDGE
          </div>
          <div className="font-semibold text-verdant-text-primary text-sm leading-snug capitalize">
            {tokenIn.chain} → {selectedToChain}
          </div>
          <div className="text-xs text-verdant-text-muted mt-1 font-mono">
            {displayQuote.label} · <span className="font-semibold text-verdant-text-primary">{formatUsd(displayQuote.feeUsd)}</span>
          </div>
        </div>
        <div className="mt-4 pt-2 border-t border-[#D5E8E0] font-mono text-xs text-verdant-text-muted">
          ~{displayQuote.timeSeconds}s transfer time
        </div>
      </div>
    )
  }

  return (
    <div className="w-56 min-h-48 bg-verdant-surface border-2 border-verdant-moss rounded-xl p-4 shadow-organic flex flex-col justify-between">
      <div>
        <div className="text-[10px] text-verdant-text-muted uppercase tracking-wider font-semibold mb-2">
          BRIDGE
        </div>

        {/* Chain selector */}
        <div className="mb-2">
          <label className="text-[9px] text-verdant-text-muted font-semibold uppercase tracking-wider block mb-1">
            To Chain
          </label>
          <select
            value={toChain}
            onChange={handleChainChange}
            className="w-full bg-verdant-canvas text-verdant-text-primary text-xs px-2 py-1.5 rounded border border-[#E5E0D8] focus:border-verdant-moss focus:outline-none"
          >
            {availableChains.map(c => (
              <option key={c} value={c} className="capitalize">
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Bridge options */}
        <div>
          <label className="text-[9px] text-verdant-text-muted font-semibold uppercase tracking-wider block mb-1">
            Route Quotes
          </label>
          <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1 scrollbar-thin">
            {quotes.map(q => {
              const isSel = q.bridgeId === bridgeId
              return (
                <div
                  key={q.bridgeId}
                  onClick={() => handleBridgeClick(q)}
                  className={`p-1.5 rounded text-[11px] cursor-pointer border transition-colors ${
                    isSel
                      ? 'bg-verdant-surface-accent border-verdant-moss border-l-2'
                      : 'border-[#E5E0D8] hover:bg-[#FAF9F6]'
                  }`}
                >
                  <div className="flex items-center justify-between font-medium text-verdant-text-primary">
                    <span>{q.label}</span>
                    <span className="font-mono">{formatUsd(q.feeUsd)}</span>
                  </div>
                  <div className="text-[9px] text-verdant-text-muted mt-0.5 font-mono">
                    ~{q.timeSeconds}s
                  </div>
                </div>
              )
            })}
            {quotes.length === 0 && (
              <div className="text-[10px] text-verdant-text-muted text-center py-2">
                No bridge quotes available.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
