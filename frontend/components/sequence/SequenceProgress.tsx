import React from 'react';
import { SequencePlan } from '@/types/sequencer';
import { Spinner } from '@/components/ui/Spinner';

export function SequenceProgress({ plan, currentStepId }: { plan: SequencePlan; currentStepId: string | null }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between relative">
        {/* Background Line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-[#E5E0D8] -z-0" />
        
        {plan.steps.map((step, index) => {
          const isActive = step.id === currentStepId;
          const isCompleted = step.status === 'confirmed';
          const isFailed = step.status === 'failed';
          
          return (
            <div key={step.id} className="flex flex-col items-center relative z-10 bg-verdant-canvas px-4">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors
                  ${isCompleted ? 'bg-verdant-profit border-verdant-profit text-white' : 
                    isFailed ? 'bg-verdant-loss border-verdant-loss text-white' :
                    isActive ? 'bg-verdant-canvas border-verdant-moss text-verdant-moss' : 
                    'bg-verdant-canvas border-[#E5E0D8] text-verdant-text-muted'}`}
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
                  <Spinner size="sm" className={isActive ? 'text-verdant-moss' : 'text-verdant-text-muted'} />
                ) : (
                  <span className="font-semibold">{index + 1}</span>
                )}
              </div>
              <span className={`mt-2 text-xs font-medium text-center max-w-[120px] transition-colors
                ${isActive ? 'text-verdant-moss font-semibold' : isCompleted ? 'text-verdant-text-primary' : 'text-verdant-text-muted'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
