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
  isQuoteExpired?: boolean;
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
          <p className="text-verdant-text-muted text-sm">
            {step.unsignedTx?.description || `Step ${index + 1}: ${step.label}`}
          </p>
          {step.txHash && (
            <a
              href={getExplorerTxUrl(step.chain, step.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-verdant-profit text-xs hover:underline mt-1 inline-block"
            >
              View on Explorer
            </a>
          )}
        </div>
        <div>
          {step.status === 'confirmed' ? (
            <div className="flex items-center text-verdant-profit">
              <span className="text-sm font-medium mr-2">Complete</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : step.status === 'ready' && isCurrent ? (
            <button
              onClick={handleAction}
              disabled={isSimulating || isQuoteExpired}
              title={isQuoteExpired ? 'Bridge quote expired — refresh cost preview' : undefined}
              className="bg-verdant-moss hover:bg-verdant-moss-dark text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {isSimulating ? (
                <div className="flex items-center">
                  <Spinner size="sm" className="mr-2" />
                  <span>Simulating...</span>
                </div>
              ) : isQuoteExpired ? (
                'Quote Expired'
              ) : (
                'Sign Transaction'
              )}
            </button>
          ) : step.status === 'pending' ? (
            <span className="text-verdant-text-muted text-sm">Waiting...</span>
          ) : step.status === 'ready' ? (
            <span className="text-verdant-profit text-sm">Verified</span>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <Card className={`p-4 border ${isCurrent ? 'border-verdant-moss/50 bg-verdant-surface-accent' : 'border-[#E5E0D8] bg-verdant-surface shadow-organic'}`}>
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
          step.status === 'confirmed' ? 'bg-verdant-surface-accent text-verdant-profit border border-verdant-profit/20' :
          isCurrent ? 'bg-verdant-moss text-white' : 'bg-verdant-surface-accent text-verdant-text-muted border border-[#E5E0D8]'
        }`}>
          {index + 1}
        </div>
        <div className="flex-grow">
          <div className="flex justify-between items-center mb-2">
            <h4 className={`font-semibold ${isCurrent ? 'text-verdant-text-primary' : 'text-verdant-text-muted'}`}>
              {step.label}
            </h4>
            <span className="text-[10px] text-verdant-text-muted uppercase tracking-widest bg-verdant-surface border border-[#E5E0D8] px-2 py-0.5 rounded">
              {getChainDisplayName(step.chain)}
            </span>
          </div>
          
          {renderStepContent()}
 
          {error && (
            <div className="mt-4 p-3 bg-verdant-loss/10 border border-verdant-loss/30 rounded-lg">
              <p className="text-verdant-loss text-xs">{error}</p>
              <button
                onClick={handleAction}
                className="mt-2 text-verdant-loss text-xs font-bold hover:underline"
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
