import React from 'react';
import { SequencePlan } from '@/types/sequencer';
import { SequenceProgress } from './SequenceProgress';
import { SequenceStepCard } from './SequenceStepCard';
import { formatUsd } from '@/lib/utils/formatting';
import { CostPreview } from '@/components/execute/CostPreview';
import { CostPreviewResult } from '@/types/quote';

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
  onRefetchCost
}: { 
  plan: SequencePlan, 
  currentStepId: string | null,
  onSimulate: (stepId: string) => void, 
  onSign: (stepId: string) => void, 
  onEdit: () => void,
  costResult?: CostPreviewResult | null,
  costLoading?: boolean,
  staleStepIds?: Set<string>,
  expiredStepIds?: Set<string>,
  hasExpiredQuotes?: boolean,
  onRefetchCost?: () => void
}) {
  const totalGasCost = plan.steps.reduce((acc, step) => acc + (step.simulation?.gasCostUsd || 0), 0);

  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <div className="mb-10 text-center">
        <h2 className="text-2xl font-bold text-verdant-text-primary mb-2">{plan.description}</h2>
        <div className="flex items-center justify-center gap-4 text-sm text-verdant-text-muted">
          <span>Created {new Date(plan.createdAt).toLocaleString()}</span>
          <span>•</span>
          <span>Estimated Cost: <span className="text-verdant-text-primary font-semibold font-mono">{formatUsd(totalGasCost)}</span></span>
        </div>
      </div>

      <SequenceProgress plan={plan} currentStepId={currentStepId} />

      <div className="mb-8">
        <CostPreview
          result={costResult}
          isLoading={costLoading}
          staleStepIds={staleStepIds}
          expiredStepIds={expiredStepIds}
          stepIds={plan.steps.map(s => s.id)}
          refetch={onRefetchCost}
        />
      </div>

      <div className="space-y-4">
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
        <div className="mt-6 p-3 bg-verdant-loss/10 border border-verdant-loss/30 rounded-lg flex justify-between items-center">
          <p className="text-verdant-loss text-sm">Bridge quote expired — refresh before signing</p>
          <button onClick={onRefetchCost} className="text-sm text-white bg-verdant-loss hover:bg-[#B04545] px-3 py-1 rounded transition-colors">
            Refresh Quotes
          </button>
        </div>
      )}

      <div className="mt-8 flex justify-center">
        <button 
          onClick={onEdit}
          className="text-sm text-verdant-text-muted hover:text-verdant-text-primary transition-colors"
        >
          Cancel and return to dashboard
        </button>
      </div>
    </div>
  );
}
