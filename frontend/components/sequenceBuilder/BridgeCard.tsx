'use client';

import type React from 'react';
import { useEffect, useId, useState } from 'react';
import { DEMO_BRIDGE_QUOTES } from '@/lib/sequenceBuilder/fixtures';
import type { TokenState } from '@/lib/sequenceBuilder/types';
import { formatUsd } from '@/lib/utils/formatting';
import { ALL_CHAINS, type BridgeId, type ChainId } from '@/types/shared';

interface BridgeCardProps {
  tokenIn: TokenState;
  selectedToChain?: ChainId;
  selectedBridgeId?: BridgeId;
  selectedFeeUsd?: number;
  isActive: boolean;
  onSelect: (toChain: ChainId, bridgeId: BridgeId, feeUsd: number, tokenOut: TokenState) => void;
  onFocus: () => void;
}

export function BridgeCard({
  tokenIn,
  selectedToChain,
  selectedBridgeId,
  selectedFeeUsd,
  isActive,
  onSelect,
  onFocus,
}: BridgeCardProps) {
  // Exclude current chain and solana (EVM only for now per spec)
  const availableChains = ALL_CHAINS.filter((c) => c !== tokenIn.chain && c !== 'solana');

  const [toChain, setToChain] = useState<ChainId>(
    selectedToChain || (availableChains[0] as ChainId),
  );
  const [bridgeId, setBridgeId] = useState<BridgeId | null>(selectedBridgeId || null);
  const toChainSelectId = useId();

  const quotes = DEMO_BRIDGE_QUOTES[toChain] || [];

  // Handle chain change
  const handleChainChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newChain = e.target.value as ChainId;
    setToChain(newChain);
    setBridgeId(null);
  };

  // Handle bridge selection
  const handleBridgeClick = (q: (typeof quotes)[number]) => {
    setBridgeId(q.bridgeId);

    const priceUsd = tokenIn.amountUsd / tokenIn.amount;
    const feeAmount = q.feeUsd / priceUsd;
    const outputAmount = Math.max(tokenIn.amount - feeAmount, 0);
    const outputAmountUsd = Math.max(tokenIn.amountUsd - q.feeUsd, 0);

    onSelect(toChain, q.bridgeId, q.feeUsd, {
      token: tokenIn.token,
      chain: toChain,
      amount: outputAmount,
      amountUsd: outputAmountUsd,
      positionType: 'wallet', // bridge funds exit in wallet
    });
  };

  // Re-emit if chain changes but a valid bridge is already selected or matches
  useEffect(() => {
    if (bridgeId) {
      const match = quotes.find((q) => q.bridgeId === bridgeId);
      if (match) {
        const priceUsd = tokenIn.amountUsd / tokenIn.amount;
        const feeAmount = match.feeUsd / priceUsd;
        const outputAmount = Math.max(tokenIn.amount - feeAmount, 0);
        const outputAmountUsd = Math.max(tokenIn.amountUsd - match.feeUsd, 0);

        onSelect(toChain, match.bridgeId, match.feeUsd, {
          token: tokenIn.token,
          chain: toChain,
          amount: outputAmount,
          amountUsd: outputAmountUsd,
          positionType: 'wallet',
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toChain]);

  const selectedQuote = quotes.find((q) => q.bridgeId === selectedBridgeId);

  // Complete (read-only) view
  if (!isActive && selectedToChain && selectedBridgeId) {
    const displayQuote = selectedQuote || {
      label: selectedBridgeId,
      feeUsd: selectedFeeUsd || 0,
      timeSeconds: 60,
    };
    return (
      <button
        type="button"
        onClick={onFocus}
        className="w-56 min-h-48 text-left bg-verdant-paper border border-verdant-rule rounded-xl p-4 cursor-pointer hover:border-verdant-moss transition-all flex flex-col justify-between"
      >
        <div>
          <div className="fl-eyebrow mb-2">BRIDGE</div>
          <div className="font-semibold text-verdant-text-primary text-sm leading-snug capitalize">
            {tokenIn.chain} → {selectedToChain}
          </div>
          <div className="text-xs text-verdant-text-muted mt-1 font-mono">
            {displayQuote.label} ·{' '}
            <span className="font-semibold text-verdant-text-primary">
              {formatUsd(displayQuote.feeUsd)}
            </span>
          </div>
        </div>
        <div className="mt-4 pt-2 border-t border-verdant-rule font-mono text-xs text-verdant-text-muted">
          ~{displayQuote.timeSeconds}s transfer time
        </div>
      </button>
    );
  }

  return (
    <div className="w-56 min-h-48 bg-verdant-surface border-2 border-verdant-moss rounded-xl p-4 shadow-organic flex flex-col justify-between">
      <div>
        <div className="fl-eyebrow mb-2">BRIDGE</div>

        {/* Chain selector */}
        <div className="mb-2">
          <label
            htmlFor={toChainSelectId}
            className="field-label text-[9px] uppercase tracking-wider"
          >
            To Chain
          </label>
          <select
            id={toChainSelectId}
            value={toChain}
            onChange={handleChainChange}
            className="field-input"
          >
            {availableChains.map((c) => (
              <option key={c} value={c} className="capitalize">
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Bridge options */}
        <div>
          <span className="field-label text-[9px] uppercase tracking-wider">Route Quotes</span>
          <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1 scrollbar-thin">
            {quotes.map((q) => {
              const isSel = q.bridgeId === bridgeId;
              return (
                <button
                  type="button"
                  key={q.bridgeId}
                  onClick={() => handleBridgeClick(q)}
                  className={`w-full text-left p-1.5 rounded text-[11px] cursor-pointer border transition-colors ${
                    isSel
                      ? 'bg-verdant-moss/10 border-verdant-moss border-l-2'
                      : 'border-verdant-rule hover:bg-verdant-paper'
                  }`}
                >
                  <div className="flex items-center justify-between font-medium text-verdant-text-primary">
                    <span>{q.label}</span>
                    <span className="font-mono">{formatUsd(q.feeUsd)}</span>
                  </div>
                  <div className="text-[9px] text-verdant-text-muted mt-0.5 font-mono">
                    ~{q.timeSeconds}s
                  </div>
                </button>
              );
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
  );
}
