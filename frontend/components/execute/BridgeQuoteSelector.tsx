'use client';

import React from 'react';
import { BridgeQuote, BridgeId } from '@/types/shared';
import { formatUsd } from '@/lib/utils/formatting';
import { Card } from '@/components/ui/Card';

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
      <div className="text-center py-4 text-zinc-500 text-sm">
        No bridge quotes available.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
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
            <Card
              className={`p-4 border-2 transition-all hover:bg-zinc-800/50 ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-500/5'
                  : 'border-zinc-800 bg-zinc-900/50'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-semibold text-white">{metadata.name}</span>
                <div className="text-right">
                  <div className="font-bold text-emerald-400">
                    {formatUsd(quote.feeUsd)}
                  </div>
                  {isHighFee && (
                    <span className="text-[10px] text-amber-500 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded">
                      HIGH FEE: {feePercent.toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-zinc-400 mb-2">{metadata.description}</p>
              <div className="flex justify-between items-center text-[10px] text-zinc-500 uppercase">
                <span>~{Math.ceil(quote.estimatedTimeSeconds / 60)} mins</span>
                {isSelected && (
                  <span className="text-emerald-500 font-bold">Selected</span>
                )}
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
