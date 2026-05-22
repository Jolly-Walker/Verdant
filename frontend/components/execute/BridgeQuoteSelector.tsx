'use client';

import React from 'react';
import { BridgeQuote, BridgeId } from '@/types/shared';
import { formatUsd } from '@/lib/utils/formatting';

const BRIDGE_METADATA: Record<BridgeId, { name: string; description: string }> = {
  across: {
    name: 'Across',
    description: 'Fast, optimistic bridge with low fees.',
  },
  nearIntents: {
    name: 'NEAR Intents',
    description: 'Intent-based bridging for cross-ecosystem routes.',
  },
  layerzero: {
    name: 'LayerZero',
    description: 'Omnichain messaging using Circle CCTP.',
  },
  chainlink: {
    name: 'Chainlink CCIP',
    description: 'Secure, reliable cross-chain protocol.',
  },
};

interface BridgeQuoteSelectorProps {
  quotes: BridgeQuote[];
  selectedId: BridgeId | null;
  onSelect: (quote: BridgeQuote) => void;
  amountUsd: number;
}

export function BridgeQuoteSelector({
  quotes,
  selectedId,
  onSelect,
  amountUsd,
}: BridgeQuoteSelectorProps) {
  if (quotes.length === 0) {
    return (
      <div className="text-center py-4 text-verdant-text-muted text-sm">
        No bridge quotes available.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold text-verdant-text-muted uppercase tracking-wider mb-2">
        Select Bridge Provider
      </h3>
      {quotes.map((quote) => {
        const metadata = BRIDGE_METADATA[quote.bridgeId];
        const isSelected = selectedId === quote.bridgeId;
        const feePercent = (quote.feeUsd / amountUsd) * 100;
        const isHighFee = feePercent > 0.5;

        return (
          <button
            key={quote.bridgeId}
            onClick={() => onSelect(quote)}
            className="w-full text-left transition-all"
          >
            <div
              className={`p-4 border-2 rounded-lg transition-all ${
                isSelected
                  ? 'border-verdant-moss bg-verdant-surface-accent'
                  : 'border-[#E5E0D8] bg-verdant-surface hover:bg-verdant-surface-accent/30'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-semibold text-verdant-text-primary">{metadata.name}</span>
                <div className="text-right">
                  <div className="font-bold text-verdant-text-primary font-mono text-sm">
                    {formatUsd(quote.feeUsd)}
                  </div>
                  {isHighFee && (
                    <span className="text-[10px] text-verdant-loss font-bold bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                      HIGH FEE: <span className="font-mono">{feePercent.toFixed(2)}%</span>
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-verdant-text-muted mb-2">{metadata.description}</p>
              <div className="flex justify-between items-center text-[10px] text-verdant-text-muted uppercase">
                <span className="font-mono">~{Math.ceil(quote.estimatedTimeSeconds / 60)} mins</span>
                {isSelected && (
                  <span className="text-verdant-moss font-bold">Selected</span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
