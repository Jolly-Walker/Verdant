'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { Position } from '@/types/position'
import { fetchPositions } from '@/lib/data/debank'

interface UsePositionsReturn {
  positions: Position[]
  isLoading: boolean
  error: string | null
  refetch: () => void
  totalValueUsd: number
  totalRewardsUsd: number
}

export function usePositions(): UsePositionsReturn {
  const { address, isConnected } = useAccount()
  const [positions, setPositions] = useState<Position[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!address || !isConnected) {
      setPositions([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const data = await fetchPositions(address)
      setPositions(data)
    } catch (err) {
      setError('Could not load positions. Using cached data.')
      console.error(err)
      // Keep previous positions as stale data
    } finally {
      setIsLoading(false)
    }
  }, [address, isConnected])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalValueUsd = positions.reduce((sum, p) => sum + p.amountUsd, 0)
  const totalRewardsUsd = positions.reduce(
    (sum, p) => sum + p.claimableRewards.reduce((rs, r) => rs + r.amountUsd, 0),
    0
  )

  return {
    positions,
    isLoading,
    error,
    refetch: fetchData,
    totalValueUsd,
    totalRewardsUsd,
  }
}
