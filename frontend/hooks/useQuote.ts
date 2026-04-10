'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { CostPreviewInput, CostPreviewResult } from '@/types/quote'

interface UseQuoteReturn {
  quote: CostPreviewResult | null
  isLoading: boolean
  error: string | null
  isStale: boolean
  quoteAge: number // seconds since last fetch
  refetch: () => void
}

/**
 * Hook for fetching cost preview quotes with debouncing and staleness tracking.
 *
 * - Debounces input changes by 800ms (per spec)
 * - Tracks quote age and staleness (>30s = stale)
 * - Provides refetch for manual refresh
 */
export function useQuote(input: CostPreviewInput | null): UseQuoteReturn {
  const [quote, setQuote] = useState<CostPreviewResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quoteAge, setQuoteAge] = useState(0)

  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const fetchIdRef = useRef(0)
  const quoteFetchedAtRef = useRef<number | null>(null)

  const fetchQuote = useCallback(async (quoteInput: CostPreviewInput) => {
    const fetchId = ++fetchIdRef.current
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quoteInput),
      })

      // Ignore stale responses
      if (fetchId !== fetchIdRef.current) return

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        setError(
          (errData as { error?: string }).error || `Quote fetch failed: ${res.status}`
        )
        return
      }

      const data = await res.json()
      setQuote({
        ...data,
        quoteFetchedAt: new Date(data.quoteFetchedAt),
      })
      quoteFetchedAtRef.current = Date.now()
      setQuoteAge(0)
    } catch (err) {
      if (fetchId !== fetchIdRef.current) return
      console.error(err)
      setError('Could not get quote. Network may be congested.')
    } finally {
      if (fetchId === fetchIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  // Debounced fetch on input change
  useEffect(() => {
    if (!input) {
      setQuote(null)
      setError(null)
      return
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      fetchQuote(input)
    }, 800) // 800ms debounce per spec

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [input, fetchQuote])

  // Quote age timer
  useEffect(() => {
    if (!quoteFetchedAtRef.current) return

    const interval = setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - (quoteFetchedAtRef.current || Date.now())) / 1000
      )
      setQuoteAge(elapsed)
    }, 1000)

    return () => clearInterval(interval)
  }, [quote])

  const refetch = useCallback(() => {
    if (input) {
      fetchQuote(input)
    }
  }, [input, fetchQuote])

  const isStale = quoteAge > 30

  return {
    quote,
    isLoading,
    error,
    isStale,
    quoteAge,
    refetch,
  }
}
