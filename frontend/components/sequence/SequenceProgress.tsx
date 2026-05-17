import React from 'react';
import { SequencePlan } from '@/types/sequencer';
import { Spinner } from '@/components/ui/Spinner';

export function SequenceProgress({ plan, currentStepId }: { plan: SequencePlan; currentStepId: string | null }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between relative">
        {/* Background Line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-zinc-800 -z-0" />
        
        {plan.steps.map((step, index) => {
          const isActive = step.id === currentStepId;
          const isCompleted = step.status === 'confirmed';
          const isFailed = step.status === 'failed';
          
          return (
            <div key={step.id} className="flex flex-col items-center relative z-10 bg-zinc-950 px-4">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors
                  ${isCompleted ? 'bg-emerald-600 border-emerald-600' : 
                    isFailed ? 'bg-red-600 border-red-600' :
                    isActive ? 'bg-zinc-950 border-emerald-500 text-emerald-500' : 
                    'bg-zinc-950 border-zinc-800 text-zinc-500'}`}
              >
                {isCompleted ? (
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : isFailed ? (
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : step.status === 'simulating' || step.status === 'signing' ? (
                  <Spinner size="sm" className={isActive ? 'text-emerald-500' : 'text-zinc-500'} />
                ) : (
                  <span className="font-semibold">{index + 1}</span>
                )}
              </div>
              <span className={`mt-2 text-xs font-medium text-center max-w-[120px] transition-colors
                ${isActive ? 'text-emerald-400' : isCompleted ? 'text-zinc-300' : 'text-zinc-500'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
