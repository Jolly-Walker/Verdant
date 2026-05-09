'use client'

import { useState, useCallback } from 'react'
import { BridgeQuote, BridgeStatus, ChainId, BridgeId } from '@/lib/plugins/types/shared'

interface UseBridgesReturn {
  getQuote: (params: {
    fromChain: ChainId
    toChain: ChainId
    token: string
    amount: string
    recipientAddress: string
  }) => Promise<BridgeQuote | null>
  pollStatus: (params: {
    txHash: string
    fromChain: ChainId
    bridgeId: BridgeId
  }) => Promise<BridgeStatus>
}

export function useBridges(): UseBridgesReturn {
  const getQuote = useCallback(async (params: {
    fromChain: ChainId
    toChain: ChainId
    token: string
    amount: string
    recipientAddress: string
  }): Promise<BridgeQuote | null> => {
    try {
      const searchParams = new URLSearchParams({
        fromChain: params.fromChain,
        toChain: params.toChain,
        token: params.token,
        amount: params.amount,
        recipientAddress: params.recipientAddress,
      })

      const res = await fetch(`/api/bridges/quote?${searchParams.toString()}`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch bridge quote')
      }

      const data = await res.json()
      return data.recommended
    } catch (err) {
      console.error('[useBridges] getQuote failed:', err)
      return null
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

  return { getQuote, pollStatus }
}
