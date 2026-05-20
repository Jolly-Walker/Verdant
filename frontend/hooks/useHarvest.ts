'use client'

import { useState, useCallback } from 'react'
import { UnsignedTx, ChainId } from '@/types/shared'
import { useWallet } from '@/hooks/useWallet'
import { useSendTransaction } from 'wagmi'
import { getSupabaseAdmin } from '@/lib/data/supabase'

const CHAIN_ID_MAP: Partial<Record<ChainId, number>> = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453,
}

interface HarvestState {
  isSimulating: boolean
  isSigning: boolean
  error: string | null
  lastTxHash: string | null
}

interface UseHarvestReturn extends HarvestState {
  /** Calls /api/rewards/claim to build UnsignedTx[], simulates, then signs. */
  harvest: (protocol: string, chain: ChainId) => Promise<void>
}

export function useHarvest(): UseHarvestReturn {
  const { evmAddress } = useWallet()
  const { sendTransactionAsync } = useSendTransaction()

  const [state, setState] = useState<HarvestState>({
    isSimulating: false,
    isSigning: false,
    error: null,
    lastTxHash: null,
  })

  const harvest = useCallback(
    async (protocol: string, chain: ChainId) => {
      if (!evmAddress) throw new Error('Wallet not connected')

      setState(s => ({ ...s, isSimulating: true, error: null, lastTxHash: null }))

      let txs: UnsignedTx[] = []
      try {
        // 1. Build claim transactions via the API route
        const buildRes = await fetch('/api/rewards/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ protocol, chain, address: evmAddress }),
        })

        if (!buildRes.ok) {
          const err = await buildRes.json().catch(() => ({}))
          throw new Error(err.error ?? 'Failed to build claim transactions')
        }

        const data = await buildRes.json()
        txs = data.txs ?? []

        if (txs.length === 0) {
          setState(s => ({ ...s, isSimulating: false }))
          return
        }

        // 2. Simulate each transaction (per-step simulation via /api/simulate)
        for (const tx of txs) {
          const simRes = await fetch('/api/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chain,
              to: tx.to,
              from: evmAddress,
              data: tx.data,
              value: tx.value.toString(),
            }),
          })

          if (simRes.ok) {
            const simData = await simRes.json()
            if (!simData.success) {
              throw new Error(`Simulation failed: ${simData.revertReason ?? 'unknown error'}`)
            }
          }
          // If simulate fails (network error), we continue to allow signing anyway
        }
      } finally {
        setState(s => ({ ...s, isSimulating: false }))
      }

      // 3. Sign and broadcast each transaction
      setState(s => ({ ...s, isSigning: true }))
      const numericChainId = CHAIN_ID_MAP[chain]

      try {
        let lastTxHash = ''
        for (const tx of txs) {
          const txHash = await sendTransactionAsync({
            to: tx.to as `0x${string}`,
            data: tx.data as `0x${string}`,
            value: BigInt(tx.value),
            chainId: numericChainId,
          })
          lastTxHash = txHash
        }

        setState(s => ({ ...s, isSigning: false, lastTxHash }))
      } catch (err: unknown) {
        const isUserRejection =
          (err instanceof Error && err.message.toLowerCase().includes('user rejected')) ||
          (typeof err === 'object' && err !== null && 'code' in err && (err as { code: number }).code === 4001)

        setState(s => ({
          ...s,
          isSigning: false,
          error: isUserRejection ? 'Transaction cancelled' : 'Signing failed. Please try again.',
        }))
        throw err
      }
    },
    [evmAddress, sendTransactionAsync]
  )

  return {
    harvest,
    isSimulating: state.isSimulating,
    isSigning: state.isSigning,
    error: state.error,
    lastTxHash: state.lastTxHash,
  }
}
