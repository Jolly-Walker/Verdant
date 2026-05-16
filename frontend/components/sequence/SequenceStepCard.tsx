import React from 'react';
import { SequenceStep } from '@/lib/plugins/types/sequencer';
import { getExplorerTxUrl } from '@/lib/utils/chains';

export function SequenceStepCard({ 
  step, 
  onSimulate, 
  onSign, 
  onEdit 
}: { 
  step: SequenceStep, 
  onSimulate: () => void, 
  onSign: () => void, 
  onEdit: () => void 
}) {
  return (
    <div className="border rounded-lg p-4 mb-4">
      <h3 className="font-semibold">{step.label} ({step.chain})</h3>
      <div className="mt-2 text-sm text-gray-600">
        Status: <span className="uppercase">{step.status}</span>
      </div>

      {step.status === 'simulating' && (
        <div className="mt-4 text-blue-600">Simulating...</div>
      )}

      {step.status === 'ready' && step.simulation?.success === true && (
        <div className="mt-4">
          <div className="text-green-600 mb-2">Simulation passed (Gas: ${step.simulation.gasCostUsd?.toFixed(2) || '0.00'})</div>
          <button 
            onClick={onSign} 
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Sign Transaction
          </button>
        </div>
      )}

      {step.status === 'ready' && step.simulation?.success === false && (
        <div className="mt-4">
          <div className="text-red-600 mb-2">{step.simulation?.revertReason || 'Transaction would revert'}</div>
          <button onClick={onEdit} className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300">
            Edit Parameters
          </button>
        </div>
      )}

      {step.status === 'signing' && (
        <div className="mt-4 text-blue-600">Waiting for wallet confirmation...</div>
      )}

      {step.status === 'confirmed' && (
        <div className="mt-4 text-green-600">
          Confirmed! {' '}
          {step.txHash && (
            <a href={getExplorerTxUrl(step.chain, step.txHash)} target="_blank" rel="noreferrer" className="underline">
              View on Explorer
            </a>
          )}
        </div>
      )}

      {step.status === 'failed' && (
        <div className="mt-4">
          <div className="text-red-600 mb-2">Failed: {step.simulation?.revertReason || 'Transaction failed'}</div>
          <button onClick={onSimulate} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
