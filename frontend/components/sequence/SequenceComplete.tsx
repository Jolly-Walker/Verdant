import React from 'react';
import { SequencePlan } from '@/lib/plugins/types/sequencer';
import { getExplorerTxUrl } from '@/lib/utils/chains';
import Link from 'next/link';

export function SequenceComplete({ plan }: { plan: SequencePlan }) {
  const totalCost = plan.steps.reduce((acc, step) => acc + (step.simulation?.gasCostUsd || 0), 0);

  return (
    <div className="max-w-2xl mx-auto py-12 text-center">
      <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">✓</div>
      <h1 className="text-3xl font-bold mb-4">Sequence Complete</h1>
      <p className="text-gray-600 mb-8">All steps have been successfully executed.</p>

      <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
        <h2 className="font-semibold mb-4 text-lg">Transaction Summary</h2>
        <ul className="space-y-4">
          {plan.steps.map(step => (
            <li key={step.id} className="flex justify-between items-center border-b pb-2">
              <span>{step.label}</span>
              {step.txHash && (
                <a 
                  href={getExplorerTxUrl(step.chain, step.txHash)} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  View Tx ↗
                </a>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-6 pt-4 border-t font-semibold flex justify-between">
          <span>Total Gas Paid</span>
          <span>${totalCost.toFixed(2)}</span>
        </div>
      </div>

      <Link href="/dashboard" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
        Back to Dashboard
      </Link>
    </div>
  );
}
