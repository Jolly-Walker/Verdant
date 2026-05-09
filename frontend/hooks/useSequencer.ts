import { useState } from 'react'
import { SequencePlan, SequenceStep, SimulationResult } from '@/lib/plugins/types/sequencer'

export function useSequencer() {
  const [plan, setPlan] = useState<SequencePlan | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)

  const createPlan = async (description: string, steps: SequenceStep[]) => {
    const newPlan: SequencePlan = {
      id: Math.random().toString(36).substring(7),
      walletAddress: '', // To be filled by wallet
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
            s.id === stepId ? { ...s, simulation: result, status: result.success ? 'ready' : 'failed' } : s
          )
        }
      })
      
      return result
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
