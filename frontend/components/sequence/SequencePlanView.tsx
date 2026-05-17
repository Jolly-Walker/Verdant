import React from 'react';
import { SequencePlan } from '@/types/sequencer';
import { SequenceProgress } from './SequenceProgress';
import { SequenceStepCard } from './SequenceStepCard';
import { formatUsd } from '@/lib/utils/formatting';

export function SequencePlanView({ 
  plan, 
  currentStepId, 
  onSimulate, 
  onSign, 
  onEdit 
}: { 
  plan: SequencePlan, 
  currentStepId: string | null,
  onSimulate: (stepId: string) => void, 
  onSign: (stepId: string) => void, 
  onEdit: () => void 
}) {
  const totalGasCost = plan.steps.reduce((acc, step) => acc + (step.simulation?.gasCostUsd || 0), 0);

  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <div className="mb-10 text-center">
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">{plan.description}</h2>
        <div className="flex items-center justify-center gap-4 text-sm text-zinc-500">
          <span>Created {new Date(plan.createdAt).toLocaleString()}</span>
          <span>•</span>
          <span>Estimated Cost: <span className="text-zinc-300 font-semibold">{formatUsd(totalGasCost)}</span></span>
        </div>
      </div>

      <SequenceProgress plan={plan} currentStepId={currentStepId} />

      <div className="space-y-4">
        {plan.steps.map((step) => (
          <SequenceStepCard
            key={step.id}
            step={step}
            isActive={step.id === currentStepId}
            onSimulate={() => onSimulate(step.id)}
            onSign={() => onSign(step.id)}
            onEdit={onEdit}
          />
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        <button 
          onClick={onEdit}
          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Cancel and return to dashboard
        </button>
      </div>
    </div>
  );
}
