'use client';

import { createContext, type ReactNode, useContext, useState } from 'react';
import { StepOneBridge } from '@/components/execute/StepOneBridge';
import { Spinner } from '@/components/ui/Spinner';
import { WarningBanner } from '@/components/ui/WarningBanner';
import { getChainDisplayName, getExplorerTxUrl } from '@/lib/utils/chains';
import { formatToken, formatUsd } from '@/lib/utils/formatting';
import type { SequenceStep, StateChange } from '@/types/sequencer';
import type { ChainId } from '@/types/shared';

/**
 * Actions a step card needs but cannot reach on its own.
 *
 * `useSequencer` keeps the plan in per-instance `useState`, so calling the hook
 * again inside this card yields an instance with `plan === null` — every action
 * on it throws "No active plan". The card also renders two levels below the
 * page (page -> SequencePlanView -> card) and SequencePlanView forwards only
 * `onAction`, so the callbacks arrive through context instead of props.
 */
export interface SequenceStepActions {
  /** Re-run the mandatory simulation gate for a step. */
  simulateStep: (stepId: string) => Promise<unknown>;
  /** Record an out-of-band transaction (the bridge widget) as confirmed. */
  completeStep: (stepId: string, txHash: string) => Promise<void>;
}

function noProvider(): never {
  throw new Error('SequenceStepCard must be rendered inside <SequenceStepActionsProvider>');
}

const SequenceStepActionsContext = createContext<SequenceStepActions>({
  simulateStep: async () => noProvider(),
  completeStep: async () => noProvider(),
});

export function SequenceStepActionsProvider({
  actions,
  children,
}: {
  actions: SequenceStepActions;
  children: ReactNode;
}) {
  return (
    <SequenceStepActionsContext.Provider value={actions}>
      {children}
    </SequenceStepActionsContext.Provider>
  );
}

interface SequenceStepCardProps {
  step: SequenceStep;
  index: number;
  isCurrent: boolean;
  onAction: (params?: Record<string, unknown>) => Promise<void>;
  isQuoteExpired?: boolean;
}

function ChainTag({ chain }: { chain: ChainId }) {
  return (
    <span className="inline-flex items-center rounded border border-verdant-rule bg-verdant-paper px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-verdant-text-muted">
      {getChainDisplayName(chain)}
    </span>
  );
}

