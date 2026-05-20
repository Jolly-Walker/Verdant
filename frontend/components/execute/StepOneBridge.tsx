'use client';

import { useState, useEffect } from 'react';
import { useSendTransaction, useAccount } from 'wagmi';
import { getChainDisplayName, getExplorerTxUrl } from '@/lib/utils/chains';
import { useBridges } from '@/hooks/useBridges';
import { BridgeQuote, ChainId } from '@/types/shared';
import { Spinner } from '@/components/ui/Spinner';
import { BridgeQuoteSelector } from './BridgeQuoteSelector';

interface StepOneBridgeProps {
  fromChain: ChainId;
  toChain: ChainId;
  token: string;
  amount: string;
  amountUsd: number;
  onComplete: (txHash: string) => void;
}

export function StepOneBridge({
  fromChain,
  toChain,
  token,
  amount,
  amountUsd,
  onComplete,
}: StepOneBridgeProps) {
  const { address } = useAccount();
  const { getQuotes, pollStatus, buildTransaction } = useBridges();
  const [quotes, setQuotes] = useState<BridgeQuote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<BridgeQuote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<'pending' | 'complete' | 'failed'>('pending');
  const [trackingUrl, setTrackingUrl] = useState<string | null>(null);
  const [isBuildingTx, setIsBuildingTx] = useState(false);

  const { sendTransactionAsync, isLoading: isPending } = useSendTransaction();

  useEffect(() => {
    async function fetchQuotes() {
      if (!address) return;
      setIsLoading(true);
      setError(null);
      try {
        const results = await getQuotes({
          fromChain,
          toChain,
          token,
          amount,
          recipientAddress: address,
          slippagePercent: 0.5,
        });
        setQuotes(results);
        if (results.length > 0) {
          setSelectedQuote(results[0]);
        } else {
          setError('No bridge quotes available for this route');
        }
      } catch {
        setError('Failed to fetch bridge quotes');
      } finally {
        setIsLoading(false);
      }
    }

    fetchQuotes();
  }, [fromChain, toChain, token, amount, getQuotes, address]);

  useEffect(() => {
    if (!txHash || !selectedQuote || bridgeStatus === 'complete') return;

    const interval = setInterval(async () => {
      const status = await pollStatus({
        txHash,
        fromChain,
        bridgeId: selectedQuote.bridgeId,
      });

      if (status.trackingUrl) {
        setTrackingUrl(status.trackingUrl);
      }
      
      if (status.status === 'complete') {
        setBridgeStatus('complete');
        onComplete(txHash);
        clearInterval(interval);
      } else if (status.status === 'failed') {
        setBridgeStatus('failed');
        setError(status.errorMessage || 'Bridge transaction failed');
        clearInterval(interval);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [txHash, fromChain, pollStatus, onComplete, bridgeStatus, selectedQuote]);

  const handleBridge = async () => {
    if (!selectedQuote) return;
    
    setIsBuildingTx(true);
    setError(null);
    try {
      const serializedTx = await buildTransaction(selectedQuote.bridgeId, selectedQuote);
      
      const hash = await sendTransactionAsync({
        to: serializedTx.to as `0x${string}`,
        data: serializedTx.data as `0x${string}`,
        value: BigInt(serializedTx.value),
        chainId: Number(serializedTx.chainId),
      });

      setTxHash(hash);
    } catch (err: unknown) {
      console.error('[StepOneBridge] Bridge failed:', err);
      setError(err instanceof Error ? err.message : 'Bridge transaction failed');
    } finally {
      setIsBuildingTx(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Spinner size="lg" />
        <p className="text-zinc-400 mt-4 text-sm">Finding best bridge routes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  const isSigning = isBuildingTx || isPending;

  return (
    <div className="space-y-6 mt-4">
      {!txHash ? (
        <>
          <BridgeQuoteSelector
            quotes={quotes}
            selectedId={selectedQuote?.bridgeId || null}
            onSelect={setSelectedQuote}
            amountUsd={amountUsd}
          />

          <button
            onClick={handleBridge}
            disabled={isSigning || !selectedQuote}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-emerald-900/20"
          >
            {isSigning ? 'Waiting for Wallet...' : `Approve & Bridge ${amount} ${token}`}
          </button>
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-center py-6 px-4 bg-zinc-800 rounded-lg border border-zinc-700">
            {bridgeStatus === 'pending' ? (
              <div className="text-center">
                <Spinner size="md" className="mx-auto mb-3" />
                <p className="text-sm text-zinc-300">
                  Bridging funds to {getChainDisplayName(toChain)} via {selectedQuote?.bridgeId}...
                </p>
                {trackingUrl && (
                  <a 
                    href={trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs text-emerald-400 hover:text-emerald-300 underline"
                  >
                    View status ↗
                  </a>
                )}
                <p className="text-xs text-zinc-500 mt-2">
                  This usually takes a few minutes.
                </p>
              </div>
            ) : (
              <span className="text-sm text-emerald-400 font-medium">Funds successfully bridged!</span>
            )}
          </div>
          
          <div className="flex gap-2">
            <a 
              href={getExplorerTxUrl(fromChain, txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg transition-colors"
            >
              View Transaction
            </a>
            <button 
              onClick={() => setTxHash(null)}
              className="px-4 py-2 bg-transparent text-zinc-400 hover:text-white text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
