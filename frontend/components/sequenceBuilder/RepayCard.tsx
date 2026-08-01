'use client';

import { useState } from 'react';
import type { TokenState } from '@/lib/sequenceBuilder/types';
import { formatPercent, formatUsd } from '@/lib/utils/formatting';
import type { Position } from '@/types/position';

interface RepayCardProps {
  tokenIn: TokenState;
  userPositions: Position[];
  selectedPositionId?: string;
  isActive: boolean;
  onSelect: (positionId: string) => void;
  onFocus: () => void;
}

export function RepayCard({
  tokenIn,
  userPositions,
  selectedPositionId,
  isActive,
  onSelect,
  onFocus,
}: RepayCardProps) {
  const matchingBorrows = userPositions.filter(
    (p) => p.positionType === 'borrow' && p.chain === tokenIn.chain && p.asset === tokenIn.token,
  );

  const [selectedId, setSelectedId] = useState<string | null>(selectedPositionId || null);

  const handleRowClick = (pos: Position) => {
    setSelectedId(pos.id);
    onSelect(pos.id);
  };

  const selectedPosition = userPositions.find((p) => p.id === selectedPositionId);

  // Complete (read-only) view
  if (!isActive && selectedPosition) {
    return (
      <button
        type="button"
        onClick={onFocus}
        className="w-56 min-h-48 text-left bg-verdant-paper border border-verdant-rule rounded-xl p-4 cursor-pointer hover:border-verdant-moss transition-all flex flex-col justify-between"
      >
        <div>
          <div className="fl-eyebrow mb-2">REPAY</div>
          <div className="font-semibold text-verdant-text-primary text-sm leading-snug">
            {selectedPosition.protocol === 'aave'
              ? 'Aave V3'
              : selectedPosition.protocol === 'morpho'
                ? 'Morpho'
                : selectedPosition.protocol}{' '}
            — {selectedPosition.asset} Debt
          </div>
          <div className="text-xs text-verdant-text-muted mt-1 capitalize">
            {selectedPosition.chain} ·{' '}
            <span className="font-mono text-verdant-loss font-semibold">
              {formatPercent(selectedPosition.currentApy || selectedPosition.borrowApy || 0)} APY
            </span>
          </div>
        </div>
        <div className="mt-4 pt-2 border-t border-verdant-rule font-mono text-xs text-verdant-loss font-semibold">
          {formatUsd(selectedPosition.amountUsd)} owed
        </div>
      </button>
    );
  }

  return (
    <div className="w-56 min-h-48 bg-verdant-surface border-2 border-verdant-moss rounded-xl p-4 shadow-organic flex flex-col justify-between">
      <div>
        <div className="fl-eyebrow mb-2">REPAY</div>

        <div className="space-y-2 max-h-36 overflow-y-auto pr-1 scrollbar-thin">
          {matchingBorrows.map((pos) => {
            const isSel = pos.id === selectedId;
            const displayProtocol =
              pos.protocol === 'aave'
                ? 'Aave V3'
                : pos.protocol === 'morpho'
                  ? 'Morpho'
                  : pos.protocol;
            return (
              <button
                type="button"
                key={pos.id}
                onClick={() => handleRowClick(pos)}
                className={`w-full text-left p-2 rounded text-xs cursor-pointer border transition-colors ${
                  isSel
                    ? 'bg-verdant-moss/10 border-verdant-moss border-l-2'
                    : 'border-verdant-rule hover:bg-verdant-paper'
                }`}
              >
                <div className="font-medium text-verdant-text-primary leading-snug">
                  {displayProtocol} — {pos.asset} Debt
                </div>
                <div className="flex items-center justify-between mt-1 text-[10px]">
                  <span className="text-verdant-text-muted capitalize">{pos.chain}</span>
                  <span className="font-mono font-semibold text-verdant-loss">
                    {formatUsd(pos.amountUsd)}
                  </span>
                </div>
                <div className="text-[9px] text-verdant-text-muted mt-0.5">
                  {formatPercent(pos.currentApy || pos.borrowApy || 0)} borrow APY
                </div>
              </button>
            );
          })}

          {matchingBorrows.length === 0 && (
            <div className="text-xs text-verdant-text-muted text-center py-6">
              No matching debt positions on {tokenIn.chain}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
