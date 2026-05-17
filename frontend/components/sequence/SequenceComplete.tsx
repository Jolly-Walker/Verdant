import React from 'react';
import { SequencePlan } from '@/types/sequencer';
import { getExplorerTxUrl } from '@/lib/utils/chains';
import { Card } from '@/components/ui/Card';
import { formatUsd } from '@/lib/utils/formatting';
import { useRouter } from 'next/navigation';

export function SequenceComplete({ plan }: { plan: SequencePlan }) {
  const router = useRouter();
  const totalGasCost = plan.steps.reduce((acc, step) => acc + (step.simulation?.gasCostUsd || 0), 0);

  return (
    <div className="max-w-2xl mx-auto py-20 px-6 text-center">
      <div className="mb-8 flex justify-center">
        <div className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-500 rounded-full flex items-center justify-center text-emerald-500 animate-in zoom-in duration-500">
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>

      <h2 className="text-3xl font-bold text-zinc-100 mb-4">Sequence Complete</h2>
      <p className="text-zinc-400 mb-10 max-w-md mx-auto">
        Your transactions have been successfully executed and confirmed on-chain.
      </p>

      <Card className="mb-10 divide-y divide-zinc-800 bg-zinc-900/50">
        <div className="px-6 py-4 flex justify-between items-center text-sm">
          <span className="text-zinc-500">Total switching cost</span>
          <span className="text-zinc-100 font-semibold">{formatUsd(totalGasCost)}</span>
        </div>
        
        {plan.steps.map((step) => (
          <div key={step.id} className="px-6 py-4 flex justify-between items-center text-sm">
            <span className="text-zinc-400">{step.label}</span>
            {step.txHash && (
              <a 
                href={getExplorerTxUrl(step.chain, step.txHash)} 
                target="_blank" 
                rel="noreferrer" 
                className="text-emerald-400 hover:text-emerald-300 font-medium"
              >
                View Tx
              </a>
            )}
          </div>
        ))}
      </Card>

      <button 
        onClick={() => router.push('/dashboard')}
        className="bg-zinc-100 hover:bg-white text-zinc-950 font-bold px-8 py-3 rounded-xl transition-all shadow-lg"
      >
        Back to Dashboard
      </button>
    </div>
  );
}
