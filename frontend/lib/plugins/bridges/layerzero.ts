import 'server-only'
import { BridgePlugin } from '../types/bridge-plugin'
import { BridgeQuoteParams, BridgeQuote, UnsignedTx, BridgeStatus, ChainId } from '@/types/shared'
import { SUPPORTED_TOKENS } from '@/constants/tokens'
import { BRIDGE_QUOTE_TTL_MS } from '@/constants/bridges'
import { encodeFunctionData, pad, formatUnits, Hex } from 'viem'
import { fetchWithTimeout } from '@/lib/utils/fetch'
import { fetchTokenPrices } from '@/lib/data/prices'
import { getExplorerTxUrl } from '@/lib/utils/chains'

// CCTP v2 TokenMessengerV2 — same canonical address across supported EVM chains.
const TOKEN_MESSENGER_V2 = '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d'

// Circle's IRIS attestation/fee service (free for standard transfers).
const CIRCLE_IRIS_API = 'https://iris-api.circle.com'

// Circle CCTP domain IDs (not EVM chain IDs).
const CIRCLE_DOMAIN_MAP: Partial<Record<ChainId, number>> = {
  ethereum: 0,
  arbitrum: 3,
  base: 6,
}

const EVM_CHAIN_ID_MAP: Partial<Record<ChainId, number>> = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453,
}

/**
 * CCTP v2 finality thresholds. 2000 = standard transfer (waits for source hard
 * finality, fee typically 0); 1000 = fast transfer (small bps fee). Verdant uses
 * standard transfers — no protocol fee, just gas + source finality wait.
 */
const STANDARD_FINALITY_THRESHOLD = 2000

// Approximate wall-clock to source hard finality + attestation, per source chain.
const SOURCE_FINALITY_SECONDS: Partial<Record<ChainId, number>> = {
  ethereum: 1140, // ~19 min (2 epochs)
  arbitrum: 1140,
  base: 1140,
}

const ZERO_BYTES32 = pad('0x', { size: 32 })

