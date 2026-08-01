'use client';

import { useEffect, useState } from 'react';
import { useDestinations } from '@/hooks/useDestinations';
import type { DepositDestination, TokenState } from '@/lib/sequenceBuilder/types';
import { formatPercent } from '@/lib/utils/formatting';

interface DepositCardProps {
  tokenIn: TokenState;
  selectedDestination?: DepositDestination;
  isActive: boolean;
  onSelect: (dest: DepositDestination) => void;
  onFocus: () => void;
}

export function DepositCard({
  tokenIn,
  selectedDestination,
  isActive,
  onSelect,
  onFocus,
}: DepositCardProps) {
  const { destinations, isLoading, error, refetch } = useDestinations(tokenIn.token, tokenIn.chain);
  const [selectedId, setSelectedId] = useState<string | null>(selectedDestination?.id || null);

  // Keep selectedId in sync with selectedDestination when selectedDestination changes
  useEffect(() => {
    if (selectedDestination) {
      setSelectedId(selectedDestination.id);
    } else {
      setSelectedId(null);
    }
  }, [selectedDestination]);

  const handleRowClick = (dest: DepositDestination) => {
    setSelectedId(dest.id);
    onSelect(dest);
  };

  // Complete (read-only) view
  if (!isActive && selectedDestination) {
    return (
      <button
        type="button"
        onClick={onFocus}
        className="w-56 min-h-48 text-left bg-verdant-paper border border-verdant-rule rounded-xl p-4 cursor-pointer hover:border-verdant-moss transition-all flex flex-col justify-between"
      >
        <div>
          <div className="fl-eyebrow mb-2">DEPOSIT</div>
          <div className="font-semibold text-verdant-text-primary text-sm leading-snug">
            {selectedDestination.displayName}
          </div>
          <div className="text-xs text-verdant-text-muted mt-1 capitalize">
            {selectedDestination.chain} ·{' '}
            <span className="font-mono font-semibold text-verdant-profit">
              {formatPercent(selectedDestination.apy)}
            </span>
            {selectedDestination.apyMean30d != null && (
              <span className="font-mono text-verdant-text-muted ml-1">
                ({formatPercent(selectedDestination.apyMean30d)} 30d avg)
              </span>
            )}
            {selectedDestination.lockPeriodDays != null && (
              <span className="ml-1 text-verdant-caution">
                · 🔒 {selectedDestination.lockPeriodDays}d lock
              </span>
            )}
          </div>
        </div>
        <div className="mt-4 pt-2 border-t border-verdant-rule font-mono text-xs text-verdant-text-muted">
          → {selectedDestination.outputTokenSymbol}
        </div>
      </button>
    );
  }

  return (
    <div className="w-56 min-h-48 bg-verdant-surface border-2 border-verdant-moss rounded-xl p-4 shadow-organic flex flex-col justify-between">
      <div>
        <div className="fl-eyebrow mb-2">DEPOSIT</div>

        <div className="space-y-2 max-h-36 overflow-y-auto pr-1 scrollbar-thin">
          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-verdant-paper-deep rounded animate-pulse" />
              ))}
            </div>
          )}

          {error && !isLoading && (
            <div className="text-xs text-verdant-loss text-center py-4">
              Failed to load destinations.{' '}
              <button
                type="button"
                onClick={() => refetch()}
                className="underline font-semibold cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {!isLoading &&
            !error &&
            destinations.map((dest) => {
              const isSel = dest.id === selectedId;
              return (
                <button
                  type="button"
                  key={dest.id}
                  onClick={() => handleRowClick(dest)}
                  className={`w-full text-left p-2 rounded text-xs cursor-pointer border transition-colors ${
                    isSel
                      ? 'bg-verdant-moss/10 border-verdant-moss border-l-2'
                      : 'border-verdant-rule hover:bg-verdant-paper'
                  }`}
                >
                  {/* Name row */}
                  <div className="font-medium text-verdant-text-primary leading-snug flex items-center gap-1 flex-wrap">
                    {dest.displayName}
                    {dest.lockPeriodDays != null && (
                      <span
                        className="text-[9px] bg-verdant-caution/10 text-verdant-caution border border-verdant-caution/25
                                     px-1 py-0.5 rounded font-semibold uppercase tracking-wide"
                      >
                        🔒 {dest.lockPeriodDays}d
                      </span>
                    )}
                    {dest.lockDescription && dest.lockPeriodDays == null && (
                      <span
                        className="text-[9px] bg-verdant-caution/10 text-verdant-caution border border-verdant-caution/25
                                     px-1 py-0.5 rounded font-semibold uppercase tracking-wide"
                      >
                        🔒 Locked
                      </span>
                    )}
                  </div>

                  {/* APY row */}
                  <div className="flex items-center justify-between mt-1 text-[10px]">
                    <span className="text-verdant-text-muted capitalize">{dest.chain}</span>
                    <div className="flex items-center gap-1.5">
                      {dest.apyMean30d != null && (
                        <span className="text-verdant-text-muted font-mono">
                          {formatPercent(dest.apyMean30d)} 30d
                        </span>
                      )}
                      <span className="font-mono font-semibold text-verdant-profit">
                        {formatPercent(dest.apy)}
                      </span>
                    </div>
                  </div>

                  {/* Reward tokens */}
                  {dest.rewardTokens.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {dest.rewardTokens.slice(0, 3).map((addr) => (
                        <span
                          key={addr}
                          className="text-[9px] bg-verdant-paper-deep/60 text-verdant-text-muted
                                   border border-verdant-rule px-1 py-0.5 rounded font-mono"
                        >
                          +{addr.slice(0, 6)}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}

          {!isLoading && !error && destinations.length === 0 && (
            <div className="text-xs text-verdant-text-muted text-center py-6">
              No supported destinations for {tokenIn.token} on {tokenIn.chain}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
