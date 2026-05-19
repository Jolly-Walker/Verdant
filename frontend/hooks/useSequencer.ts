import { useState, useMemo, useRef, useCallback } from 'react'
import { useSendTransaction } from 'wagmi'
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react'
import { VersionedTransaction, Connection } from '@solana/web3.js'
import { SequencePlan, SimulationResult, TemplateParams, SerializedSequencePlan, TemplateId } from '@/types/sequencer'
import { ChainId } from '@/types/shared'
import { getActiveStep, deserializeSequencePlan, deserializeSequenceStep } from '@/lib/sequencer/engine'
import { TEMPLATE_REGISTRY } from '@/lib/sequencer/templates'
import { fetchWithTimeout } from '@/lib/utils/fetch'
import { useWallet } from './useWallet'

export { TEMPLATE_REGISTRY }

const CHAIN_ID_MAP: Partial<Record<ChainId, number>> = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453
}

export function useSequencer() {
  const { address } = useWallet()
  const { sendTransactionAsync } = useSendTransaction()
  const { signTransaction: signSolanaTransaction } = useSolanaWallet()
  const [plan, setPlan] = useState<SequencePlan | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)
  
  // Use a ref to keep track of the latest plan without triggering re-renders of callbacks
  const planRef = useRef<SequencePlan | null>(null)
  planRef.current = plan

  // Synchronous lock to prevent double execution race conditions
  const executingSteps = useRef<Set<string>>(new Set())

  const currentStep = useMemo(() => plan ? getActiveStep(plan) : null, [plan]);

  const createPlan = useCallback(async (templateId: TemplateId, params: TemplateParams) => {
    if (!address) throw new Error('Wallet not connected')

    try {
      const res = await fetchWithTimeout('/api/sequencer/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, params, walletAddress: address })
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create plan');
      }

      const { plan: serializedPlan } = await res.json();
      const newPlan = deserializeSequencePlan(serializedPlan);
      setPlan(newPlan)
      return newPlan
    } catch (err) {
      console.error('Plan creation error:', err)
      throw err instanceof Error ? err : new Error('Network error — please check your connection and retry')
    }
  }, [address])

  const simulateStep = useCallback(async (stepId: string): Promise<SimulationResult> => {
    const currentPlan = planRef.current
    if (!currentPlan) throw new Error('No active plan')
    const step = currentPlan.steps.find(s => s.id === stepId)
    if (!step) throw new Error('Step not found')
    
    // Check dependencies
    const unmetDeps = step.dependsOn.filter(depId => {
      const depStep = currentPlan.steps.find(s => s.id === depId)
      return !depStep || depStep.status !== 'confirmed'
    })
    if (unmetDeps.length > 0) {
      throw new Error(`Cannot simulate step ${stepId}: unmet dependencies ${unmetDeps.join(', ')}`)
    }

    setIsSimulating(true)
    
    try {
      // Transition step to 'simulating' in UI immediately
      setPlan(prev => prev ? { 
        ...prev, 
        steps: prev.steps.map(s => s.id === stepId ? { ...s, status: 'simulating' } : s) 
      } : null)
      
      const res = await fetchWithTimeout('/api/sequencer/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: currentPlan.id,
          stepId: stepId,
          walletAddress: address
        })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Simulation failed');
      }
      
      const { updatedStep: serializedUpdatedStep } = await res.json()
      const updatedStep = deserializeSequenceStep(serializedUpdatedStep)

      setPlan(prev => {
        if (!prev) return null
        return {
          ...prev,
          steps: prev.steps.map(s => s.id === stepId ? updatedStep : s)
        }
      })
      
      return updatedStep.simulation!
    } catch (err) {
      console.error('Simulation error:', err)
      
      setPlan(prev => {
        if (!prev) return null
        return {
          ...prev,
          steps: prev.steps.map(s => 
            s.id === stepId ? { ...s, status: 'failed' } : s
          )
        }
      })
      throw err
    } finally {
      setIsSimulating(false)
    }
  }, [address])

  const executeStep = useCallback(async (stepId: string): Promise<string> => {
    const currentPlan = planRef.current
    if (!currentPlan) throw new Error('No active plan')
    const step = currentPlan.steps.find(s => s.id === stepId)
    if (!step) throw new Error('Step not found')

    // 1. Synchronous check to prevent double execution from rapid clicks
    if (executingSteps.current.has(stepId)) {
      console.warn(`Step ${stepId} is already executing, ignoring second call.`)
      return ''
    }
    
    // Check dependencies
    const unmetDeps = step.dependsOn.filter(depId => {
      const depStep = currentPlan.steps.find(s => s.id === depId)
      return !depStep || depStep.status !== 'confirmed'
    })
    if (unmetDeps.length > 0) {
      throw new Error(`Cannot execute step ${stepId}: unmet dependencies ${unmetDeps.join(', ')}`)
    }

    if (step.status !== 'ready') throw new Error('Step is not ready to execute')
    if (!step.unsignedTx) throw new Error('No transaction to execute')

    // Set lock
    executingSteps.current.add(stepId)

    try {
      // 2. Move local state to 'signing'
      setPlan(prev => prev ? { 
        ...prev, 
        steps: prev.steps.map(s => s.id === stepId ? { ...s, status: 'signing' } : s) 
      } : null)

      // 3. Update DB before prompting wallet
      const patchRes = await fetchWithTimeout(`/api/sequencer/plan/${currentPlan.id}/step/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'signing', acknowledged: true })
      })

      if (!patchRes.ok) {
        // Revert UI state on failure
        setPlan(prev => prev ? { 
          ...prev, 
          steps: prev.steps.map(s => s.id === stepId ? { ...s, status: 'ready' } : s) 
        } : null)
        throw new Error('State desynchronization: Failed to update status in database. Aborting to prevent tracking loss.')
      }

      let txHash: string;

      if (step.chain === 'solana') {
        if (!signSolanaTransaction) throw new Error('Solana wallet not connected or does not support signing');
        
        // Deserialize and sign Solana transaction
        const txBuffer = Buffer.from(step.unsignedTx.data, 'base64');
        const transaction = VersionedTransaction.deserialize(txBuffer);
        const signedTx = await signSolanaTransaction(transaction);
        
        // Broadcast signed transaction
        const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
        txHash = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(txHash);
      } else {
        const numericChainId = CHAIN_ID_MAP[step.chain as ChainId];
        
        txHash = await sendTransactionAsync({
          to: step.unsignedTx.to as `0x${string}`,
          data: step.unsignedTx.data as `0x${string}`,
          value: step.unsignedTx.value,
          chainId: numericChainId
        });
      }

      const confirmRes = await fetchWithTimeout(`/api/sequencer/plan/${currentPlan.id}/step/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed', txHash })
      })

      if (!confirmRes.ok) {
        // This is a dangerous state: tx is on-chain but DB is not updated.
        console.error('CRITICAL: Transaction broadcast but database update failed')
        setPlan(prev => prev ? { 
          ...prev, 
          steps: prev.steps.map(s => s.id === stepId ? { ...s, status: 'confirmed', txHash } : s) 
        } : null)
        throw new Error('Transaction successful on-chain, but Verdant database could not be updated. Please refresh to see latest state.')
      }

      setPlan(prev => prev ? { 
        ...prev, 
        steps: prev.steps.map(s => s.id === stepId ? { ...s, status: 'confirmed', txHash } : s) 
      } : null)

      return txHash
    } catch (err: unknown) {
      console.error('Execution error:', err)
      const isUserRejection = 
        (err instanceof Error && err.message.toLowerCase().includes('user rejected')) || 
        (typeof err === 'object' && err !== null && 'code' in err && (err as { code: number }).code === 4001)
      
      const errorMessage = isUserRejection ? 'Transaction cancelled by user' : 'Network error — please check your connection and retry'
      
      const statusToRevert = isUserRejection ? 'ready' : 'failed'
      
      await fetchWithTimeout(`/api/sequencer/plan/${currentPlan.id}/step/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusToRevert })
      }).catch(() => {})

      setPlan(prev => prev ? { 
        ...prev, 
        steps: prev.steps.map(s => s.id === stepId ? { ...s, status: statusToRevert } : s) 
      } : null)

      throw new Error(errorMessage)
    } finally {
      // Always release lock
      executingSteps.current.delete(stepId)
    }
  }, [address, sendTransactionAsync, signSolanaTransaction])

  const reset = useCallback(() => {
    setPlan(null)
  }, [])

  const stableSetPlan = useCallback((newPlan: SequencePlan | SerializedSequencePlan | null) => {
    if (!newPlan) {
      setPlan(null);
    } else if ('createdAt' in newPlan && typeof newPlan.createdAt === 'string') {
      setPlan(deserializeSequencePlan(newPlan as SerializedSequencePlan));
    } else {
      setPlan(newPlan as SequencePlan);
    }
  }, []);

  return {
    plan,
    currentStep,
    isSimulating,
    createPlan,
    simulateStep,
    executeStep,
    reset,
    setPlan: stableSetPlan
  }
}
