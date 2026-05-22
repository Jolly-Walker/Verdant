'use client';

import { useState, useEffect } from 'react';
import { useSendTransaction, useAccount } from 'wagmi';
import { getChainDisplayName, getExplorerTxUrl } from '@/lib/utils/chains';
import { useBridges } from '@/hooks/useBridges';
import { BridgeQuote, ChainId } from '@/types/shared';
import { Spinner } from '@/components/ui/Spinner';
import { BridgeQuoteSelector } from './BridgeQuoteSelector';
import { SerializedUnsignedTx } from '@/types/sequencer';

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
  const [serializedTx, setSerializedTx] = useState<SerializedUnsignedTx | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // NOTE: This uses sendTransactionAsync directly outside of useSequencer.ts.
  // This is a known exception for the pre-M5 legacy single-step bridge-only flow
  // that exists alongside the sequencer.
  // TODO: Consolidate by routing all bridge-only flows through the sequencer as a single-step plan.
  const { sendTransactionAsync, isPending } = useSendTransaction();

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
    async function simulateSelectedQuote() {
      if (!selectedQuote || !address) {
        setSerializedTx(null);
        return;
      }
      setIsSimulating(true);
      setError(null);
      try {
        const tx = await buildTransaction(selectedQuote.bridgeId, selectedQuote, address);
        setSerializedTx(tx);
      } catch (err: unknown) {
        console.error('[StepOneBridge] Simulation failed:', err);
        setError(err instanceof Error ? err.message : 'Bridge simulation failed');
        setSerializedTx(null);
      } finally {
        setIsSimulating(false);
      }
    }
    simulateSelectedQuote();
  }, [selectedQuote, address, buildTransaction]);

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
    if (!selectedQuote || !serializedTx) return;
    
    setIsBuildingTx(true);
    setError(null);
    try {
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
        <p className="text-verdant-text-muted mt-4 text-sm">Finding best bridge routes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-verdant-loss text-sm font-mono">{error}</p>
      </div>
    );
  }

  const isSigning = isBuildingTx || isPending || isSimulating;

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
            disabled={isSigning || !selectedQuote || !serializedTx}
            className="w-full bg-verdant-moss hover:bg-verdant-moss-dark disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {isSimulating ? 'Simulating route...' : isSigning ? 'Waiting for Wallet...' : `Approve & Bridge ${amount} ${token}`}
          </button>
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-center py-6 px-4 bg-verdant-surface-accent rounded-lg border border-[#D5E8E0]">
            {bridgeStatus === 'pending' ? (
              <div className="text-center">
                <Spinner size="md" className="mx-auto mb-3" />
                <p className="text-sm text-verdant-text-primary">
                  Bridging funds to {getChainDisplayName(toChain)} via {selectedQuote?.bridgeId}...
                </p>
                {trackingUrl && (
                  <a 
                    href={trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs text-verdant-moss hover:text-verdant-moss-dark underline"
                  >
                    View status ↗
                  </a>
                )}
                <p className="text-xs text-verdant-text-muted mt-2">
                  This usually takes a few minutes.
                </p>
              </div>
            ) : (
              <span className="text-sm text-verdant-profit font-semibold">Funds successfully bridged!</span>
            )}
          </div>
          
          <div className="flex gap-2">
            <a 
              href={getExplorerTxUrl(fromChain, txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center py-2 bg-verdant-moss hover:bg-verdant-moss-dark text-white text-sm rounded-md transition-colors font-medium"
            >
              View Transaction
            </a>
            <button 
              onClick={() => setTxHash(null)}
              className="px-4 py-2 bg-transparent text-verdant-text-muted hover:text-verdant-text-primary text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
