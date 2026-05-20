'use client'

import { useCallback } from 'react'
import { BridgeQuote, BridgeStatus, ChainId, BridgeId, BridgeQuoteParams } from '@/types/shared'

interface UseBridgesReturn {
  getQuotes: (params: BridgeQuoteParams) => Promise<BridgeQuote[]>
  pollStatus: (params: {
    txHash: string
    fromChain: ChainId
    bridgeId: BridgeId
  }) => Promise<BridgeStatus>
}

export function useBridges(): UseBridgesReturn {
  const getQuotes = useCallback(async (params: BridgeQuoteParams): Promise<BridgeQuote[]> => {
    try {
      const searchParams = new URLSearchParams({
        fromChain: params.fromChain,
        toChain: params.toChain,
        token: params.token,
        amount: params.amount,
        recipientAddress: params.recipientAddress,
        slippagePercent: params.slippagePercent.toString(),
      })

      const res = await fetch(`/api/bridges/quote?${searchParams.toString()}`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch bridge quotes')
      }

      const data = await res.json()
      return data.quotes || []
    } catch (err) {
      console.error('[useBridges] getQuotes failed:', err)
      return []
    }
  }, [])

  const pollStatus = useCallback(async (params: {
    txHash: string
    fromChain: ChainId
    bridgeId: BridgeId
  }): Promise<BridgeStatus> => {
    try {
      const searchParams = new URLSearchParams({
        txHash: params.txHash,
        fromChain: params.fromChain,
        bridgeId: params.bridgeId,
      })

      const res = await fetch(`/api/bridges/status?${searchParams.toString()}`)
      if (!res.ok) {
        return { status: 'pending' }
      }

      return await res.json()
    } catch (err) {
      console.error('[useBridges] pollStatus failed:', err)
      return { status: 'pending' }
    }
  }, [])

  return { getQuotes, pollStatus }
}
