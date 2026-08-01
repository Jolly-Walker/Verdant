'use client';

import type { TokenState } from '@/lib/sequenceBuilder/types';
import { formatToken, formatUsd } from '@/lib/utils/formatting';

interface WithdrawCardProps {
  tokenIn: TokenState;
  isActive: boolean;
  onConfirm: (tokenOut: TokenState) => void;
  onFocus: () => void;
}

export function WithdrawCard({ tokenIn, isActive, onConfirm, onFocus }: WithdrawCardProps) {
  const protocolLabel = tokenIn.sourcePositionId ? 'Aave' : 'Protocol';

  const handleConfirm = () => {
    onConfirm({
      token: tokenIn.token,
      chain: tokenIn.chain,
      amount: tokenIn.amount,
      amountUsd: tokenIn.amountUsd,
      positionType: 'wallet',
    });
  };

  // Complete (read-only) view
  if (!isActive) {
    return (
      <button
        type="button"
        onClick={onFocus}
        className="w-56 min-h-48 text-left bg-verdant-paper border border-verdant-rule rounded-xl p-4 cursor-pointer hover:border-verdant-moss transition-all flex flex-col justify-between"
      >
        <div>
          <div className="fl-eyebrow mb-2">WITHDRAW</div>
          <div className="font-semibold text-verdant-text-primary text-sm leading-snug">
            {protocolLabel} {tokenIn.token}
          </div>
          <div className="text-xs text-verdant-text-muted mt-1 capitalize font-mono">
            {tokenIn.chain}
          </div>
        </div>
        <div className="mt-4 pt-2 border-t border-verdant-rule font-mono text-xs text-verdant-text-primary font-bold">
          {formatUsd(tokenIn.amountUsd)} → {formatToken(tokenIn.amount)} {tokenIn.token}
        </div>
      </button>
    );
  }

  return (
    <div className="w-56 min-h-48 bg-verdant-surface border-2 border-verdant-moss rounded-xl p-4 shadow-organic flex flex-col justify-between">
      <div>
        <div className="fl-eyebrow mb-2">WITHDRAW</div>

        <div className="text-xs text-verdant-text-primary mb-2">
          Confirm exit from supply position:
        </div>

        <div className="space-y-1 text-[11px] text-verdant-text-muted mt-2">
          <div>
            Protocol: <span className="font-medium text-verdant-text-primary">{protocolLabel}</span>
          </div>
          <div>
            Chain:{' '}
            <span className="font-medium text-verdant-text-primary capitalize">
              {tokenIn.chain}
            </span>
          </div>
          <div>
            Asset: <span className="font-medium text-verdant-text-primary">{tokenIn.token}</span>
          </div>
          <div className="pt-2 font-mono font-bold text-verdant-text-primary text-xs">
            {formatToken(tokenIn.amount)} {tokenIn.token}
          </div>
          <div className="font-mono text-[10px] text-verdant-text-muted">
            ({formatUsd(tokenIn.amountUsd)})
          </div>
        </div>
      </div>

      <button type="button" onClick={handleConfirm} className="btn btn-primary btn-sm mt-3 w-full">
        Confirm Withdraw
      </button>
    </div>
  );
}
