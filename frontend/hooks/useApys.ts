'use client'

import { useState, useEffect } from 'react'
import { ChainId, ProtocolId } from '@/types/shared'

interface UseApysReturn {
  apy: number | null
  tvlUsd: number | null
  isLoading: boolean
  error: string | null
}

export function useApys(
  protocol: ProtocolId | null,
  chain: ChainId | null,
  asset: string | null
): UseApysReturn {
  const [apy, setApy] = useState<number | null>(null)
  const [tvlUsd, setTvlUsd] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!protocol || !chain || !asset) {
      setApy(null)
      setTvlUsd(null)
      return
    }

    let cancelled = false

    async function fetchApy() {
      setIsLoading(true)
      setError(null)

      try {
        const res = await fetch(
          `/api/apys?protocol=${encodeURIComponent(protocol!)}&chain=${encodeURIComponent(chain!)}&asset=${encodeURIComponent(asset!)}`
        )

        if (cancelled) return

        if (!res.ok) {
          setApy(null)
          setTvlUsd(null)
          if (res.status !== 404) {
            setError('Failed to fetch APY')
          }
          return
        }

        const data = await res.json()
        setApy(data.apy)
        setTvlUsd(data.tvlUsd)
      } catch (err) {
        if (!cancelled) {
          console.error(err)
          setError('Failed to fetch APY')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchApy()

    return () => {
      cancelled = true
    }
  }, [protocol, chain, asset])

  return { apy, tvlUsd, isLoading, error }
}
