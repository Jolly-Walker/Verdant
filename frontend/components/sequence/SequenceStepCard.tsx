import React, { useState, useEffect } from 'react';
import { SequenceStep } from '@/types/sequencer';
import { getExplorerTxUrl, getChainDisplayName } from '@/lib/utils/chains';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { HealthFactor } from '@/components/ui/HealthFactor';
import { formatUsd } from '@/lib/utils/formatting';
import { WarningBanner } from '@/components/ui/WarningBanner';

import { SimulationResultView } from '@/components/execute/SimulationResult';

export function SequenceStepCard({ 
  step, 
  onSimulate, 
  onSign, 
  onEdit,
  isActive
}: { 
  step: SequenceStep, 
  onSimulate: () => void, 
  onSign: () => void, 
  onEdit: () => void,
  isActive: boolean
}) {
  const [hfConfirmed, setHfConfirmed] = useState(false);
  const [warningsConfirmed, setWarningsConfirmed] = useState(false);
  const [simulationReviewed, setSimulationReviewed] = useState(false);
  
  const isCompleted = step.status === 'confirmed';
  const isFailed = step.status === 'failed';
  const isReady = step.status === 'ready';
  const isSimulating = step.status === 'simulating';
  const isSigning = step.status === 'signing';

  const warnings = step.simulation?.warnings || [];
  const hasWarnings = warnings.length > 0;
  const needsHfConfirmation = step.projectedHealthFactor !== undefined && step.projectedHealthFactor < 1.5;
  
  const canSign = (!needsHfConfirmation || hfConfirmed) && 
                 (!hasWarnings || warningsConfirmed) && 
                 simulationReviewed;

  // Reset confirmations when step changes
  useEffect(() => {
    setHfConfirmed(false);
    setWarningsConfirmed(false);
    setSimulationReviewed(false);
  }, [step.id]);

  return (
    <Card className={`mb-4 overflow-hidden border-zinc-800 ${isActive ? 'ring-1 ring-emerald-500/50 bg-zinc-900/40' : 'opacity-60'}`}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-zinc-100">{step.label}</h3>
          <Badge variant="default" className="bg-zinc-800 text-zinc-400">
            {getChainDisplayName(step.chain)}
          </Badge>
        </div>
        <div className="flex items-center gap-4">
          {step.projectedHealthFactor !== undefined && (
            <HealthFactor value={step.projectedHealthFactor} />
          )}
          <div>
            {isCompleted && <Badge variant="success">Confirmed</Badge>}
            {isFailed && <Badge variant="error">Failed</Badge>}
            {isReady && <Badge variant="warning">Ready</Badge>}
            {(isSimulating || isSigning) && <Spinner size="sm" />}
          </div>
        </div>
      </div>

      <div className="px-6 py-4">
        {step.status === 'pending' && isActive && (
          <button 
            onClick={onSimulate}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-lg transition-colors shadow-lg shadow-emerald-900/20"
          >
            Simulate Step
          </button>
        )}

        {isSimulating && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Spinner size="sm" />
            <span>Simulating transaction on-chain...</span>
          </div>
        )}

        {isReady && step.simulation && (
          <div className="space-y-4">
            <SimulationResultView result={step.simulation} />

            {hasWarnings && (
              <div className="space-y-3">
                {warnings.map((warning, i) => (
                  <WarningBanner key={i} warning={warning} />
                ))}
                <div className="bg-amber-950/20 border border-amber-900/30 p-4 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <input 
                        type="checkbox" 
                        id={`confirm-warnings-${step.id}`}
                        checked={warningsConfirmed}
                        onChange={(e) => setWarningsConfirmed(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-emerald-600 focus:ring-emerald-600 focus:ring-offset-zinc-900"
                      />
                    </div>
                    <label htmlFor={`confirm-warnings-${step.id}`} className="text-sm text-amber-200 leading-tight cursor-pointer">
                      I have reviewed the warnings above and wish to proceed anyway.
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-zinc-800/30 border border-zinc-700/30 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <input 
                    type="checkbox" 
                    id={`review-sim-${step.id}`}
                    checked={simulationReviewed}
                    onChange={(e) => setSimulationReviewed(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-emerald-600 focus:ring-emerald-600 focus:ring-offset-zinc-900"
                  />
                </div>
                <label htmlFor={`review-sim-${step.id}`} className="text-sm text-zinc-300 leading-tight cursor-pointer">
                  I have reviewed the expected balance changes and wish to proceed.
                </label>
              </div>
            </div>

            {needsHfConfirmation && (
              <div className="bg-amber-950/20 border border-amber-900/30 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <input 
                      type="checkbox" 
                      id={`confirm-hf-${step.id}`}
                      checked={hfConfirmed}
                      onChange={(e) => setHfConfirmed(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-emerald-600 focus:ring-emerald-600 focus:ring-offset-zinc-900"
                    />
                  </div>
                  <label htmlFor={`confirm-hf-${step.id}`} className="text-sm text-amber-200 leading-tight cursor-pointer">
                    I understand this action brings my Health Factor to <span className="font-bold">{step.projectedHealthFactor?.toFixed(2)}</span>, 
                    increasing liquidation risk.
                  </label>
                </div>
              </div>
            )}

            <button 
              onClick={onSign} 
              disabled={!canSign}
              className={`w-full font-semibold py-2.5 rounded-lg transition-colors shadow-lg ${
                canSign 
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20' 
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none'
              }`}
            >
              Sign Transaction
            </button>
          </div>
        )}

        {isSigning && (
          <div className="flex flex-col items-center justify-center py-4 gap-3">
            <Spinner size="lg" />
            <p className="text-sm text-zinc-300 font-medium">Waiting for wallet signature...</p>
            <p className="text-xs text-zinc-500 text-center px-8">
              Please check your wallet extension to confirm the transaction.
            </p>
          </div>
        )}

        {isCompleted && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-emerald-400 font-medium">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Confirmed on-chain</span>
            </div>
            {step.txHash && (
              <a 
                href={getExplorerTxUrl(step.chain, step.txHash)} 
                target="_blank" 
                rel="noreferrer" 
                className="text-zinc-400 hover:text-zinc-200 underline underline-offset-4"
              >
                View Transaction
              </a>
            )}
          </div>
        )}

        {isFailed && (
          <div className="space-y-4">
            <div className="text-sm text-red-400 bg-red-950/20 border border-red-900/30 p-3 rounded-lg">
              <p className="font-semibold mb-1">
                {step.simulation?.success === false ? 'Simulation failed' : 'Execution failed'}
              </p>
              <p className="opacity-80">
                {step.simulation?.revertReason || 'The transaction was rejected or failed on-chain.'}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={onEdit} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium py-2 rounded-lg transition-colors">
                Edit Parameters
              </button>
              <button onClick={onSimulate} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold py-2 rounded-lg transition-colors">
                Retry Step
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
