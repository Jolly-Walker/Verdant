'use client';

import { useState, useEffect } from 'react';
import { useSignTypedData } from 'wagmi';
import { getChainDisplayName, getExplorerTxUrl } from '@/lib/utils/chains';
import { useBridges } from '@/hooks/useBridges';
import { Chain } from '@/types/chain';
import { ChainId } from '@/lib/plugins/types/shared';

export interface StepOneBridgeProps {
  asset: string;
  amount: string;
  amountUsd: number;
  sourceChain: Chain;
  destChain: Chain;
  recipientAddress: string;
  onComplete: (fillTxHash?: string) => void;
  onCancel: () => void;
}

type BridgeState = 'idle' | 'signing' | 'creating_intent' | 'bridging' | 'completed' | 'error';

export function StepOneBridge({
  asset,
  amount,
  // amountUsd,
  sourceChain,
  destChain,
  recipientAddress,
  onComplete,
  onCancel
}: StepOneBridgeProps) {
  const [state, setState] = useState<BridgeState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [originTxHash, setOriginTxHash] = useState<string | null>(null);
  const { signTypedDataAsync } = useSignTypedData();
  const { getQuote, pollStatus } = useBridges();
  
  // Prevent navigation during critical states
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state === 'signing' || state === 'creating_intent' || state === 'bridging') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state]);

  const handleStart = async () => {
    try {
      setState('signing');
      setError(null);

      // 1. Mock signature for intent submission
      await signTypedDataAsync({
        domain: { name: 'Verdant Intents', version: '1' },
        types: { Intent: [{ name: 'action', type: 'string' }] },
        primaryType: 'Intent',
        message: { action: `Bridge ${amount} ${asset} to ${destChain}` }
      });

      setState('creating_intent');

      // 2. Use useBridges hook to get a quote
      const quote = await getQuote({
        fromChain: sourceChain as unknown as ChainId,
        toChain: destChain as unknown as ChainId,
        token: asset,
        amount,
        recipientAddress
      });

      if (!quote) throw new Error('Could not get bridge quote');

      // In a real flow, we'd build and send the tx here. 
      // For StepOneBridge (MVP), we use the intent ID from rawQuote
      const intentId = (quote.rawQuote as { intentId: string }).intentId;
      setOriginTxHash(intentId);
      setState('bridging');

      // 3. Poll for status using the useBridges hook
      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        if (attempts > 40) { // 10 mins timeout
          clearInterval(pollInterval);
          setError('Bridge is taking longer than expected. Please check Across Protocol status.');
          setState('error');
          return;
        }

        const status = await pollStatus({
          txHash: intentId,
          fromChain: sourceChain as unknown as ChainId,
          bridgeId: quote.bridgeId
        });

        if (status.status === 'complete') {
          clearInterval(pollInterval);
          setState('completed');
          onComplete(status.destinationTxHash);
        } else if (status.status === 'failed') {
          clearInterval(pollInterval);
          setError(status.errorMessage || 'Bridge transaction failed at the protocol level.');
          setState('error');
        }
      }, 15000);

    } catch (err) {
      console.error(err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes('User rejected')) {
        setError('Transaction cancelled by user.');
      } else {
        setError(errorMsg || 'An unknown error occurred during bridging.');
      }
      setState('error');
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <h3 className="text-lg font-medium text-white mb-4">Step 1: Bridge Assets</h3>
      
      <div className="space-y-4">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Action</span>
          <span className="text-white">Bridge {asset} from {getChainDisplayName(sourceChain)} to {getChainDisplayName(destChain)}</span>
        </div>
        
        {state === 'idle' && (
          <div className="flex gap-3 mt-4">
            <button 
              onClick={handleStart}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
            >
              Sign & Bridge
            </button>
            <button 
              onClick={onCancel}
              className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {state === 'signing' && (
          <div className="py-3 text-center text-emerald-400 animate-pulse bg-emerald-900/10 rounded-lg">
            Please sign the message in your wallet...
          </div>
        )}

        {state === 'creating_intent' && (
          <div className="py-3 text-center text-emerald-400 animate-pulse bg-emerald-900/10 rounded-lg">
            Submitting intent to solver network...
          </div>
        )}

        {state === 'bridging' && (
          <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <div className="flex items-center gap-3 text-emerald-400 mb-2 font-medium">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              Bridging {asset} to {getChainDisplayName(destChain)}...
            </div>
            <p className="text-sm text-zinc-400 mb-3">Estimated time remaining: ~2-5 minutes</p>
            {originTxHash && (
              <a 
                href={getExplorerTxUrl(sourceChain, originTxHash)} 
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
            Bridge completed successfully!
          </div>
        )}

        {state === 'error' && error && (
          <div className="p-4 bg-red-900/20 border border-red-800/50 rounded-lg">
            <p className="text-red-400 text-sm mb-4">{error}</p>
            <div className="flex gap-3">
              <button 
                onClick={handleStart}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm transition-colors font-medium"
              >
                Retry
              </button>
              <button 
                onClick={onCancel}
                className="px-4 py-2 bg-transparent text-zinc-400 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
