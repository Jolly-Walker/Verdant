'use client';

import { useRouter } from 'next/navigation';
import { getChainDisplayName, getExplorerTxUrl } from '@/lib/utils/chains';
import { formatUsd } from '@/lib/utils/formatting';
import type { SequencePlan } from '@/types/sequencer';
import fl from './fieldLedger.module.css';

export function SequenceComplete({ plan }: { plan: SequencePlan }) {
  const router = useRouter();
  const totalGasCost = plan.steps.reduce(
    (acc, step) => acc + (step.simulation?.gasCostUsd || 0),
    0,
  );

  return (
    <div className="relative min-h-screen bg-verdant-paper">
      <div className={fl.grain} aria-hidden />

      <div className="relative z-10 mx-auto max-w-xl px-6 py-20 text-center">
        <span className="mx-auto mb-8 grid h-20 w-20 place-items-center rounded-full bg-verdant-profit/12 ring-1 ring-verdant-profit/30">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            role="img"
            aria-label="Complete"
          >
            <path
              d="M5 12.5l4.2 4.2L19 7"
              stroke="#27AE60"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <h2 className={`${fl.serif} text-4xl text-verdant-pine`}>Sequence complete</h2>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-verdant-text-muted">
          Every step was simulated, signed, and confirmed on-chain. Your position has been moved.
        </p>

        <div className="mt-10 overflow-hidden rounded-2xl border border-verdant-rule bg-verdant-surface text-left shadow-organic">
          <div className="flex items-center justify-between px-6 py-4">
            <span className="text-sm text-verdant-text-muted">Total switching cost</span>
            <span className="font-mono text-base font-semibold text-verdant-text-primary tabular-nums">
              {formatUsd(totalGasCost)}
            </span>
          </div>
          <hr className={`${fl.doubleRule} mx-6`} />
          <ul className="divide-y divide-verdant-rule/70">
            {plan.steps.map((step, i) => (
              <li key={step.id} className="flex items-center justify-between gap-4 px-6 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`${fl.numeral} text-lg text-verdant-pine`} aria-hidden>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-verdant-text-primary">{step.label}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-verdant-text-muted">
                      {getChainDisplayName(step.chain)}
                    </p>
                  </div>
                </div>
                {step.txHash && (
                  <a
                    href={getExplorerTxUrl(step.chain, step.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 font-mono text-xs font-medium text-verdant-profit underline-offset-2 hover:underline"
                  >
                    View tx
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="mt-10 rounded-lg bg-verdant-moss px-8 py-3 font-semibold text-white shadow-organic-lg transition-all hover:bg-verdant-moss-dark active:scale-[0.98]"
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}
