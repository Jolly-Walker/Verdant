'use client'

import { useState, useEffect } from 'react'
import { SequencePlan } from '@/types/sequencer'
import { DEMO_COST_RESULT } from '@/lib/demo/sequencer'

interface UseDemoSequenceCostInput {
  plan: SequencePlan | null
  walletAddress?: string
  currentApy?: number
  targetApy?: number
  borrowApy?: number
  supplyApy?: number
}

/**
 * Demo version of useSequenceCost.
 * Returns the fixture cost breakdown after a 700ms simulated load.
 * No API calls, no bridge quotes fetched.
 */
export function useDemoSequenceCost(_input: UseDemoSequenceCostInput) {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 700)
    return () => clearTimeout(t)
  }, [])

  return {
    result: isLoading ? null : DEMO_COST_RESULT,
    isLoading,
    error: null,
    staleStepIds: new Set<string>(),
    expiredStepIds: new Set<string>(),
    hasExpiredQuotes: false,
    refetch: () => {},
  }
}
