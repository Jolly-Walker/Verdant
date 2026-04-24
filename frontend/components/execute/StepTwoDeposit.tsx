'use client';

import { useState } from 'react';
import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { getChainDisplayName, getExplorerTxUrl } from '@/lib/utils/chains';
import { Chain } from '@/types/chain';
import { getChainId } from '@/lib/utils/chains';

export interface StepTwoDepositProps {
  asset: string;
  amount: string;
  destChain: Chain;
  destProtocol: string;
  recipientAddress: string;
  onComplete: (txHash: string) => void;
  onCancel: () => void;
}

type DepositState = 'idle' | 'simulating' | 'signing' | 'mining' | 'completed' | 'error';

export function StepTwoDeposit({
  asset,
  amount,
  destChain,
  destProtocol,
  recipientAddress,
  onComplete,
  onCancel
}: StepTwoDepositProps) {
  const [state, setState] = useState<DepositState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [expectedOutput, setExpectedOutput] = useState<string | null>(null);
  
  const { sendTransactionAsync, data: txHash } = useSendTransaction();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const handleDeposit = async () => {
    try {
      setState('simulating');
      setError(null);

      // 1. Simulate the transaction prior to signing
      const simRes = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', // Mock target
          data: '0x',
          from: recipientAddress,
          value: '0',
          chainId: getChainId(destChain),
          protocol: destProtocol,
          asset,
          amount
        })
      });

      if (!simRes.ok) {
        throw new Error('Simulation failed. Transaction would revert.');
      }

      await simRes.json();
      setExpectedOutput(`You will receive ~${amount} a${asset}`);

      // 2. Request user signature and send transaction
      setState('signing');
      await sendTransactionAsync({
        to: '0x794a61358D6845594F94dc1DB02A252b5b4814aD' as `0x${string}`,
        value: BigInt(0),
        data: '0x'
      });

      setState('mining');
    } catch (err) {
      console.error(err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes('User rejected')) {
        setError('Transaction cancelled by user.');
      } else {
        setError(errorMsg || 'Deposit failed');
      }
      setState('error');
    }
  };

  // Automatically handle state transition when receipt is confirmed
  if (isSuccess && state === 'mining') {
    setState('completed');
    if (txHash) onComplete(txHash);
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <h3 className="text-lg font-medium text-white mb-4">Step 2: Deposit to {destProtocol}</h3>
      
      <div className="space-y-4">
        {state === 'idle' && (
          <div className="flex gap-3">
            <button 
              onClick={handleDeposit}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
            >
              Simulate & Deposit
            </button>
            <button 
              onClick={onCancel}
              className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {state === 'simulating' && (
          <div className="py-3 text-center text-emerald-400 animate-pulse bg-emerald-900/10 rounded-lg">
            Simulating transaction...
          </div>
        )}

        {state === 'signing' && (
          <div className="py-3 text-center text-emerald-400 animate-pulse bg-emerald-900/10 rounded-lg">
            {expectedOutput}<br/>
            <span className="text-sm">Please confirm the transaction in your wallet...</span>
          </div>
        )}

        {(state === 'mining' || isMining) && (
           <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <div className="flex items-center gap-3 text-emerald-400 mb-2 font-medium">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              Mining deposit on {getChainDisplayName(destChain)}...
            </div>
            {txHash && (
              <a 
                href={getExplorerTxUrl(destChain, txHash)} 
                target="_blank" 
                rel="noreferrer"
                className="text-sm text-emerald-500 hover:text-emerald-400 underline transition-colors"
              >
                View on Explorer
              </a>
            )}
          </div>
        )}

        {state === 'completed' && (
           <div className="p-4 bg-emerald-900/20 border border-emerald-800 rounded-lg text-emerald-400 flex items-center gap-3 font-medium">
             <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
               ✓
             </div>
             Deposit successful! Your yield is active.
           </div>
        )}

        {state === 'error' && error && (
          <div className="p-4 bg-red-900/20 border border-red-800/50 rounded-lg">
            <p className="text-red-400 text-sm mb-4">{error}</p>
            <div className="flex gap-3">
              <button 
                onClick={handleDeposit}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm transition-colors font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
