import { CostPreview } from '@/components/execute/CostPreview';
import { formatUsd } from '@/lib/utils/formatting';
import type { CostPreviewResult } from '@/types/quote';
import type { SequencePlan } from '@/types/sequencer';
import fl from './fieldLedger.module.css';
import { SequenceProgress } from './SequenceProgress';
import { SequenceStepCard } from './SequenceStepCard';

export function SequencePlanView({
  plan,
  currentStepId,
  onSimulate: _onSimulate,
  onSign,
  onEdit,
  costResult = null,
  costLoading = false,
  staleStepIds,
  expiredStepIds,
  hasExpiredQuotes = false,
  onRefetchCost,
}: {
  plan: SequencePlan;
  currentStepId: string | null;
  onSimulate: (stepId: string) => void;
  onSign: (stepId: string) => void;
  onEdit: () => void;
  costResult?: CostPreviewResult | null;
  costLoading?: boolean;
  staleStepIds?: Set<string>;
  expiredStepIds?: Set<string>;
  hasExpiredQuotes?: boolean;
  onRefetchCost?: () => void;
}) {
  const totalGasCost = plan.steps.reduce(
    (acc, step) => acc + (step.simulation?.gasCostUsd || 0),
    0,
  );
  const estCost = plan.totalCostUsd || totalGasCost;
  const confirmedCount = plan.steps.filter((s) => s.status === 'confirmed').length;

  const meta: { label: string; value: string; mono?: boolean }[] = [
    ...(plan.templateId ? [{ label: 'Template', value: plan.templateId, mono: true }] : []),
    { label: 'Created', value: new Date(plan.createdAt).toLocaleDateString() },
    { label: 'Est. cost', value: formatUsd(estCost), mono: true },
    { label: 'Progress', value: `${confirmedCount} of ${plan.steps.length} confirmed` },
  ];

  return (
    <div className="relative min-h-screen bg-verdant-paper">
      <div className={fl.grain} aria-hidden />

      <div className="relative z-10 mx-auto max-w-[1180px] px-6 py-12 lg:py-14">
        {/* ---------- Masthead ---------- */}
        <header>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-verdant-teak">
            Transaction sequence
          </p>
          <h2 className={`${fl.serif} mt-2 text-4xl leading-[1.02] text-verdant-pine lg:text-5xl`}>
            {plan.description}
          </h2>

          <dl className="mt-7 flex flex-wrap items-end gap-x-9 gap-y-4">
            {meta.map((m) => (
              <div key={m.label}>
                <dt className="text-[11px] font-semibold uppercase tracking-widest text-verdant-text-muted">
                  {m.label}
                </dt>
                <dd
                  className={`mt-1 text-[15px] text-verdant-text-primary ${m.mono ? 'font-mono' : ''}`}
                >
                  {m.value}
                </dd>
              </div>
            ))}
          </dl>

          <hr className={`${fl.doubleRule} mt-8`} />
        </header>

        {/* ---------- Body: spine rail + active column ---------- */}
        <div className="mt-11 grid gap-10 lg:grid-cols-[290px_1fr]">
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <h3 className="mb-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-verdant-text-muted">
              Execution spine
            </h3>
            <SequenceProgress plan={plan} currentStepId={currentStepId} />
          </aside>

          <section className="min-w-0">
            <CostPreview
              result={costResult}
              isLoading={costLoading}
              staleStepIds={staleStepIds}
              expiredStepIds={expiredStepIds}
              stepIds={plan.steps.map((s) => s.id)}
              refetch={onRefetchCost}
            />

            <div className="mt-8 space-y-4">
              {plan.steps.map((step, index) => (
                <SequenceStepCard
                  key={step.id}
                  step={step}
                  index={index}
                  isCurrent={step.id === currentStepId}
                  onAction={async () => onSign(step.id)}
                  isQuoteExpired={expiredStepIds?.has(step.id) ?? false}
                />
              ))}
            </div>

            {hasExpiredQuotes && (
              <div className="mt-6 flex items-center justify-between rounded-xl border border-verdant-loss/30 bg-verdant-loss/10 p-3">
                <p className="text-sm text-verdant-loss">
                  Bridge quote expired — refresh before signing
                </p>
                <button
                  type="button"
                  onClick={onRefetchCost}
                  className="rounded-md bg-verdant-loss px-3 py-1 text-sm text-white transition-colors hover:bg-[#B04545]"
                >
                  Refresh Quotes
                </button>
              </div>
            )}

            <div className="mt-8">
              <button
                type="button"
                onClick={onEdit}
                className="text-sm text-verdant-text-muted underline-offset-4 transition-colors hover:text-verdant-text-primary hover:underline"
              >
                Cancel and return to dashboard
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
