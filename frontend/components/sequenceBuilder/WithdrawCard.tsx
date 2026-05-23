'use client'

import React from 'react'
import { TokenState } from '@/lib/sequenceBuilder/types'
import { formatUsd, formatToken } from '@/lib/utils/formatting'

interface WithdrawCardProps {
  tokenIn: TokenState
  isActive: boolean
  onConfirm: (tokenOut: TokenState) => void
  onFocus: () => void
}

export function WithdrawCard({
  tokenIn,
  isActive,
  onConfirm,
  onFocus
}: WithdrawCardProps) {
  const protocolLabel = tokenIn.sourcePositionId ? 'Aave' : 'Protocol'

  const handleConfirm = () => {
    onConfirm({
      token: tokenIn.token,
      chain: tokenIn.chain,
      amount: tokenIn.amount,
      amountUsd: tokenIn.amountUsd,
      positionType: 'wallet'
    })
  }

  // Complete (read-only) view
  if (!isActive) {
    return (
      <div
        onClick={onFocus}
        className="w-56 min-h-48 bg-verdant-surface-accent border border-[#D5E8E0] rounded-xl p-4 cursor-pointer hover:border-verdant-moss transition-all flex flex-col justify-between"
      >
        <div>
          <div className="text-[10px] text-verdant-text-muted uppercase tracking-wider font-semibold mb-2">
            WITHDRAW
          </div>
          <div className="font-semibold text-verdant-text-primary text-sm leading-snug">
            {protocolLabel} {tokenIn.token}
          </div>
          <div className="text-xs text-verdant-text-muted mt-1 capitalize font-mono">
            {tokenIn.chain}
          </div>
        </div>
        <div className="mt-4 pt-2 border-t border-[#D5E8E0] font-mono text-xs text-verdant-text-primary font-bold">
          {formatUsd(tokenIn.amountUsd)} → {formatToken(tokenIn.amount)} {tokenIn.token}
        </div>
      </div>
    )
  }

  return (
    <div className="w-56 min-h-48 bg-verdant-surface border-2 border-verdant-moss rounded-xl p-4 shadow-organic flex flex-col justify-between">
      <div>
        <div className="text-[10px] text-verdant-text-muted uppercase tracking-wider font-semibold mb-2">
          WITHDRAW
        </div>

        <div className="text-xs text-verdant-text-primary mb-2">
          Confirm exit from supply position:
        </div>

        <div className="space-y-1 text-[11px] text-verdant-text-muted mt-2">
          <div>
            Protocol:{' '}
            <span className="font-medium text-verdant-text-primary">{protocolLabel}</span>
          </div>
          <div>
            Chain:{' '}
            <span className="font-medium text-verdant-text-primary capitalize">
              {tokenIn.chain}
            </span>
          </div>
          <div>
            Asset:{' '}
            <span className="font-medium text-verdant-text-primary">{tokenIn.token}</span>
          </div>
          <div className="pt-2 font-mono font-bold text-verdant-text-primary text-xs">
            {formatToken(tokenIn.amount)} {tokenIn.token}
          </div>
          <div className="font-mono text-[10px] text-verdant-text-muted">
            ({formatUsd(tokenIn.amountUsd)})
          </div>
        </div>
      </div>

      <button
        onClick={handleConfirm}
        className="w-full text-xs bg-verdant-moss hover:bg-verdant-moss-dark text-white py-1.5 rounded transition-colors font-medium font-sans cursor-pointer mt-3"
      >
        Confirm Withdraw
      </button>
    </div>
  )
}
