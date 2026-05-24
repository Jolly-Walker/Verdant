'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { SequencePlan, SimulationResult, TemplateParams, SerializedSequencePlan, TemplateId } from '@/types/sequencer'
import { getActiveStep, deserializeSequencePlan } from '@/lib/sequencer/engine'
import { fetchWithTimeout } from '@/lib/utils/fetch'
import {
  DEMO_WALLET_ADDRESS,
  buildDemoPlan,
  DEMO_SIMULATION_RESULT,
} from '@/lib/demo/sequencer'

/**
 * Demo version of useSequencer.
 * Identical return signature but backed entirely by local state and artificial
 * delays — no API calls, no wallet, no blockchain.
 */
export function useDemoSequencer() {
  const [plan, setPlan] = useState<SequencePlan | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)

  const planRef = useRef<SequencePlan | null>(null)
  planRef.current = plan

  const currentStep = useMemo(() => plan ? getActiveStep(plan) : null, [plan])

  const createPlan = useCallback(async (templateId: TemplateId, params: TemplateParams) => {
    if (templateId === 'custom') {
      await delay(600)
      const customPlan = (params as { customPlan: SequencePlan }).customPlan
      const newPlan: SequencePlan = {
        ...customPlan,
        id: crypto.randomUUID(),
        walletAddress: DEMO_WALLET_ADDRESS,
        createdAt: new Date(),
        status: 'draft',
      }
      setPlan(newPlan)
      return newPlan
    }

    // Ignore the actual params — always build the demo plan
    await delay(600)
    const newPlan = buildDemoPlan(DEMO_WALLET_ADDRESS)
    setPlan(newPlan)
    return newPlan
  }, [])

  const simulateStep = useCallback(async (stepId: string): Promise<SimulationResult> => {
    const currentPlan = planRef.current
    if (!currentPlan) throw new Error('No active plan')

    setIsSimulating(true)
    setPlan(prev => prev ? {
      ...prev,
      steps: prev.steps.map(s => s.id === stepId ? { ...s, status: 'simulating' } : s)
    } : null)

    await delay(1400)  // feel like a real simulation

    const simulationResult: SimulationResult = {
      ...DEMO_SIMULATION_RESULT,
      simulatedAt: new Date(),
    }

    setPlan(prev => prev ? {
      ...prev,
      steps: prev.steps.map(s =>
        s.id === stepId
          ? { ...s, status: 'ready' as const, simulation: simulationResult }
          : s
      )
    } : null)

    setIsSimulating(false)
    return simulationResult
  }, [])

  const executeStep = useCallback(async (stepId: string): Promise<string> => {
    const currentPlan = planRef.current
    if (!currentPlan) throw new Error('No active plan')

    const step = currentPlan.steps.find(s => s.id === stepId)
    if (!step || step.status !== 'ready') throw new Error('Step not ready')

    // Signing state
    setPlan(prev => prev ? {
      ...prev,
      steps: prev.steps.map(s => s.id === stepId ? { ...s, status: 'signing' } : s)
    } : null)

    await delay(800)  // fake wallet confirmation delay

    const fakeTxHash = `0xdemo${stepId.replace(/-/g, '')}${Date.now().toString(16)}`

    setPlan(prev => prev ? {
      ...prev,
      steps: prev.steps.map(s =>
        s.id === stepId ? { ...s, status: 'confirmed', txHash: fakeTxHash } : s
      )
    } : null)

    return fakeTxHash
  }, [])

  const signStep = useCallback(async (stepId: string, txHash: string): Promise<void> => {
    setPlan(prev => prev ? {
      ...prev,
      steps: prev.steps.map(s => s.id === stepId ? { ...s, status: 'confirmed', txHash } : s)
    } : null)
  }, [])

  const reset = useCallback(() => setPlan(null), [])

  const stableSetPlan = useCallback((newPlan: SequencePlan | SerializedSequencePlan | null) => {
    if (!newPlan) {
      setPlan(null)
    } else if ('createdAt' in newPlan && typeof newPlan.createdAt === 'string') {
      setPlan(deserializeSequencePlan(newPlan as SerializedSequencePlan))
    } else {
      setPlan(newPlan as SequencePlan)
    }
  }, [])

  return { plan, currentStep, isSimulating, createPlan, simulateStep, executeStep, signStep, reset, setPlan: stableSetPlan }
}

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}
