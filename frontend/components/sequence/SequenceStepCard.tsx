'use client';

import { useState } from 'react';
import { StepOneBridge } from '@/components/execute/StepOneBridge';
import { Spinner } from '@/components/ui/Spinner';
import { useSequencer } from '@/hooks/useSequencer';
import { getChainDisplayName, getExplorerTxUrl } from '@/lib/utils/chains';
import { formatToken, formatUsd } from '@/lib/utils/formatting';
import type { SequenceStep, StateChange } from '@/types/sequencer';
import type { ChainId } from '@/types/shared';
import fl from './fieldLedger.module.css';

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
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-verdant-profit/12 ring-1 ring-verdant-profit/25">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" role="img" aria-label="Passed">
        <path
          d="M5 12.5l4.2 4.2L19 7"
          stroke="#27AE60"
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
  const { signStep } = useSequencer();
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async () => {
    setError(null);
    setIsSimulating(true);
    try {
      await onAction();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Action failed';
      setError(message);
    } finally {
      setIsSimulating(false);
    }
  };

  const sim = step.simulation;
  const showSimGate = !!sim?.success && step.id !== 'bridge';

  const renderSimGate = () => {
    if (!showSimGate || !sim) return null;
    return (
      <div className="mt-4 rounded-xl border border-verdant-rule bg-verdant-paper/50 p-4">
        <div className="flex items-center gap-3">
          <LeafCheck />
          <div>
            <p className={`${fl.serif} text-[15px] text-verdant-text-primary`}>Simulation passed</p>
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

  const renderAction = () => {
    if (step.id === 'bridge' && isCurrent && step.status === 'ready') {
      // @ts-expect-error - bridge params structure
      const { fromChain, toChain, token, amount, amountUsd } = step.buildParams;
      return (
        <StepOneBridge
          fromChain={fromChain as ChainId}
          toChain={toChain as ChainId}
          token={token as string}
          amount={amount as string}
          amountUsd={amountUsd as number}
          onComplete={(hash) => signStep(step.id, hash)}
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
        ) : step.status === 'ready' && isCurrent ? (
          <button
            type="button"
            onClick={handleAction}
            disabled={isSimulating || isQuoteExpired}
            title={isQuoteExpired ? 'Bridge quote expired — refresh cost preview' : undefined}
            className="shrink-0 rounded-lg bg-verdant-moss px-5 py-2.5 text-sm font-semibold text-white shadow-organic transition-all hover:bg-verdant-moss-dark hover:shadow-organic-lg active:scale-[0.98] disabled:opacity-50"
          >
            {isSimulating ? (
              <span className="flex items-center">
                <Spinner size="sm" className="mr-2" />
                <span>Simulating…</span>
              </span>
            ) : isQuoteExpired ? (
              'Quote Expired'
            ) : (
              `Sign & execute · Step ${index + 1}`
            )}
          </button>
        ) : step.status === 'pending' ? (
          <span className="shrink-0 text-sm text-verdant-text-muted">Waiting…</span>
        ) : step.status === 'ready' ? (
          <span className="shrink-0 text-sm text-verdant-profit">Verified</span>
        ) : null}
      </div>
    );
  };

  const cardCls = isCurrent
    ? 'border-verdant-moss/60 bg-verdant-surface shadow-organic-xl'
    : step.status === 'confirmed'
      ? 'border-verdant-rule bg-verdant-paper/40'
      : 'border-verdant-rule bg-verdant-surface shadow-organic';

  return (
    <div className={`rounded-2xl border p-5 transition-colors ${cardCls}`}>
      <div className="flex items-start gap-3.5">
        <span
          className={`${fl.numeral} shrink-0 pt-0.5 text-2xl ${
            isCurrent
              ? 'text-verdant-moss'
              : step.status === 'confirmed'
                ? 'text-verdant-pine'
                : 'text-verdant-rule-strong'
          }`}
          aria-hidden
        >
          {String(index + 1).padStart(2, '0')}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4
              className={`${fl.serif} text-lg ${
                isCurrent ? 'text-verdant-text-primary' : 'text-verdant-text-primary'
              }`}
            >
              {step.label}
            </h4>
            <ChainTag chain={step.chain} />
          </div>

          {renderSimGate()}
          {renderAction()}

          {error && (
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
