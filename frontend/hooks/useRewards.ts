'use client'

import { useState, useCallback } from 'react'
import { useWallet } from '@/hooks/useWallet'
import { ChainId, Reward } from '@/types/shared'

export interface AggregatedReward extends Reward {
  protocol: string
  chain: ChainId
}

interface UseRewardsReturn {
  rewards: AggregatedReward[]
  totalRewardsUsd: number
  isLoading: boolean
  error: string | null
  refetch: () => void
  /** Rewards grouped by protocol */
  byProtocol: Record<string, AggregatedReward[]>
}

export function useRewards(): UseRewardsReturn {
  const { evmAddress, isConnected, isMounted } = useWallet()
  const [rewards, setRewards] = useState<AggregatedReward[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!isMounted || !evmAddress || !isConnected) {
      setRewards([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const url = new URL('/api/rewards', window.location.origin)
      url.searchParams.set('address', evmAddress)

      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`Rewards API error: ${res.status}`)
      const data = await res.json()
      setRewards(data.rewards ?? [])
    } catch (err) {
      setError('Could not load rewards. Please try again.')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [evmAddress, isConnected, isMounted])

  const totalRewardsUsd = rewards.reduce((sum, r) => sum + r.amountUsd, 0)

  const byProtocol = rewards.reduce<Record<string, AggregatedReward[]>>((acc, r) => {
    if (!acc[r.protocol]) acc[r.protocol] = []
    acc[r.protocol].push(r)
    return acc
  }, {})

  return {
    rewards,
    totalRewardsUsd,
    isLoading,
    error,
    refetch: fetchData,
    byProtocol,
  }
}
