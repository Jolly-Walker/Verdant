'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import type { BuilderStep, TokenState } from '@/lib/sequenceBuilder/types';
import { formatToken, formatUsd } from '@/lib/utils/formatting';
import type { Position } from '@/types/position';
import { TokenIcon } from '../positions/TokenIcon';

interface SourceCardProps {
  step: BuilderStep & { kind: 'source' };
  isActive: boolean;
  userPositions: Position[];
  onSelect: (tokenOut: TokenState) => void;
  onFocus: () => void;
}

export function SourceCard({ step, isActive, userPositions, onSelect, onFocus }: SourceCardProps) {
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(
    step.tokenOut.sourcePositionId ||
      (step.tokenOut.positionType === 'wallet'
        ? `wallet-${step.tokenOut.token}-${step.tokenOut.chain}`
        : null),
  );
  const [amountStr, setAmountStr] = useState<string>(
    step.tokenOut.amount > 0 ? step.tokenOut.amount.toString() : '',
  );

  // Filter positions
  const walletPositions = userPositions.filter((p) => p.positionType === 'wallet');
  const supplyPositions = userPositions.filter((p) => p.positionType === 'supply');

  // Find currently selected position
  const selectedPosition = userPositions.find((p) => {
    if (p.positionType === 'wallet') {
      return `wallet-${p.asset}-${p.chain}` === selectedPositionId;
    }
    return p.id === selectedPositionId;
  });

  // Synchronize internal state with step prop changes (e.g. pre-seeding)
  useEffect(() => {
    if (step.tokenOut.amount > 0) {
      setAmountStr(step.tokenOut.amount.toString());
    }
    if (step.tokenOut.sourcePositionId) {
      setSelectedPositionId(step.tokenOut.sourcePositionId);
    } else if (step.tokenOut.positionType === 'wallet' && step.tokenOut.token) {
      setSelectedPositionId(`wallet-${step.tokenOut.token}-${step.tokenOut.chain}`);
    }
  }, [step]);

  const handlePositionClick = (pos: Position) => {
    const id = pos.positionType === 'wallet' ? `wallet-${pos.asset}-${pos.chain}` : pos.id;
    setSelectedPositionId(id);
    // Default to max amount
    setAmountStr(pos.amount.toString());

    // Auto emit if amount is already valid
    const amt = pos.amount;
    if (amt > 0) {
      onSelect({
        token: pos.asset,
        chain: pos.chain,
        amount: amt,
        amountUsd: amt * (pos.priceUsd || 1),
        sourcePositionId: pos.positionType === 'supply' ? pos.id : undefined,
        positionType: pos.positionType === 'supply' ? 'supply' : 'wallet',
      });
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // allow decimal string
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      setAmountStr(val);
      if (selectedPosition) {
        const numericVal = parseFloat(val);
        if (!Number.isNaN(numericVal) && numericVal > 0 && numericVal <= selectedPosition.amount) {
          onSelect({
            token: selectedPosition.asset,
            chain: selectedPosition.chain,
            amount: numericVal,
            amountUsd: numericVal * (selectedPosition.priceUsd || 1),
            sourcePositionId:
              selectedPosition.positionType === 'supply' ? selectedPosition.id : undefined,
            positionType: selectedPosition.positionType === 'supply' ? 'supply' : 'wallet',
          });
        }
      }
    }
  };

  const handleMaxClick = () => {
    if (selectedPosition) {
      const maxVal = selectedPosition.amount.toString();
      setAmountStr(maxVal);
      onSelect({
        token: selectedPosition.asset,
        chain: selectedPosition.chain,
        amount: selectedPosition.amount,
        amountUsd: selectedPosition.amount * (selectedPosition.priceUsd || 1),
        sourcePositionId:
          selectedPosition.positionType === 'supply' ? selectedPosition.id : undefined,
        positionType: selectedPosition.positionType === 'supply' ? 'supply' : 'wallet',
      });
    }
  };

  // Check if we are complete (not active, and step has tokenOut filled)
  if (!isActive && step.tokenOut.amount > 0) {
    const isWallet = step.tokenOut.positionType === 'wallet';
    return (
      <button
        type="button"
        onClick={onFocus}
        className="w-56 min-h-48 text-left bg-verdant-paper border border-verdant-rule rounded-xl p-4 cursor-pointer hover:border-verdant-moss transition-all flex flex-col justify-between"
      >
        <div>
          <div className="fl-eyebrow mb-2">SOURCE</div>
          <div className="flex items-center gap-2 mb-2">
            <TokenIcon symbol={step.tokenOut.token} className="w-5 h-5" />
            <span className="font-semibold text-verdant-text-primary text-sm">
              {step.tokenOut.token}
            </span>
          </div>
          <div className="text-xs text-verdant-text-muted capitalize">{step.tokenOut.chain}</div>
          <div className="text-xs text-verdant-text-muted font-mono mt-1">
            {isWallet ? 'Wallet' : 'Aave supply'}
          </div>
        </div>
        <div className="mt-4 pt-2 border-t border-verdant-rule">
          <div className="font-mono text-sm font-bold text-verdant-text-primary">
            {formatToken(step.tokenOut.amount)} {step.tokenOut.token}
          </div>
          <div className="font-mono text-xs text-verdant-text-muted">
            {formatUsd(step.tokenOut.amountUsd)}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="w-56 min-h-48 bg-verdant-surface border-2 border-verdant-moss rounded-xl p-4 shadow-organic flex flex-col justify-between">
      <div>
        <div className="fl-eyebrow mb-2">SOURCE</div>

        {/* List of positions */}
        <div className="space-y-2 max-h-36 overflow-y-auto pr-1 mb-3 scrollbar-thin">
          {supplyPositions.length > 0 && (
            <div>
              <div className="field-label text-[9px] uppercase tracking-wider">
                Protocol Positions
              </div>
              {supplyPositions.map((pos) => {
                const isSel = pos.id === selectedPositionId;
                return (
                  <button
                    type="button"
                    key={pos.id}
                    onClick={() => handlePositionClick(pos)}
                    className={`w-full text-left flex items-center justify-between p-1.5 rounded text-xs cursor-pointer transition-colors ${
                      isSel
                        ? 'bg-verdant-moss/10 border border-verdant-moss/40'
                        : 'hover:bg-verdant-paper'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <TokenIcon symbol={pos.asset} className="w-4 h-4 shrink-0" />
                      <div className="truncate">
                        <div className="font-medium text-verdant-text-primary truncate">
                          {pos.asset}
                        </div>
                        <div className="text-[9px] text-verdant-text-muted truncate capitalize">
                          {pos.chain}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-[10px] text-verdant-text-primary font-bold">
                        {formatUsd(pos.amountUsd)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {walletPositions.length > 0 && (
            <div className="mt-2">
              <div className="field-label text-[9px] uppercase tracking-wider">Wallet</div>
              {walletPositions.map((pos) => {
                const id = `wallet-${pos.asset}-${pos.chain}`;
                const isSel = id === selectedPositionId;
                return (
                  <button
                    type="button"
                    key={pos.id}
                    onClick={() => handlePositionClick(pos)}
                    className={`w-full text-left flex items-center justify-between p-1.5 rounded text-xs cursor-pointer transition-colors ${
                      isSel
                        ? 'bg-verdant-moss/10 border border-verdant-moss/40'
                        : 'hover:bg-verdant-paper'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <TokenIcon symbol={pos.asset} className="w-4 h-4 shrink-0" />
                      <div className="truncate">
                        <div className="font-medium text-verdant-text-primary truncate">
                          {pos.asset}
                        </div>
                        <div className="text-[9px] text-verdant-text-muted truncate capitalize">
                          {pos.chain}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-[10px] text-verdant-text-primary font-bold">
                        {formatUsd(pos.amountUsd)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedPosition && (
        <div className="mt-2 pt-2 border-t border-verdant-rule/60">
          <div className="flex items-center justify-between gap-1">
            <span className="field-label mb-0 text-[10px] font-semibold">Amount</span>
            <span className="text-[10px] text-verdant-text-muted font-mono">
              Max: {formatToken(selectedPosition.amount)}
            </span>
          </div>
          <div className="relative mt-1 flex items-center">
            <input
              type="text"
              value={amountStr}
              onChange={handleAmountChange}
              placeholder="0.0"
              className="field-input font-mono pr-12"
            />
            <button
              type="button"
              onClick={handleMaxClick}
              className="absolute right-2 text-[10px] bg-verdant-moss/10 text-verdant-moss hover:bg-verdant-moss/20 font-bold px-1.5 py-0.5 rounded transition-colors"
            >
              MAX
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
