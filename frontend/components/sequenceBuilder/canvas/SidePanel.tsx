'use client';

import { useEffect, useRef } from 'react';
import { isPaletteOpen, PALETTE_METADATA } from '@/lib/sequenceBuilder/canvas';
import type {
  ActionType,
  BuilderStep,
  DepositDestination,
  TokenState,
} from '@/lib/sequenceBuilder/types';
import type { Position } from '@/types/position';
import type { BridgeId, ChainId } from '@/types/shared';
import { BridgeCard } from '../BridgeCard';
import { DepositCard } from '../DepositCard';
import { RepayAndWithdrawCard } from '../RepayAndWithdrawCard';
import { RepayCard } from '../RepayCard';
import { SourceCard } from '../SourceCard';
import { SwapCard } from '../SwapCard';
import { WithdrawCard } from '../WithdrawCard';
import { PalettePanel } from './PalettePanel';

export interface SidePanelProps {
  steps: BuilderStep[];
  activeStepIndex: number;
  userPositions: Position[];
  /**
   * Bumped by the parent whenever the control the user was on has just been
   * unmounted (a step added or removed, the palette pulled forward). Each bump
   * parks focus on this panel's heading instead of letting it fall to `<body>`
   * and restart the dialog's tab trap. `0` means "nothing happened yet".
   */
  focusNonce: number;
  onFocusStep: (index: number) => void;
  onFocusPalette: () => void;
  onAddAction: (kind: ActionType) => void;
  onSourceSelect: (tokenOut: TokenState) => void;
  onDepositSelect: (destination: DepositDestination) => void;
  onRepaySelect: (targetPositionId: string) => void;
  onWithdrawConfirm: (tokenOut: TokenState) => void;
  onRepayAndWithdrawSelect: (targetPositionId: string, tokenOut: TokenState) => void;
  onBridgeSelect: (
    toChain: ChainId,
    bridgeId: BridgeId,
    feeUsd: number,
    tokenOut: TokenState,
  ) => void;
  onSwapSelect: (toToken: string, feeUsd: number, tokenOut: TokenState) => void;
}

/**
 * Palette ⇄ config-form switcher. When the active step is the trailing
 * action-select the palette shows; otherwise the active step's existing
 * per-kind card is mounted (always `isActive`) — forms never live on the canvas.
 */
export function SidePanel({
  steps,
  activeStepIndex,
  userPositions,
  focusNonce,
  onFocusStep,
  onFocusPalette,
  onAddAction,
  onSourceSelect,
  onDepositSelect,
  onRepaySelect,
  onWithdrawConfirm,
  onRepayAndWithdrawSelect,
  onBridgeSelect,
  onSwapSelect,
}: SidePanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusNonce > 0) headingRef.current?.focus();
  }, [focusNonce]);

  const step = steps[activeStepIndex] ?? steps[steps.length - 1];
  const paletteMode = step.kind === 'action-select';
  const focusSelf = () => onFocusStep(activeStepIndex);
  // The palette is open behind a step the user navigated back to (or is still
  // typing into) — offer the way forward without stealing the form.
  const showContinue = !paletteMode && isPaletteOpen(steps);

  const eyebrow = paletteMode ? 'Next step' : `Step ${activeStepIndex + 1}`;
  const heading = paletteMode
    ? 'Add an action'
    : step.kind === 'source'
      ? 'Source of funds'
      : PALETTE_METADATA[step.kind].label;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-verdant-rule px-4 py-3">
        <p className="fl-eyebrow">{eyebrow}</p>
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="fl-serif mt-0.5 text-lg text-verdant-pine focus:outline-none"
        >
          {heading}
        </h3>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {paletteMode ? (
          <PalettePanel steps={steps} userPositions={userPositions} onAddAction={onAddAction} />
        ) : (
          // Re-key on index so switching between two steps of the same kind
          // remounts the card and re-seeds its internal state from the step.
          <div key={activeStepIndex} className="flex justify-center px-4 py-4">
            {step.kind === 'source' && (
              <SourceCard
                step={step}
                isActive
                userPositions={userPositions}
                onSelect={onSourceSelect}
                onFocus={focusSelf}
              />
            )}
            {step.kind === 'deposit' && (
              <DepositCard
                tokenIn={step.tokenIn}
                selectedDestination={step.destination.id ? step.destination : undefined}
                isActive
                onSelect={onDepositSelect}
                onFocus={focusSelf}
              />
            )}
            {step.kind === 'repay' && (
              <RepayCard
                tokenIn={step.tokenIn}
                userPositions={userPositions}
                selectedPositionId={step.targetPositionId || undefined}
                isActive
                onSelect={onRepaySelect}
                onFocus={focusSelf}
              />
            )}
            {step.kind === 'repayAndWithdraw' && (
              <RepayAndWithdrawCard
                tokenIn={step.tokenIn}
                userPositions={userPositions}
                selectedPositionId={step.targetPositionId || undefined}
                isActive
                onSelect={onRepayAndWithdrawSelect}
                onFocus={focusSelf}
              />
            )}
            {step.kind === 'bridge' && (
              <BridgeCard
                tokenIn={step.tokenIn}
                selectedToChain={step.toChain || undefined}
                selectedBridgeId={step.bridgeId || undefined}
                selectedFeeUsd={step.feeUsd || undefined}
                isActive
                onSelect={onBridgeSelect}
                onFocus={focusSelf}
              />
            )}
            {step.kind === 'swap' && (
              <SwapCard
                tokenIn={step.tokenIn}
                selectedToToken={step.toToken || undefined}
                selectedFeeUsd={step.feeUsd || undefined}
                isActive
                onSelect={onSwapSelect}
                onFocus={focusSelf}
              />
            )}
            {step.kind === 'withdraw' && (
              <WithdrawCard
                tokenIn={step.tokenIn}
                isActive
                onConfirm={onWithdrawConfirm}
                onFocus={focusSelf}
              />
            )}
          </div>
        )}
      </div>

      {showContinue && (
        <div className="border-t border-verdant-rule px-4 py-3">
          <button type="button" onClick={onFocusPalette} className="btn btn-primary btn-sm w-full">
            Choose next action →
          </button>
        </div>
      )}
    </div>
  );
}
