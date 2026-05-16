import React from 'react';
import { SequencePlan } from '@/lib/plugins/types/sequencer';

export function SequenceProgress({ plan, currentStepId }: { plan: SequencePlan, currentStepId: string | null }) {
  return (
    <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 mb-6">
      {plan.steps.map((step, idx) => {
        const isActive = step.id === currentStepId;
        const isCompleted = step.status === 'confirmed';
        const isFailed = step.status === 'failed';
        
        let icon = <span className="w-5 h-5 inline-block rounded-full border border-gray-400"></span>;
        if (isCompleted) icon = <span className="w-5 h-5 inline-flex items-center justify-center rounded-full bg-green-500 text-white text-xs">✓</span>;
        else if (isFailed) icon = <span className="w-5 h-5 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-xs">✕</span>;
        else if (isActive) icon = <span className="w-5 h-5 inline-block animate-spin rounded-full border-b-2 border-blue-500"></span>;

        return (
          <div key={step.id} className={`flex items-center space-x-2 ${isActive ? 'font-bold text-blue-600' : 'text-gray-600'}`}>
            {icon}
            <span className="text-sm">Step {idx + 1}: {step.label}</span>
          </div>
        );
      })}
    </div>
  );
}
