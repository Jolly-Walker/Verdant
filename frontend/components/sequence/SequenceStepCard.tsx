import React from 'react';
import { SequenceStep } from '@/lib/plugins/types/sequencer';
import { getExplorerTxUrl, getChainDisplayName } from '@/lib/utils/chains';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatUsd } from '@/lib/utils/formatting';

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
  const isCompleted = step.status === 'confirmed';
  const isFailed = step.status === 'failed';
  const isReady = step.status === 'ready';
  const isSimulating = step.status === 'simulating';
  const isSigning = step.status === 'signing';

  return (
    <Card className={`mb-4 overflow-hidden border-zinc-800 ${isActive ? 'ring-1 ring-emerald-500/50 bg-zinc-900/40' : 'opacity-60'}`}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-zinc-100">{step.label}</h3>
          <Badge variant="default" className="bg-zinc-800 text-zinc-400">
            {getChainDisplayName(step.chain)}
          </Badge>
        </div>
        <div>
          {isCompleted && <Badge variant="success">Confirmed</Badge>}
          {isFailed && <Badge variant="error">Failed</Badge>}
          {isReady && <Badge variant="warning">Ready</Badge>}
          {(isSimulating || isSigning) && <Spinner size="sm" />}
        </div>
      </div>

      <div className="px-6 py-4">
        {isSimulating && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Spinner size="sm" />
            <span>Simulating transaction on-chain...</span>
          </div>
        )}

        {isReady && step.simulation?.success === true && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 p-3 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Simulation passed. Estimated gas: <span className="font-bold">{formatUsd(step.simulation.gasCostUsd || 0)}</span></span>
            </div>
            <button 
              onClick={onSign} 
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-lg transition-colors shadow-lg shadow-emerald-900/20"
            >
              Sign Transaction
            </button>
          </div>
        )}

        {isReady && step.simulation?.success === false && (
          <div className="space-y-4">
            <div className="text-sm text-red-400 bg-red-950/20 border border-red-900/30 p-3 rounded-lg">
              <p className="font-semibold mb-1">Simulation failed</p>
              <p className="opacity-80">{step.simulation?.revertReason || 'The transaction would revert if executed.'}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={onEdit} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium py-2 rounded-lg transition-colors">
                Edit Parameters
              </button>
              <button onClick={onSimulate} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium py-2 rounded-lg transition-colors">
                Retry Simulation
              </button>
            </div>
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
              <p className="font-semibold mb-1">Execution failed</p>
              <p className="opacity-80">The transaction was rejected or failed on-chain.</p>
            </div>
            <button onClick={onSimulate} className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold py-2.5 rounded-lg transition-colors">
              Retry Step
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
