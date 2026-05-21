'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@/hooks/useWallet'
import { Position } from '@/types/position'
import { DEFAULT_MIN_USD_THRESHOLD } from '@/constants/settings'


interface UsePositionsReturn {
  positions: Position[]
  isLoading: boolean
  error: string | null
  refetch: () => void
  totalValueUsd: number
  totalRewardsUsd: number
}

export function usePositions(): UsePositionsReturn {
  const { evmAddress, solanaAddress, isConnected, isMounted } = useWallet()
  const [positions, setPositions] = useState<Position[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!isMounted || (!evmAddress && !solanaAddress) || !isConnected) {
      setPositions([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const url = new URL('/api/positions', window.location.origin)
      if (evmAddress) url.searchParams.set('address', evmAddress)
      if (solanaAddress) url.searchParams.set('solana', solanaAddress)
      
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const data = await res.json()
      const allPositions = (data.positions || []) as Position[]
      
      // Filter out small balances based on threshold
      // This is currently hardcoded to a default constant but will eventually be a user setting
      const filteredPositions = allPositions.filter(p => p.amountUsd >= DEFAULT_MIN_USD_THRESHOLD)
      setPositions(filteredPositions)
    } catch (err) {
      setError('Could not load positions. Using cached data.')
      console.error(err)
      // Keep previous positions as stale data
    } finally {
      setIsLoading(false)
    }
  }, [evmAddress, solanaAddress, isConnected, isMounted])

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
