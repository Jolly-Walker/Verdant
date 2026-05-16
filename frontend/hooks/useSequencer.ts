import { useState, useMemo, useRef } from 'react'
import { useAccount, useSendTransaction } from 'wagmi'
import { SequencePlan, SequenceStep, SimulationResult, TemplateParams } from '@/lib/plugins/types/sequencer'
import { getActiveStep } from '@/lib/sequencer/engine'

const CHAIN_ID_MAP: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453
}

const DEFAULT_TIMEOUT = 30000;

async function fetchWithTimeout(url: string, options: RequestInit & { timeout?: number } = {}) {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

export function useSequencer() {
  const { address } = useAccount()
  const { sendTransactionAsync } = useSendTransaction()
  const [plan, setPlan] = useState<SequencePlan | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)
  
  // Synchronous lock to prevent double execution race conditions
  const executingSteps = useRef<Set<string>>(new Set())

  const currentStep = useMemo(() => plan ? getActiveStep(plan) : null, [plan]);

  const createPlan = async (templateId: string, params: TemplateParams) => {
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

      const { plan: newPlan } = await res.json();
      setPlan(newPlan)
      return newPlan
    } catch (err) {
      console.error('Plan creation error:', err)
      throw err instanceof Error ? err : new Error('Network error — please check your connection and retry')
    }
  }

  const simulateStep = async (stepId: string): Promise<SimulationResult> => {
    if (!plan) throw new Error('No active plan')
    const step = plan.steps.find(s => s.id === stepId)
    if (!step) throw new Error('Step not found')
    
    // Check dependencies
    const unmetDeps = step.dependsOn.filter(depId => {
      const depStep = plan.steps.find(s => s.id === depId)
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
          planId: plan.id,
          stepId: stepId,
        })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Simulation failed');
      }
      
      const { simulation: rawSimulation, updatedStep } = await res.json()
      
      const simulation: SimulationResult = {
        ...rawSimulation,
        gasEstimate: rawSimulation.gasEstimate ? BigInt(rawSimulation.gasEstimate) : undefined,
        simulatedAt: new Date(rawSimulation.simulatedAt)
      }

      setPlan(prev => {
        if (!prev) return null
        return {
          ...prev,
          steps: prev.steps.map(s => 
            s.id === stepId 
              ? { ...s, simulation, status: updatedStep.status } 
              : s
          )
        }
      })
      
      return simulation
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
  }

  const executeStep = async (stepId: string): Promise<string> => {
    if (!plan) throw new Error('No active plan')
    const step = plan.steps.find(s => s.id === stepId)
    if (!step) throw new Error('Step not found')

    // 1. Synchronous check to prevent double execution from rapid clicks
    if (executingSteps.current.has(stepId)) {
      console.warn(`Step ${stepId} is already executing, ignoring second call.`)
      return ''
    }
    
    // Check dependencies
    const unmetDeps = step.dependsOn.filter(depId => {
      const depStep = plan.steps.find(s => s.id === depId)
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
      const patchRes = await fetchWithTimeout(`/api/sequencer/plan/${plan.id}/step/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'signing' })
      })

      if (!patchRes.ok) {
        // Revert UI state on failure
        setPlan(prev => prev ? { 
          ...prev, 
          steps: prev.steps.map(s => s.id === stepId ? { ...s, status: 'ready' } : s) 
        } : null)
        throw new Error('State desynchronization: Failed to update status in database. Aborting to prevent tracking loss.')
      }

      const numericChainId = CHAIN_ID_MAP[step.unsignedTx.chainId]
      
      const txHash = await sendTransactionAsync({
        to: step.unsignedTx.to as `0x${string}`,
        data: step.unsignedTx.data as `0x${string}`,
        value: step.unsignedTx.value,
        chainId: numericChainId
      })

      const confirmRes = await fetchWithTimeout(`/api/sequencer/plan/${plan.id}/step/${stepId}`, {
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
      
      await fetchWithTimeout(`/api/sequencer/plan/${plan.id}/step/${stepId}`, {
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
  }

  const reset = () => {
    setPlan(null)
  }

  return {
    plan,
    currentStep,
    isSimulating,
    createPlan,
    simulateStep,
    executeStep,
    reset,
    setPlan
  }
}
