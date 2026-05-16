import React from 'react';
import { SequencePlan } from '@/lib/plugins/types/sequencer';
import { SequenceProgress } from './SequenceProgress';
import { SequenceStepCard } from './SequenceStepCard';

export function SequencePlanView({
  plan,
  currentStepId,
  onSimulate,
  onSign,
  onEdit
}: {
  plan: SequencePlan;
  currentStepId: string | null;
  onSimulate: (id: string) => void;
  onSign: (id: string) => void;
  onEdit: () => void;
}) {
  const estimatedCost = plan.steps.reduce((acc, step) => acc + (step.simulation?.gasCostUsd || 0), 0);

  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-2">{plan.description}</h1>
      <p className="text-gray-500 mb-6">Created at: {new Date(plan.createdAt).toLocaleString()}</p>
      
      <SequenceProgress plan={plan} currentStepId={currentStepId} />

      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h2 className="font-semibold mb-2">Total Estimated Cost</h2>
        <p className="text-xl">${estimatedCost.toFixed(2)}</p>
      </div>

      <div>
        {plan.steps.map(step => (
          <SequenceStepCard
            key={step.id}
            step={step}
            onSimulate={() => onSimulate(step.id)}
            onSign={() => onSign(step.id)}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  );
}
