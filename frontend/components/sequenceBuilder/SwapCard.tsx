'use client';

import type React from 'react';
import { useEffect, useId, useState } from 'react';
import { SUPPORTED_TOKENS } from '@/constants/tokens';
import { estimateDemoSwapFee } from '@/lib/sequenceBuilder/fixtures';
import type { TokenState } from '@/lib/sequenceBuilder/types';
import { formatToken, formatUsd } from '@/lib/utils/formatting';

interface SwapCardProps {
  tokenIn: TokenState;
  selectedToToken?: string;
  selectedFeeUsd?: number;
  isActive: boolean;
  onSelect: (toToken: string, feeUsd: number, tokenOut: TokenState) => void;
  onFocus: () => void;
}

const TOKEN_PRICES: Record<string, number> = {
  USDC: 1.0,
  USDT: 1.0,
  WETH: 2500.0,
  ETH: 2500.0,
  WBTC: 65000.0,
  SOL: 140.0,
  LINK: 15.0,
};

export function SwapCard({
  tokenIn,
  selectedToToken,
  selectedFeeUsd,
  isActive,
  onSelect,
  onFocus,
}: SwapCardProps) {
  // Filter tokens available on this chain and not equal to tokenIn
  const availableTokens = Object.keys(SUPPORTED_TOKENS).filter((symbol) => {
    const config = SUPPORTED_TOKENS[symbol];
    return config.addresses[tokenIn.chain] !== undefined && symbol !== tokenIn.token;
  });

  const [toToken, setToToken] = useState<string>(selectedToToken || availableTokens[0] || 'WETH');
  const toTokenSelectId = useId();

  const feeUsd = estimateDemoSwapFee(tokenIn.amountUsd);
  const outputAmountUsd = Math.max(tokenIn.amountUsd - feeUsd, 0);

  const toPrice = TOKEN_PRICES[toToken] || 1;
  const outputAmount = outputAmountUsd / toPrice;

  const handleTokenChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const symbol = e.target.value;
    setToToken(symbol);
  };

  // Effect to automatically emit selection if we change token
  useEffect(() => {
    if (toToken) {
      const currentToPrice = TOKEN_PRICES[toToken] || 1;
      const currentOutputAmount = outputAmountUsd / currentToPrice;

      onSelect(toToken, feeUsd, {
        token: toToken,
        chain: tokenIn.chain,
        amount: currentOutputAmount,
        amountUsd: outputAmountUsd,
        positionType: 'wallet',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toToken, tokenIn.amountUsd]);

  // Complete (read-only) view
  if (!isActive && selectedToToken) {
    const actualFeeUsd = selectedFeeUsd !== undefined ? selectedFeeUsd : feeUsd;
    return (
      <button
        type="button"
        onClick={onFocus}
        className="w-56 min-h-48 text-left bg-verdant-paper border border-verdant-rule rounded-xl p-4 cursor-pointer hover:border-verdant-moss transition-all flex flex-col justify-between"
      >
        <div>
          <div className="fl-eyebrow mb-2">SWAP</div>
          <div className="font-semibold text-verdant-text-primary text-sm leading-snug">
            {tokenIn.token} → {selectedToToken}
          </div>
          <div className="text-xs text-verdant-text-muted mt-1 font-mono">
            1inch ·{' '}
            <span className="font-semibold text-verdant-text-primary">
              {formatUsd(actualFeeUsd)} fee
            </span>
          </div>
        </div>
        <div className="mt-4 pt-2 border-t border-verdant-rule font-mono text-xs text-verdant-text-muted">
          Rate: 1 {selectedToToken} = {formatUsd(toPrice)}
        </div>
      </button>
    );
  }

  return (
    <div className="w-56 min-h-48 bg-verdant-surface border-2 border-verdant-moss rounded-xl p-4 shadow-organic flex flex-col justify-between">
      <div>
        <div className="fl-eyebrow mb-2">SWAP</div>

        <div className="text-xs text-verdant-text-muted mb-2">
          From: <span className="font-semibold text-verdant-text-primary">{tokenIn.token}</span>
        </div>

        {/* To token selector */}
        <div className="mb-2">
          <label
            htmlFor={toTokenSelectId}
            className="field-label text-[9px] uppercase tracking-wider"
          >
            To Token
          </label>
          <select
            id={toTokenSelectId}
            value={toToken}
            onChange={handleTokenChange}
            className="field-input"
          >
            {availableTokens.map((symbol) => (
              <option key={symbol} value={symbol}>
                {symbol} ({SUPPORTED_TOKENS[symbol]?.name || ''})
              </option>
            ))}
          </select>
        </div>

        {/* Route info */}
        <div className="text-[10px] text-verdant-text-muted space-y-1 mt-3 pt-2 border-t border-verdant-rule/60">
          <div className="flex justify-between">
            <span>Routing:</span>
            <span className="font-medium text-verdant-text-primary">1inch</span>
          </div>
          <div className="flex justify-between">
            <span>Est. Fee:</span>
            <span className="font-mono text-verdant-text-primary">{formatUsd(feeUsd)} (0.04%)</span>
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
  );
}
