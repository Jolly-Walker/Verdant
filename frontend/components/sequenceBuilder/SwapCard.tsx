'use client'

import React, { useState, useEffect } from 'react'
import { SUPPORTED_TOKENS } from '@/constants/tokens'
import { TokenState } from '@/lib/sequenceBuilder/types'
import { estimateDemoSwapFee } from '@/lib/sequenceBuilder/fixtures'
import { formatUsd, formatToken } from '@/lib/utils/formatting'

interface SwapCardProps {
  tokenIn: TokenState
  selectedToToken?: string
  selectedFeeUsd?: number
  isActive: boolean
  onSelect: (toToken: string, feeUsd: number, tokenOut: TokenState) => void
  onFocus: () => void
}

const TOKEN_PRICES: Record<string, number> = {
  USDC: 1.0,
  USDT: 1.0,
  WETH: 2500.0,
  ETH: 2500.0,
  WBTC: 65000.0,
  SOL: 140.0,
  LINK: 15.0,
}

export function SwapCard({
  tokenIn,
  selectedToToken,
  selectedFeeUsd,
  isActive,
  onSelect,
  onFocus
}: SwapCardProps) {
  // Filter tokens available on this chain and not equal to tokenIn
  const availableTokens = Object.keys(SUPPORTED_TOKENS).filter(
    symbol => {
      const config = SUPPORTED_TOKENS[symbol]
      return config.addresses[tokenIn.chain] !== undefined && symbol !== tokenIn.token
    }
  )

  const [toToken, setToToken] = useState<string>(selectedToToken || availableTokens[0] || 'WETH')

  const feeUsd = estimateDemoSwapFee(tokenIn.amountUsd)
  const outputAmountUsd = Math.max(tokenIn.amountUsd - feeUsd, 0)
  
  const toPrice = TOKEN_PRICES[toToken] || 1
  const outputAmount = outputAmountUsd / toPrice

  const handleTokenChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const symbol = e.target.value
    setToToken(symbol)
  }

  // Effect to automatically emit selection if we change token
  useEffect(() => {
    if (toToken) {
      const currentToPrice = TOKEN_PRICES[toToken] || 1
      const currentOutputAmount = outputAmountUsd / currentToPrice

      onSelect(toToken, feeUsd, {
        token: toToken,
        chain: tokenIn.chain,
        amount: currentOutputAmount,
        amountUsd: outputAmountUsd,
        positionType: 'wallet'
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toToken, tokenIn.amountUsd])

  // Complete (read-only) view
  if (!isActive && selectedToToken) {
    const actualFeeUsd = selectedFeeUsd !== undefined ? selectedFeeUsd : feeUsd
    return (
      <div
        onClick={onFocus}
        className="w-56 min-h-48 bg-verdant-surface-accent border border-[#D5E8E0] rounded-xl p-4 cursor-pointer hover:border-verdant-moss transition-all flex flex-col justify-between"
      >
        <div>
          <div className="text-[10px] text-verdant-text-muted uppercase tracking-wider font-semibold mb-2">
            SWAP
          </div>
          <div className="font-semibold text-verdant-text-primary text-sm leading-snug">
            {tokenIn.token} → {selectedToToken}
          </div>
          <div className="text-xs text-verdant-text-muted mt-1 font-mono">
            1inch · <span className="font-semibold text-verdant-text-primary">{formatUsd(actualFeeUsd)} fee</span>
          </div>
        </div>
        <div className="mt-4 pt-2 border-t border-[#D5E8E0] font-mono text-xs text-verdant-text-muted">
          Rate: 1 {selectedToToken} = {formatUsd(toPrice)}
        </div>
      </div>
    )
  }

  return (
    <div className="w-56 min-h-48 bg-verdant-surface border-2 border-verdant-moss rounded-xl p-4 shadow-organic flex flex-col justify-between">
      <div>
        <div className="text-[10px] text-verdant-text-muted uppercase tracking-wider font-semibold mb-2">
          SWAP
        </div>

        <div className="text-xs text-verdant-text-muted mb-2">
          From: <span className="font-semibold text-verdant-text-primary">{tokenIn.token}</span>
        </div>

        {/* To token selector */}
        <div className="mb-2">
          <label className="text-[9px] text-verdant-text-muted font-semibold uppercase tracking-wider block mb-1">
            To Token
          </label>
          <select
            value={toToken}
            onChange={handleTokenChange}
            className="w-full bg-verdant-canvas text-verdant-text-primary text-xs px-2 py-1.5 rounded border border-[#E5E0D8] focus:border-verdant-moss focus:outline-none"
          >
            {availableTokens.map(symbol => (
              <option key={symbol} value={symbol}>
                {symbol} ({SUPPORTED_TOKENS[symbol]?.name || ''})
              </option>
            ))}
          </select>
        </div>

        {/* Route info */}
        <div className="text-[10px] text-verdant-text-muted space-y-1 mt-3 pt-2 border-t border-[#E5E0D8]/60">
          <div className="flex justify-between">
            <span>Routing:</span>
            <span className="font-medium text-verdant-text-primary">1inch</span>
          </div>
          <div className="flex justify-between">
            <span>Est. Fee:</span>
            <span className="font-mono text-verdant-text-primary">
              {formatUsd(feeUsd)} (0.04%)
            </span>
          </div>
          <div className="flex justify-between mt-1 font-mono text-[9px] text-verdant-profit">
            <span>Receive:</span>
            <span>
              ~{formatToken(outputAmount)} {toToken}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
