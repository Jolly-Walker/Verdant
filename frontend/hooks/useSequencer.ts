import { useState, useMemo } from 'react'
import { useAccount, useSendTransaction } from 'wagmi'
import { SequencePlan, SequenceStep, SimulationResult, TemplateParams } from '@/lib/plugins/types/sequencer'
import { getActiveStep } from '@/lib/sequencer/engine'

const CHAIN_ID_MAP: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453
}

export function useSequencer() {
  const { address } = useAccount()
  const { sendTransactionAsync } = useSendTransaction()
  const [plan, setPlan] = useState<SequencePlan | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)

  const currentStep = useMemo(() => plan ? getActiveStep(plan) : null, [plan]);

  const createPlan = async (templateId: string, params: TemplateParams) => {
    if (!address) throw new Error('Wallet not connected')

    const res = await fetch('/api/sequencer/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId, params, walletAddress: address })
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create plan');
    }

    const { plan: newPlan } = await res.json();
    setPlan(newPlan)
    return newPlan
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
    
    // Transition step to 'simulating' in UI and DB
    setPlan(prev => prev ? { 
      ...prev, 
      steps: prev.steps.map(s => s.id === stepId ? { ...s, status: 'simulating' } : s) 
    } : null)
    
    await fetch(`/api/sequencer/plan/${plan.id}/step/${stepId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'simulating' })
    })

    try {
      if (!step.unsignedTx) throw new Error('No transaction to simulate')

      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain: step.chain,
          to: step.unsignedTx.to,
          from: address,
          data: step.unsignedTx.data,
          value: step.unsignedTx.value.toString(),
        })
      })

      if (!res.ok) throw new Error('Simulation failed')
      
      const rawResult = await res.json()
      const result: SimulationResult = {
        ...rawResult,
        gasEstimate: rawResult.gasEstimate ? BigInt(rawResult.gasEstimate) : undefined,
        simulatedAt: new Date(rawResult.simulatedAt)
      }
      
      const newStatus = result.success ? 'ready' : 'failed'

      // Update Supabase
      await fetch(`/api/sequencer/plan/${plan.id}/step/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: newStatus,
          simulation: {
            success: result.success,
            revertReason: result.revertReason,
            gasEstimate: result.gasEstimate?.toString(),
            gasCostUsd: result.gasCostUsd
          }
        })
      })

      setPlan(prev => {
        if (!prev) return null
        return {
          ...prev,
          steps: prev.steps.map(s => 
            s.id === stepId 
              ? { ...s, simulation: result, status: newStatus } 
              : s
          )
        }
      })
      
      return result
    } catch (err) {
      await fetch(`/api/sequencer/plan/${plan.id}/step/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'failed' })
      })

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

    await fetch(`/api/sequencer/plan/${plan.id}/step/${stepId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'signing' })
    })
    
    setPlan(prev => prev ? { 
      ...prev, 
      steps: prev.steps.map(s => s.id === stepId ? { ...s, status: 'signing' } : s) 
    } : null)

    try {
      const numericChainId = CHAIN_ID_MAP[step.unsignedTx.chainId]
      
      const txHash = await sendTransactionAsync({
        to: step.unsignedTx.to as `0x${string}`,
        data: step.unsignedTx.data as `0x${string}`,
        value: step.unsignedTx.value,
        chainId: numericChainId
      })

      await fetch(`/api/sequencer/plan/${plan.id}/step/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed', txHash })
      })

      setPlan(prev => prev ? { 
        ...prev, 
        steps: prev.steps.map(s => s.id === stepId ? { ...s, status: 'confirmed', txHash } : s) 
      } : null)

      return txHash
    } catch (err: unknown) {
      const isUserRejection = 
        (err instanceof Error && err.message.toLowerCase().includes('user rejected')) || 
        (typeof err === 'object' && err !== null && 'code' in err && (err as { code: number }).code === 4001)
      
      const errorMessage = isUserRejection ? 'Transaction cancelled by user' : 'Network error — please check your connection and retry'
      
      await fetch(`/api/sequencer/plan/${plan.id}/step/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'failed' })
      })

      setPlan(prev => prev ? { 
        ...prev, 
        steps: prev.steps.map(s => s.id === stepId ? { ...s, status: 'failed' } : s) 
      } : null)

      throw new Error(errorMessage)
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
