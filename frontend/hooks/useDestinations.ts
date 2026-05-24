'use client'

import { useState, useEffect } from 'react'
import { DepositDestination } from '@/lib/sequenceBuilder/types'
import { ChainId } from '@/types/shared'

interface UseDestinationsResult {
  destinations: DepositDestination[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useDestinations(token: string, chain: ChainId): UseDestinationsResult {
  const [destinations, setDestinations] = useState<DepositDestination[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refetchIndex, setRefetchIndex] = useState(0)

  const refetch = () => setRefetchIndex(prev => prev + 1)

  useEffect(() => {
    if (!token || !chain) return

    let cancelled = false
    setIsLoading(true)
    setError(null)

    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

    if (isDemo) {
      // Fall back to static fixture destinations from the old DEPOSIT_DESTINATIONS
      import('@/lib/sequenceBuilder/destinations.mock').then(m => {
        if (!cancelled) {
          setDestinations(m.getDepositDestinations(token, chain))
          setIsLoading(false)
        }
      }).catch(err => {
        if (!cancelled) {
          setError(err.message)
          setIsLoading(false)
        }
      })
      return
    }

    const params = new URLSearchParams({ token, chain })
    fetch(`/api/destinations?${params.toString()}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        if (!cancelled) {
          setDestinations(data.destinations ?? [])
          setIsLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message)
          setIsLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [token, chain, refetchIndex])

  return { destinations, isLoading, error, refetch }
}
