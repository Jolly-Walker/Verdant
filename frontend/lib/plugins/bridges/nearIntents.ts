import 'server-only'
import { BridgePlugin, BridgeStatusContext } from '../types/bridge-plugin'
import { BridgeQuoteParams, BridgeQuote, UnsignedTx, BridgeStatus, ChainId } from '@/types/shared'
import { SUPPORTED_TOKENS } from '@/constants/tokens'
import { BRIDGE_QUOTE_TTL_MS } from '@/constants/bridges'
import { encodeFunctionData, formatUnits, Hex } from 'viem'
import { fetchWithTimeout } from '@/lib/utils/fetch'
import { fetchTokenPrices } from '@/lib/data/prices'

const DEFUSE_RPC_URL = 'https://bridge.chaindefuser.com/rpc'
// 1Click is the documented REST surface for NEAR Intents swap status.
const ONECLICK_API = 'https://1click.chaindefuser.com'

const CHAIN_MAP: Partial<Record<ChainId, string>> = {
  ethereum: 'eth:1',
  arbitrum: 'eth:42161',
  base: 'eth:8453',
}

const EVM_CHAIN_ID_MAP: Partial<Record<ChainId, number>> = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453,
}

/**
 * Estimated NEAR Intents solver spread (basis points). The deposit-address RPC
 * does not return a per-quote fee, so this is a conservative size-scaled
 * estimate — surfaced as an estimate in the cost preview, not a guaranteed fee.
 */
const NEAR_INTENTS_FEE_BPS = 30 // 0.30%

const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

interface NearIntentsRawQuote {
  depositAddress: string
  fromChain: ChainId
  token: string
  amount: string
  recipientAddress: string
}

export const nearIntentsBridgePlugin: BridgePlugin = {
  id: 'nearIntents',
  displayName: 'NEAR Intents (Defuse)',
  supportedTokens: ['ETH', 'USDC'],
  supportedRoutes: [
    { from: 'ethereum', to: 'solana' },
    { from: 'arbitrum', to: 'solana' },
    { from: 'base', to: 'solana' },
  ],

  async getQuote(params: BridgeQuoteParams): Promise<BridgeQuote | null> {
    const { fromChain, toChain, token, amount, recipientAddress } = params

    if (!this.supportedTokens.includes(token)) return null
    if (toChain !== 'solana') return null
    const defuseChain = CHAIN_MAP[fromChain]
    if (!defuseChain) return null

    try {
      const response = await fetchWithTimeout(DEFUSE_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'deposit_address',
          params: [{ account_id: recipientAddress, chain: defuseChain }],
        }),
        timeout: 8000,
      })

      if (!response.ok) return null
      const data = await response.json()
      if (data.error || !data.result) return null

      const depositAddress = data.result

      // Size-scaled fee estimate priced in USD (see NEAR_INTENTS_FEE_BPS).
      const tokenConfig = SUPPORTED_TOKENS[token]
      const decimals = tokenConfig?.decimals ?? 18
      const feeAtomic = (BigInt(amount) * BigInt(NEAR_INTENTS_FEE_BPS)) / 10000n
      let feeUsd = Number(formatUnits(feeAtomic, decimals))
      if (tokenConfig?.coingeckoId) {
        try {
          const prices = await fetchTokenPrices([`coingecko:${tokenConfig.coingeckoId}`])
          const price = prices[`coingecko:${tokenConfig.coingeckoId}`]
          if (price) feeUsd = Number(formatUnits(feeAtomic, decimals)) * price
        } catch {
          // Fall back to the token-denominated estimate.
        }
      }

      return {
        bridgeId: 'nearIntents',
        feeUsd,
        estimatedTimeSeconds: 60,
        expectedOutputAmount: (BigInt(amount) - feeAtomic).toString(),
        slippagePercent: params.slippagePercent,
        expiresAt: new Date(Date.now() + BRIDGE_QUOTE_TTL_MS),
        rawQuote: {
          depositAddress,
          fromChain,
          token,
          amount,
          recipientAddress,
        },
      }
    } catch (error) {
      console.error('[nearIntents] getQuote failed:', error)
      return null
    }
  },

  async buildBridgeTx(quote: BridgeQuote): Promise<UnsignedTx> {
    const raw = quote.rawQuote as NearIntentsRawQuote
    const { depositAddress, fromChain, token, amount } = raw
    const chainId = EVM_CHAIN_ID_MAP[fromChain]
    if (!chainId) throw new Error(`Unsupported chain ${fromChain}`)

    if (token === 'ETH') {
      return {
        chainId,
        to: depositAddress,
        data: '0x',
        value: BigInt(amount),
        description: `Bridge ETH to Solana via NEAR Intents`,
      }
    }

    const tokenConfig = SUPPORTED_TOKENS[token]
    const tokenAddress = tokenConfig?.addresses[fromChain]
    if (!tokenAddress) throw new Error(`Unsupported token ${token} on ${fromChain}`)

    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [depositAddress as Hex, BigInt(amount)],
    })

    return {
      chainId,
      to: tokenAddress,
      data,
      value: BigInt(0),
      description: `Bridge ${token} to Solana via NEAR Intents`,
    }
  },

  async pollStatus(
    _txHash: string,
    _fromChain: ChainId,
    context?: BridgeStatusContext
  ): Promise<BridgeStatus> {
    const trackingUrl = 'https://explorer.near-intents.org'
    const depositAddress = context?.depositAddress

    // NEAR Intents tracks delivery by deposit address, not the source tx hash.
    // Without it we cannot query status, so report pending.
    if (!depositAddress) return { status: 'pending', trackingUrl }

    try {
      const res = await fetchWithTimeout(
        `${ONECLICK_API}/v0/status?depositAddress=${encodeURIComponent(depositAddress)}`,
        { timeout: 8000, cache: 'no-store' }
      )
      if (!res.ok) return { status: 'pending', trackingUrl }

      const data = await res.json()
      switch (data?.status) {
        case 'SUCCESS': {
          const destHash =
            data.swapDetails?.destinationChainTxHashes?.[0]?.hash ??
            data.swapDetails?.destinationTxHash
          return { status: 'complete', destinationTxHash: destHash, trackingUrl }
        }
        case 'FAILED':
          return { status: 'failed', errorMessage: 'NEAR Intents swap failed', trackingUrl }
        case 'REFUNDED':
          return { status: 'failed', errorMessage: 'NEAR Intents swap was refunded to origin', trackingUrl }
        default:
          return { status: 'pending', trackingUrl }
      }
    } catch (e) {
      console.error('[nearIntents] pollStatus failed:', e)
      return { status: 'pending', trackingUrl }
    }
  },
}
