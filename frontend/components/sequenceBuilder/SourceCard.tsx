'use client'

import React, { useState, useEffect } from 'react'
import { Position } from '@/types/position'
import { TokenState, BuilderStep } from '@/lib/sequenceBuilder/types'
import { TokenIcon } from '../positions/TokenIcon'
import { formatUsd, formatToken } from '@/lib/utils/formatting'

interface SourceCardProps {
  step: BuilderStep & { kind: 'source' }
  isActive: boolean
  userPositions: Position[]
  onSelect: (tokenOut: TokenState) => void
  onFocus: () => void
}

export function SourceCard({
  step,
  isActive,
  userPositions,
  onSelect,
  onFocus
}: SourceCardProps) {
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(
    step.tokenOut.sourcePositionId || (step.tokenOut.positionType === 'wallet' ? 'wallet-' + step.tokenOut.token + '-' + step.tokenOut.chain : null)
  )
  const [amountStr, setAmountStr] = useState<string>(
    step.tokenOut.amount > 0 ? step.tokenOut.amount.toString() : ''
  )

  // Filter positions
  const walletPositions = userPositions.filter(p => p.positionType === 'wallet')
  const supplyPositions = userPositions.filter(p => p.positionType === 'supply')

  // Find currently selected position
  const selectedPosition = userPositions.find(p => {
    if (p.positionType === 'wallet') {
      return 'wallet-' + p.asset + '-' + p.chain === selectedPositionId
    }
    return p.id === selectedPositionId
  })

  // Synchronize internal state with step prop changes (e.g. pre-seeding)
  useEffect(() => {
    if (step.tokenOut.amount > 0) {
      setAmountStr(step.tokenOut.amount.toString())
    }
    if (step.tokenOut.sourcePositionId) {
      setSelectedPositionId(step.tokenOut.sourcePositionId)
    } else if (step.tokenOut.positionType === 'wallet' && step.tokenOut.token) {
      setSelectedPositionId('wallet-' + step.tokenOut.token + '-' + step.tokenOut.chain)
    }
  }, [step])

  const handlePositionClick = (pos: Position) => {
    const id = pos.positionType === 'wallet' ? 'wallet-' + pos.asset + '-' + pos.chain : pos.id
    setSelectedPositionId(id)
    // Default to max amount
    setAmountStr(pos.amount.toString())
    
    // Auto emit if amount is already valid
    const amt = pos.amount
    if (amt > 0) {
      onSelect({
        token: pos.asset,
        chain: pos.chain,
        amount: amt,
        amountUsd: amt * (pos.priceUsd || 1),
        sourcePositionId: pos.positionType === 'supply' ? pos.id : undefined,
        positionType: pos.positionType === 'supply' ? 'supply' : 'wallet'
      })
    }
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    // allow decimal string
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      setAmountStr(val)
      if (selectedPosition) {
        const numericVal = parseFloat(val)
        if (!isNaN(numericVal) && numericVal > 0 && numericVal <= selectedPosition.amount) {
          onSelect({
            token: selectedPosition.asset,
            chain: selectedPosition.chain,
            amount: numericVal,
            amountUsd: numericVal * (selectedPosition.priceUsd || 1),
            sourcePositionId: selectedPosition.positionType === 'supply' ? selectedPosition.id : undefined,
            positionType: selectedPosition.positionType === 'supply' ? 'supply' : 'wallet'
          })
        }
      }
    }
  }

  const handleMaxClick = () => {
    if (selectedPosition) {
      const maxVal = selectedPosition.amount.toString()
      setAmountStr(maxVal)
      onSelect({
        token: selectedPosition.asset,
        chain: selectedPosition.chain,
        amount: selectedPosition.amount,
        amountUsd: selectedPosition.amount * (selectedPosition.priceUsd || 1),
        sourcePositionId: selectedPosition.positionType === 'supply' ? selectedPosition.id : undefined,
        positionType: selectedPosition.positionType === 'supply' ? 'supply' : 'wallet'
      })
    }
  }

  // Check if we are complete (not active, and step has tokenOut filled)
  if (!isActive && step.tokenOut.amount > 0) {
    const isWallet = step.tokenOut.positionType === 'wallet'
    return (
      <div
        onClick={onFocus}
        className="w-56 min-h-48 bg-verdant-surface-accent border border-[#D5E8E0] rounded-xl p-4 cursor-pointer hover:border-verdant-moss transition-all flex flex-col justify-between"
      >
        <div>
          <div className="text-[10px] text-verdant-text-muted uppercase tracking-wider font-semibold mb-2">
            SOURCE
          </div>
          <div className="flex items-center gap-2 mb-2">
            <TokenIcon symbol={step.tokenOut.token} className="w-5 h-5" />
            <span className="font-semibold text-verdant-text-primary text-sm">
              {step.tokenOut.token}
            </span>
          </div>
          <div className="text-xs text-verdant-text-muted capitalize">
            {step.tokenOut.chain}
          </div>
          <div className="text-xs text-verdant-text-muted font-mono mt-1">
            {isWallet ? 'Wallet' : 'Aave supply'}
          </div>
        </div>
        <div className="mt-4 pt-2 border-t border-[#D5E8E0]">
          <div className="font-mono text-sm font-bold text-verdant-text-primary">
            {formatToken(step.tokenOut.amount)} {step.tokenOut.token}
          </div>
          <div className="font-mono text-xs text-verdant-text-muted">
            {formatUsd(step.tokenOut.amountUsd)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-56 min-h-48 bg-verdant-surface border-2 border-verdant-moss rounded-xl p-4 shadow-organic flex flex-col justify-between">
      <div>
        <div className="text-[10px] text-verdant-text-muted uppercase tracking-wider font-semibold mb-2">
          SOURCE
        </div>
        
        {/* List of positions */}
        <div className="space-y-2 max-h-36 overflow-y-auto pr-1 mb-3 scrollbar-thin">
          {supplyPositions.length > 0 && (
            <div>
              <div className="text-[9px] text-verdant-text-muted font-semibold uppercase tracking-wider mb-1">
                Protocol Positions
              </div>
              {supplyPositions.map(pos => {
                const isSel = pos.id === selectedPositionId
                return (
                  <div
                    key={pos.id}
                    onClick={() => handlePositionClick(pos)}
                    className={`flex items-center justify-between p-1.5 rounded text-xs cursor-pointer transition-colors ${
                      isSel
                        ? 'bg-verdant-surface-accent border border-verdant-moss/30'
                        : 'hover:bg-[#FAF9F6]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <TokenIcon symbol={pos.asset} className="w-4 h-4 shrink-0" />
                      <div className="truncate">
                        <div className="font-medium text-verdant-text-primary truncate">{pos.asset}</div>
                        <div className="text-[9px] text-verdant-text-muted truncate capitalize">{pos.chain}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-[10px] text-verdant-text-primary font-bold">
                        {formatUsd(pos.amountUsd)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {walletPositions.length > 0 && (
            <div className="mt-2">
              <div className="text-[9px] text-verdant-text-muted font-semibold uppercase tracking-wider mb-1">
                Wallet
              </div>
              {walletPositions.map(pos => {
                const id = 'wallet-' + pos.asset + '-' + pos.chain
                const isSel = id === selectedPositionId
                return (
                  <div
                    key={pos.id}
                    onClick={() => handlePositionClick(pos)}
                    className={`flex items-center justify-between p-1.5 rounded text-xs cursor-pointer transition-colors ${
                      isSel
                        ? 'bg-verdant-surface-accent border border-verdant-moss/30'
                        : 'hover:bg-[#FAF9F6]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <TokenIcon symbol={pos.asset} className="w-4 h-4 shrink-0" />
                      <div className="truncate">
                        <div className="font-medium text-verdant-text-primary truncate">{pos.asset}</div>
                        <div className="text-[9px] text-verdant-text-muted truncate capitalize">{pos.chain}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-[10px] text-verdant-text-primary font-bold">
                        {formatUsd(pos.amountUsd)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {selectedPosition && (
        <div className="mt-2 pt-2 border-t border-[#E5E0D8]/60">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] text-verdant-text-muted font-semibold">Amount</span>
            <span className="text-[10px] text-verdant-text-muted font-mono">
              Max: {formatToken(selectedPosition.amount)}
            </span>
          </div>
          <div className="relative flex items-center">
            <input
              type="text"
              value={amountStr}
              onChange={handleAmountChange}
              placeholder="0.0"
              className="w-full bg-verdant-canvas text-verdant-text-primary font-mono text-xs px-2 py-1.5 rounded border border-[#E5E0D8] focus:border-verdant-moss focus:outline-none pr-10"
            />
            <button
              onClick={handleMaxClick}
              className="absolute right-1 text-[10px] bg-verdant-surface-accent text-verdant-moss hover:bg-verdant-glacial/20 font-bold px-1.5 py-0.5 rounded transition-colors"
            >
              MAX
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
