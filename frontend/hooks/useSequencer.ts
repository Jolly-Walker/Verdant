import { useState, useMemo } from 'react'
import { useAccount, useSendTransaction } from 'wagmi'
import { SequencePlan, SequenceStep, SimulationResult } from '@/lib/plugins/types/sequencer'
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

  const createPlan = async (templateId: string, params: any) => {
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
    setIsSimulating(true)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId }),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)

      if (!res.ok) throw new Error('Simulation failed')
      
      const result: SimulationResult = await res.json()
      
      setPlan(prev => {
        if (!prev) return null
        return {
          ...prev,
          steps: prev.steps.map(s => 
            s.id === stepId 
              ? { ...s, simulation: result, status: result.success ? 'ready' : 'failed' } 
              : s
          )
        }
      })
      
      return result
    } catch (err) {
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
    } catch (err: any) {
      const isUserRejection = err?.message?.toLowerCase().includes('user rejected') || err?.code === 4001
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