// CCTP v2 TokenMessengerV2.depositForBurn (7 args — differs from v1's 4).
const TOKEN_MESSENGER_V2_ABI = [
  {
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
      { name: 'destinationCaller', type: 'bytes32' },
      { name: 'maxFee', type: 'uint256' },
      { name: 'minFinalityThreshold', type: 'uint32' },
    ],
    name: 'depositForBurn',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

interface LayerZeroRawQuote {
  destDomain: number
  fromChain: ChainId
  toChain: ChainId
  amount: string
  recipientAddress: string
  /** Max fee (atomic token units) accepted for the burn — from the IRIS fee quote. */
  maxFee: string
  minFinalityThreshold: number
}

interface CircleFeeEntry {
  finalityThreshold: number
  minimumFee: number // basis points (1 = 0.01%)
}

export const layerzeroBridgePlugin: BridgePlugin = {
  id: 'layerzero',
  displayName: 'LayerZero V2 (CCTP)',
  supportedTokens: ['USDC'],
  supportedRoutes: [
    { from: 'ethereum', to: 'arbitrum' },
    { from: 'arbitrum', to: 'ethereum' },
    { from: 'ethereum', to: 'base' },
    { from: 'base', to: 'ethereum' },
    { from: 'arbitrum', to: 'base' },
    { from: 'base', to: 'arbitrum' },
  ],

  async getQuote(params: BridgeQuoteParams): Promise<BridgeQuote | null> {
    const { fromChain, toChain, token, amount } = params

    if (token !== 'USDC') return null
    const srcDomain = CIRCLE_DOMAIN_MAP[fromChain]
    const destDomain = CIRCLE_DOMAIN_MAP[toChain]
    if (srcDomain === undefined || destDomain === undefined) return null

    // Kick off the USDC price lookup up front — it's independent of the fee
    // query, so the two network calls run concurrently.
    const pricePromise = fetchTokenPrices(['coingecko:usd-coin']).catch(
      () => ({} as Record<string, number>)
    )

    // Query the real CCTP fee for this route. Standard transfers are typically
    // 0 bps; we still query so the number reflects Circle's live schedule.
    let minimumFeeBps = 0
    try {
      const res = await fetchWithTimeout(
        `${CIRCLE_IRIS_API}/v2/burn/USDC/fees/${srcDomain}/${destDomain}`,
        { timeout: 8000 }
      )
      if (res.ok) {
        const fees = (await res.json()) as CircleFeeEntry[]
        const standard =
          Array.isArray(fees)
            ? fees.find((f) => f.finalityThreshold >= STANDARD_FINALITY_THRESHOLD) ?? fees[0]
            : undefined
        if (standard && Number.isFinite(standard.minimumFee)) {
          minimumFeeBps = standard.minimumFee
        }
      }
    } catch (e) {
      console.warn('[layerzero] CCTP fee lookup failed, assuming 0 bps:', e)
    }

    const amountBI = BigInt(amount)
    const maxFeeAtomic = (amountBI * BigInt(Math.round(minimumFeeBps))) / 10000n
    const decimals = SUPPORTED_TOKENS['USDC']?.decimals ?? 6

    const feeTokens = Number(formatUnits(maxFeeAtomic, decimals))
    // USDC ≈ $1, so the unpriced fee is already a good approximation if the
    // price lookup came back empty.
    const price = (await pricePromise)['coingecko:usd-coin']
    const feeUsd = price ? feeTokens * price : feeTokens

    return {
      bridgeId: 'layerzero',
      feeUsd,
      estimatedTimeSeconds: SOURCE_FINALITY_SECONDS[fromChain] ?? 1140,
      expectedOutputAmount: (amountBI - maxFeeAtomic).toString(),
      slippagePercent: params.slippagePercent,
      expiresAt: new Date(Date.now() + BRIDGE_QUOTE_TTL_MS),
      rawQuote: {
        destDomain,
        fromChain,
        toChain,
        amount,
        recipientAddress: params.recipientAddress,
        maxFee: maxFeeAtomic.toString(),
        minFinalityThreshold: STANDARD_FINALITY_THRESHOLD,
      },
    }
  },

  async buildBridgeTx(quote: BridgeQuote): Promise<UnsignedTx> {
    const raw = quote.rawQuote as LayerZeroRawQuote
    const { destDomain, fromChain, amount, recipientAddress } = raw
    const chainId = EVM_CHAIN_ID_MAP[fromChain]
    if (!chainId) throw new Error(`Unsupported chain ${fromChain}`)

    const tokenConfig = SUPPORTED_TOKENS['USDC']
    const tokenAddress = tokenConfig?.addresses[fromChain]
    if (!tokenAddress) throw new Error(`USDC not supported on ${fromChain}`)

    const mintRecipient = pad(recipientAddress as Hex, { size: 32 })

    const data = encodeFunctionData({
      abi: TOKEN_MESSENGER_V2_ABI,
      functionName: 'depositForBurn',
      args: [
        BigInt(amount),
        destDomain,
        mintRecipient,
        tokenAddress as Hex,
        ZERO_BYTES32, // destinationCaller: anyone may mint on destination
        BigInt(raw.maxFee ?? '0'),
        raw.minFinalityThreshold ?? STANDARD_FINALITY_THRESHOLD,
      ],
    })

    return {
      chainId,
      to: TOKEN_MESSENGER_V2,
      data,
      value: BigInt(0),
      description: `Bridge USDC via LayerZero CCTP`,
    }
  },

  async pollStatus(txHash: string, fromChain: ChainId): Promise<BridgeStatus> {
    const srcDomain = CIRCLE_DOMAIN_MAP[fromChain]
    let trackingUrl: string
    try {
      trackingUrl = getExplorerTxUrl(fromChain, txHash)
    } catch {
      trackingUrl = `https://layerzeroscan.com/tx/${txHash}`
    }

    if (srcDomain === undefined) return { status: 'pending', trackingUrl }

    try {
      const res = await fetchWithTimeout(
        `${CIRCLE_IRIS_API}/v2/messages/${srcDomain}?transactionHash=${txHash}`,
        { timeout: 8000, cache: 'no-store' }
      )
      if (!res.ok) return { status: 'pending', trackingUrl }

      const data = await res.json()
      const message = Array.isArray(data?.messages) ? data.messages[0] : undefined
      if (!message) return { status: 'pending', trackingUrl }

      // 'complete' = burn attested by Circle and the cross-chain message is
      // available for minting on the destination. If a forwarding service has
      // already minted, forwardTxHash carries the destination tx.
      if (message.status === 'complete' && message.attestation && message.attestation !== '0x') {
        return {
          status: 'complete',
          destinationTxHash: message.forwardTxHash,
          trackingUrl,
        }
      }

      return { status: 'pending', trackingUrl }
    } catch (e) {
      console.error('[layerzero] pollStatus failed:', e)
      return { status: 'pending', trackingUrl }
    }
  },
}
