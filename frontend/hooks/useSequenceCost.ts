'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { CostPreviewResult } from '@/types/quote'
import { SequencePlan } from '@/types/sequencer'
import { useDemoSequenceCost } from '@/hooks/useDemoSequenceCost'

// process.env.NEXT_PUBLIC_DEMO_MODE is a build-time constant — it never
// changes between renders, so branching on it is safe and the eslint
// rules-of-hooks suppression below is intentional and documented.
const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

const STALE_WARN_MS = 30_000  // 30s → orange warning
const STALE_EXPIRE_MS = 60_000 // 60s → disable execution

interface UseSequenceCostOptions {
  plan: SequencePlan | null
  walletAddress?: string
  currentApy?: number
  targetApy?: number
  borrowApy?: number
  supplyApy?: number
}

interface UseSequenceCostReturn {
  result: CostPreviewResult | null
  isLoading: boolean
  error: string | null
  /** Step IDs whose bridge quotes are stale (>30s old) */
  staleStepIds: Set<string>
  /** Step IDs whose bridge quotes are expired (>60s old) — blocks execution */
  expiredStepIds: Set<string>
  /** Any bridge quote is expired — caller should disable "Begin Sequence" */
  hasExpiredQuotes: boolean
  refetch: () => void
}

/**
 * Hook for fetching multi-step sequence cost preview with staleness tracking.
 *
 * - Fetches cost via /api/sequencer/cost when plan changes
 * - Tracks per-step bridge quote staleness against StepCost.quoteExpiresAt
 * - staleStepIds: steps with quotes older than 30s
 * - expiredStepIds: steps with quotes older than 60s (execution blocked)
 */
export function useSequenceCost(options: UseSequenceCostOptions): UseSequenceCostReturn {
  if (IS_DEMO) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useDemoSequenceCost(options)
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useRealSequenceCost(options)
}

function useRealSequenceCost({
  plan,
  walletAddress,
  currentApy,
  targetApy,
  borrowApy,
  supplyApy,
}: UseSequenceCostOptions): UseSequenceCostReturn {
  const [result, setResult] = useState<CostPreviewResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [staleStepIds, setStaleStepIds] = useState<Set<string>>(new Set())
  const [expiredStepIds, setExpiredStepIds] = useState<Set<string>>(new Set())

  const fetchIdRef = useRef(0)
  const resultRef = useRef<CostPreviewResult | null>(null)

  const fetchCost = useCallback(async () => {
    if (!plan || !walletAddress) return

    const fetchId = ++fetchIdRef.current
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/sequencer/cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          walletAddress,
          currentApy,
          targetApy,
          borrowApy,
          supplyApy,
        }),
      })

      if (fetchId !== fetchIdRef.current) return

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        setError((errData as { error?: string }).error || `Cost fetch failed: ${res.status}`)
        return
      }

      const data = await res.json()
      const parsed: CostPreviewResult = {
        ...data,
        quoteFetchedAt: new Date(data.quoteFetchedAt),
      }
      setResult(parsed)
      resultRef.current = parsed
      // Reset staleness on new fetch
      setStaleStepIds(new Set())
      setExpiredStepIds(new Set())
    } catch (err) {
      if (fetchId !== fetchIdRef.current) return
      console.error('useSequenceCost fetch error:', err)
      setError('Could not load cost preview. Please retry.')
    } finally {
      if (fetchId === fetchIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [plan, walletAddress, currentApy, targetApy, borrowApy, supplyApy])

  // Fetch on plan change
  useEffect(() => {
    fetchCost()
  }, [fetchCost])

  // Staleness ticker — check every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const current = resultRef.current
      if (!current || !plan) return

      const now = Date.now()
      const newStale = new Set<string>()
      const newExpired = new Set<string>()

      plan.steps.forEach((step, idx) => {
        const stepCost = current.steps[idx]
        if (!stepCost?.quoteExpiresAt) return

        const expiresAt = new Date(stepCost.quoteExpiresAt).getTime()
        const fetchedAt = current.quoteFetchedAt.getTime()
        const age = now - fetchedAt

        if (age > STALE_EXPIRE_MS) {
          newExpired.add(step.id)
          newStale.add(step.id)
        } else if (age > STALE_WARN_MS) {
          newStale.add(step.id)
        }

        // Also respect the bridge's own expiresAt
        if (now >= expiresAt) {
          newExpired.add(step.id)
          newStale.add(step.id)
        }
      })

      setStaleStepIds(newStale)
      setExpiredStepIds(newExpired)
    }, 5000)

    return () => clearInterval(interval)
  }, [plan])

  const refetch = useCallback(() => {
    fetchCost()
  }, [fetchCost])

  return {
    result,
    isLoading,
    error,
    staleStepIds,
    expiredStepIds,
    hasExpiredQuotes: expiredStepIds.size > 0,
    refetch,
  }
}