function LeafCheck() {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-verdant-profit/12 text-verdant-profit-bright ring-1 ring-verdant-profit/25">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" role="img" aria-label="Passed">
        <path
          d="M5 12.5l4.2 4.2L19 7"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function RevertMark() {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-verdant-loss/12 text-verdant-loss-bright ring-1 ring-verdant-loss/25">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" role="img" aria-label="Failed">
        <path
          d="M7 7l10 10M17 7L7 17"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function formatStateChange(c: StateChange): { text: string; positive: boolean } {
  const n = Number(c.change) / 10 ** c.decimals;
  const sign = n > 0 ? '+' : '';
  const value = formatToken(n, Number.isInteger(n) ? 0 : 4);
  return { text: `${sign}${value} ${c.asset}`, positive: n >= 0 };
}

export function SequenceStepCard({
  step,
  index,
  isCurrent,
  onAction,
  isQuoteExpired,
}: SequenceStepCardProps) {
  const { simulateStep, completeStep } = useContext(SequenceStepActionsContext);
  const [isSigning, setIsSigning] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async () => {
    setError(null);
    setIsSigning(true);
    try {
      await onAction();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Action failed';
      setError(message);
    } finally {
      setIsSigning(false);
    }
  };

  // Re-running the simulation gate is the only legal way out of `failed`:
  // a step may not reach the sign prompt again until it passes.
  const handleRetrySimulation = async () => {
    setError(null);
    setIsRetrying(true);
    try {
      await simulateStep(step.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not re-run the simulation';
      setError(message);
    } finally {
      setIsRetrying(false);
    }
  };

  const sim = step.simulation;
  const isFailed = step.status === 'failed';
  // The simulate route answers HTTP 200 for an on-chain revert and stores the
  // reason on the step, so a reverted gate is `status: failed` + `success: false`.
  const reverted = isFailed && sim?.success === false;
  // Bridge steps are the only ones whose buildParams carry from/to chains;
  // discriminating on the shape rather than the step id keeps plans with
  // differently named (or multiple) bridge steps working.
  const isBridgeStep = 'fromChain' in step.buildParams;
  const showSimGate = !!sim?.success && !isFailed && !isBridgeStep;
  const warnings = sim?.warnings ?? [];

  const renderSimGate = () => {
    if (!showSimGate || !sim) return null;
    return (
      <div className="mt-4 rounded-xl border border-verdant-rule bg-verdant-paper/50 p-4">
        <div className="flex items-center gap-3">
          <LeafCheck />
          <div>
            <p className="fl-serif text-[15px] text-verdant-text-primary">Simulation passed</p>
            <p className="font-mono text-[11px] text-verdant-text-muted">
              eth_call{sim.gasCostUsd != null ? ` · gas ${formatUsd(sim.gasCostUsd)}` : ''}
            </p>
          </div>
        </div>
        {sim.stateChanges && sim.stateChanges.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {sim.stateChanges.map((c) => {
              const { text, positive } = formatStateChange(c);
              return (
                <span
                  key={`${c.assetAddress}-${c.chainId}-${c.type}`}
                  className={`inline-flex items-center gap-1.5 rounded-md border border-verdant-rule bg-verdant-surface px-2.5 py-1 font-mono text-xs tabular-nums ${
                    positive ? 'text-verdant-profit' : 'text-verdant-loss'
                  }`}
                >
                  {text}
                  <span className="text-[10px] uppercase tracking-wide text-verdant-text-muted">
                    {getChainDisplayName(c.chainId as ChainId)}
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderSimFailure = () => {
    if (!isFailed) return null;

    // Three ways a step lands here: the gate reverted, the gate could not be
    // reached at all, or a simulated-clean step failed while being broadcast.
    const heading = reverted ? 'Simulation failed' : 'Step blocked';
    const meta = reverted ? 'eth_call · reverted' : 'simulation gate · not passed';
    const fallback = sim?.success
      ? 'The transaction was not completed. Nothing is confirmed on-chain — the step must clear simulation again before it can be signed.'
      : 'The simulation could not be completed, so this step has not been cleared to sign.';

    return (
      <div className="mt-4 rounded-xl border border-verdant-loss/30 bg-verdant-loss/[0.06] p-4">
        <div className="flex items-start gap-3">
          <RevertMark />
          <div className="min-w-0 flex-1">
            <p className="fl-serif text-[15px] text-verdant-text-primary">{heading}</p>
            <p className="font-mono text-[11px] text-verdant-text-muted">{meta}</p>

            {reverted ? (
              <p className="mt-2.5 break-words font-mono text-[12.5px] leading-relaxed text-verdant-loss">
                {sim?.revertReason || 'This transaction is expected to revert on-chain.'}
              </p>
            ) : (
              <p className="mt-2.5 text-sm leading-relaxed text-verdant-loss">{fallback}</p>
            )}

            {sim?.revertData && (
              <details className="mt-3 overflow-hidden rounded-lg border border-verdant-rule bg-verdant-surface/70">
                <summary className="cursor-pointer select-none px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-verdant-text-muted">
                  Revert data
                </summary>
                <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-all border-t border-verdant-rule px-3 py-2 font-mono text-[10px] leading-relaxed text-verdant-text-muted">
                  {sim.revertData}
                </pre>
              </details>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={handleRetrySimulation}
            disabled={isRetrying}
            className="btn btn-primary btn-sm"
          >
            {isRetrying ? (
              <>
                <Spinner size="sm" tone="onDark" />
                <span>Re-simulating…</span>
              </>
            ) : (
              'Retry simulation'
            )}
          </button>
          <p className="text-xs text-verdant-text-muted">
            Nothing was signed — no funds have moved.
          </p>
        </div>

        {error && <p className="mt-3 text-xs font-medium text-verdant-loss">{error}</p>}
      </div>
    );
  };

  const renderWarnings = () => {
    // Warnings describe what signing would cost; they are noise once confirmed.
    if (warnings.length === 0 || step.status === 'confirmed') return null;
    return (
      <div className="mt-4 space-y-2">
        {warnings.map((w) => (
          <WarningBanner key={`${w.type}-${w.message}`} message={w.message} />
        ))}
      </div>
    );
  };

  const renderAction = () => {
    if (isBridgeStep && isCurrent && step.status === 'ready') {
      // @ts-expect-error - bridge params structure
      const { fromChain, toChain, token, amount, amountUsd } = step.buildParams;
      return (
        <StepOneBridge
          fromChain={fromChain as ChainId}
          toChain={toChain as ChainId}
          token={token as string}
          amount={amount as string}
          amountUsd={amountUsd as number}
          onComplete={(hash) => {
            completeStep(step.id, hash).catch((err: unknown) => {
              setError(
                err instanceof Error ? err.message : 'Could not record the bridge transaction',
              );
            });
          }}
        />
      );
    }

    return (
      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-sm text-verdant-text-muted">
          {step.unsignedTx?.description || `Step ${index + 1}: ${step.label}`}
        </p>

        {step.status === 'confirmed' ? (
          <div className="flex shrink-0 items-center gap-2 text-verdant-profit">
            <span className="text-sm font-medium">Complete</span>
            {step.txHash && (
              <a
                href={getExplorerTxUrl(step.chain, step.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs underline-offset-2 hover:underline"
              >
                explorer
              </a>
            )}
          </div>
        ) : step.status === 'failed' ? (
          // The failure panel above carries the reason and the retry button.
          <span className="shrink-0 text-sm font-medium text-verdant-loss">Blocked</span>
        ) : step.status === 'simulating' ? (
          <span className="flex shrink-0 items-center gap-2 text-sm text-verdant-text-muted">
            <Spinner size="sm" />
            <span>Simulating…</span>
          </span>
        ) : step.status === 'signing' ? (
          <span className="flex shrink-0 items-center gap-2 text-sm text-verdant-text-muted">
            <Spinner size="sm" />
            <span>Awaiting wallet…</span>
          </span>
        ) : step.status === 'ready' && isCurrent ? (
          <button
            type="button"
            onClick={handleAction}
            disabled={isSigning || isQuoteExpired}
            title={isQuoteExpired ? 'Bridge quote expired — refresh cost preview' : undefined}
            className="btn btn-primary shrink-0 shadow-organic hover:shadow-organic-lg"
          >
            {isSigning ? (
              <span className="flex items-center">
                <Spinner size="sm" tone="onDark" className="mr-2" />
                <span>Awaiting wallet…</span>
              </span>
            ) : isQuoteExpired ? (
              'Quote Expired'
            ) : (
              `Sign & execute · Step ${index + 1}`
            )}
          </button>
        ) : step.status === 'pending' ? (
          <span className="shrink-0 text-sm text-verdant-text-muted">Waiting…</span>
        ) : (
          <span className="shrink-0 text-sm text-verdant-profit">Verified</span>
        )}
      </div>
    );
  };

  const cardCls = isFailed
    ? 'border-verdant-loss/45 bg-verdant-surface shadow-organic'
    : isCurrent
      ? 'border-verdant-moss/60 bg-verdant-surface shadow-organic-xl'
      : step.status === 'confirmed'
        ? 'border-verdant-rule bg-verdant-paper/40'
        : 'border-verdant-rule bg-verdant-surface shadow-organic';

  const numeralCls = isFailed
    ? 'text-verdant-loss'
    : isCurrent
      ? 'text-verdant-moss'
      : step.status === 'confirmed'
        ? 'text-verdant-pine'
        : 'text-verdant-rule-strong';

  return (
    <div className={`rounded-2xl border p-5 transition-colors ${cardCls}`}>
      <div className="flex items-start gap-3.5">
        <span className={`fl-numeral shrink-0 pt-0.5 text-2xl ${numeralCls}`} aria-hidden>
          {String(index + 1).padStart(2, '0')}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="fl-serif text-lg text-verdant-text-primary">{step.label}</h4>
            <ChainTag chain={step.chain} />
          </div>

          {renderSimGate()}
          {renderSimFailure()}
          {renderWarnings()}
          {renderAction()}

          {/* Failed steps show their error inside the failure panel, next to the
              retry that re-runs the simulation gate. */}
          {error && !isFailed && (
            <div className="mt-4 rounded-lg border border-verdant-loss/30 bg-verdant-loss/10 p-3">
              <p className="text-xs text-verdant-loss">{error}</p>
              <button
                type="button"
                onClick={handleAction}
                className="mt-2 text-xs font-bold text-verdant-loss hover:underline"
              >
                Retry Action
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
