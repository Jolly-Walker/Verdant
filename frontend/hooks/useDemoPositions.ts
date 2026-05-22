'use client'

import { useState, useEffect } from 'react'
import { DEMO_POSITIONS, DEMO_TOTAL_VALUE_USD, DEMO_TOTAL_REWARDS_USD } from '@/lib/demo/positions'

/**
 * Demo version of usePositions.
 * Returns fixture positions after a simulated 900ms fetch delay so loading
 * skeletons are visible before the data appears.
 */
export function useDemoPositions() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate a fetch delay so loading skeletons are visible
    const t = setTimeout(() => setIsLoading(false), 900)
    return () => clearTimeout(t)
  }, [])

  return {
    positions: isLoading ? [] : DEMO_POSITIONS,
    isLoading,
    error: null,
    refetch: () => {},
    totalValueUsd: DEMO_TOTAL_VALUE_USD,
    totalRewardsUsd: DEMO_TOTAL_REWARDS_USD,
  }
}
