'use client'

import { useCallback } from 'react'
import { BridgeQuote, BridgeStatus, ChainId, BridgeId, BridgeQuoteParams } from '@/types/shared'
import { SerializedUnsignedTx } from '@/types/sequencer'
import { fetchWithTimeout } from '@/lib/utils/fetch'

interface UseBridgesReturn {
  getQuotes: (params: BridgeQuoteParams) => Promise<BridgeQuote[]>
  buildTransaction: (bridgeId: BridgeId, quote: BridgeQuote) => Promise<SerializedUnsignedTx>
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

      const res = await fetchWithTimeout(`/api/bridges/quote?${searchParams.toString()}`, {
        timeout: 12000
      })
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

  const buildTransaction = useCallback(async (bridgeId: BridgeId, quote: BridgeQuote): Promise<SerializedUnsignedTx> => {
    const res = await fetchWithTimeout('/api/bridges/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bridgeId, quote }),
      timeout: 12000
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || 'Failed to build bridge transaction')
    }

    const data = await res.json()
    return data.unsignedTx
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

      const res = await fetchWithTimeout(`/api/bridges/status?${searchParams.toString()}`, {
        timeout: 12000
      })
      if (!res.ok) {
        return { status: 'pending' }
      }

      return await res.json()
    } catch (err) {
      console.error('[useBridges] pollStatus failed:', err)
      return { status: 'pending' }
    }
  }, [])

  return { getQuotes, buildTransaction, pollStatus }
}
