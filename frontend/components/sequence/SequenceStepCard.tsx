'use client';

import React, { useState } from 'react';
import { SequenceStep } from '@/types/sequencer';
import { getExplorerTxUrl, getChainDisplayName } from '@/lib/utils/chains';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { useSequencer } from '@/hooks/useSequencer';
import { StepOneBridge } from '@/components/execute/StepOneBridge';
import { ChainId } from '@/types/shared';


interface SequenceStepCardProps {
  step: SequenceStep;
  index: number;
  isCurrent: boolean;
  onAction: (params?: Record<string, unknown>) => Promise<void>;
}

export function SequenceStepCard({
  step,
  index,
  isCurrent,
  onAction,
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

  const renderStepContent = () => {
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
      <div className="flex justify-between items-center">
        <div>
          <p className="text-zinc-400 text-sm">
            {step.unsignedTx?.description || `Step ${index + 1}: ${step.label}`}
          </p>
          {step.txHash && (
            <a
              href={getExplorerTxUrl(step.chain, step.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-500 text-xs hover:underline mt-1 inline-block"
            >
              View on Explorer
            </a>
          )}
        </div>
        <div>
          {step.status === 'confirmed' ? (
            <div className="flex items-center text-emerald-500">
              <span className="text-sm font-medium mr-2">Complete</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : step.status === 'ready' && isCurrent ? (
            <button
              onClick={handleAction}
              disabled={isSimulating}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {isSimulating ? (
                <div className="flex items-center">
                  <Spinner size="sm" className="mr-2" />
                  <span>Simulating...</span>
                </div>
              ) : (
                'Sign Transaction'
              )}
            </button>
          ) : step.status === 'pending' ? (
            <span className="text-zinc-500 text-sm">Waiting...</span>
          ) : step.status === 'ready' ? (
            <span className="text-emerald-400 text-sm">Verified</span>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <Card className={`p-4 border ${isCurrent ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/50'}`}>
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
          step.status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-500' :
          isCurrent ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-500'
        }`}>
          {index + 1}
        </div>
        <div className="flex-grow">
          <div className="flex justify-between items-center mb-2">
            <h4 className={`font-semibold ${isCurrent ? 'text-white' : 'text-zinc-400'}`}>
              {step.label}
            </h4>
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest bg-zinc-800 px-2 py-0.5 rounded">
              {getChainDisplayName(step.chain)}
            </span>
          </div>
          
          {renderStepContent()}

          {error && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-800 rounded-lg">
              <p className="text-red-400 text-xs">{error}</p>
              <button
                onClick={handleAction}
                className="mt-2 text-red-400 text-xs font-bold hover:underline"
              >
                Retry Action
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
