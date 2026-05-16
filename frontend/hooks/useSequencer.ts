import { useState } from 'react'
import { useAccount } from 'wagmi'
import { SequencePlan, SequenceStep, SimulationResult } from '@/lib/plugins/types/sequencer'

export function useSequencer() {
  const { address } = useAccount()
  const [plan, setPlan] = useState<SequencePlan | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)

  const createPlan = async (description: string, steps: SequenceStep[]) => {
    if (!address) throw new Error('Wallet not connected')

    const newPlan: SequencePlan = {
      id: crypto.randomUUID(),
      walletAddress: address,
      createdAt: new Date(),
      steps,
      status: 'draft',
      totalCostUsd: 0,
      description
    }
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

  return {
    plan,
    isSimulating,
    createPlan,
    simulateStep,
    setPlan
  }
}
