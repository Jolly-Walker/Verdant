import 'server-only'
import { ProtocolPlugin, RewardFetcher, ClaimParams } from '../types/protocol-plugin'
import { ChainId, Reward, UnsignedTx, RawPosition, TxBuildParams } from '@/types/shared'
import { SUPPORTED_TOKENS } from '@/constants/tokens'
import { encodeFunctionData, parseAbi } from 'viem'

/**
 * Pendle YieldToken ABI — subset for redeeming accrued interest and rewards.
 * Source: https://docs.pendle.finance/Developers/Contracts/YieldToken
 */
const PENDLE_YT_ABI = parseAbi([
  'function redeemDueInterestAndRewards(address user, bool redeemInterest, bool redeemRewards) returns (uint256 interestOut, uint256[] rewardsOut)',
  'function getRewardTokens() view returns (address[])',
  'function userInterest(address user) view returns (uint128 lastPYIndex, uint256 accruedInterest)',
])

/**
 * Pendle API base URLs.
 * Source: https://api-v2.pendle.finance/core/docs
 */
const PENDLE_API_BASE = 'https://api-v2.pendle.finance/core/v1'
const PENDLE_API_CORE = 'https://api-v2.pendle.finance/core'

/** Chain ID numeric mapping for Pendle API */
const PENDLE_CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
}

/** EVM numeric chain IDs for transaction building */
const EVM_CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453,
}

interface PendleUserPosition {
  marketAddress: string
  ytAddress: string
  pendingYield?: { token: string; amount: number; amountUsd: number }
}

interface PendleBalance {
  ytBalance?: string | number
  market?: { address: string }
  marketAddress?: string
  yt?: { address: string }
  ytAddress?: string
  underlyingAsset?: string
  pendingYield?: {
    token?: { symbol: string }
    amount?: string | number
    amountUsd?: string | number
  }
}

/**
 * Fetches pending yields and rewards for a user across all Pendle markets on a chain.
 */
async function fetchPendleUserRewards(
  address: string,
  chainId: number
): Promise<PendleUserPosition[]> {
  try {
    const url = `${PENDLE_API_BASE}/${chainId}/user-balances/${address}`
    const res = await fetch(url, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return []
    const data = await res.json()

    // Pendle API response structure: { balances: [{ market, ytBalance, pendingYields }] }
    const balances: PendleBalance[] = data.balances ?? data.results ?? []
    return balances
      .filter((b) => Number(b.ytBalance ?? 0) > 0 || Number(b.pendingYield?.amount ?? 0) > 0)
      .map((b) => ({
        marketAddress: b.market?.address ?? b.marketAddress ?? '',
        ytAddress: b.yt?.address ?? b.ytAddress ?? '',
        pendingYield: b.pendingYield
          ? {
              token: b.pendingYield.token?.symbol ?? b.underlyingAsset ?? 'SY',
              amount: Number(b.pendingYield.amount ?? 0),
              amountUsd: Number(b.pendingYield.amountUsd ?? 0),
            }
          : undefined,
      }))
  } catch {
    return []
  }
}

interface PendleConvertResult {
  to: string
  data: string
  value: string
  amountOut?: string
}

/**
 * Calls Pendle's universal Convert API to build a swap/redeem transaction
 * (e.g. PT → underlying). Returns the unsigned tx and expected output.
 * Source: https://docs.pendle.finance/Developers/Backend/HostedSdk
 */
async function fetchPendleConvert(opts: {
  chainId: number
  receiver: string
  slippage: number // decimal, e.g. 0.01 = 1%
  tokenIn: string
  amountIn: string // smallest units
  tokenOut: string
}): Promise<PendleConvertResult> {
  const qs = new URLSearchParams({
    receiver: opts.receiver,
    slippage: String(opts.slippage),
    tokensIn: opts.tokenIn,
    amountsIn: opts.amountIn,
    tokensOut: opts.tokenOut,
    enableAggregator: 'true',
  })
  const url = `${PENDLE_API_CORE}/v2/sdk/${opts.chainId}/convert?${qs.toString()}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`Pendle convert API error: ${res.status}`)

  const json = await res.json()
  // The Convert API returns { tx: { to, data, value }, data: { amountOut } }.
  const tx = json.tx ?? json.transactions?.[0]
  if (!tx?.to || !tx?.data) {
    throw new Error('Pendle convert API returned no transaction')
  }
  return {
    to: tx.to,
    data: tx.data,
    value: String(tx.value ?? '0'),
    amountOut: json.data?.amountOut != null ? String(json.data.amountOut) : undefined,
  }
}

/**
 * Previews the underlying output of a PT → underlying redemption using Pendle's
 * real Convert API (the same `/v2/sdk/{chainId}/convert` endpoint `buildTx` uses).
 * Returns the expected output in the token's smallest units, or `null` when the
 * chain/tokens are unsupported or the API does not report `amountOut`.
 *
 * Callers must treat this as an estimate: actual redemption output can drift with
 * market price near maturity, so apply a slippage buffer before relying on it and
 * let the mandatory simulation gate re-validate at execution.
 */
export async function previewPendleRedemption(opts: {
  chain: ChainId
  receiver: string
  ptAddress: string
  amountIn: string // PT amount in smallest units
  underlyingAddress: string
  slippagePercent: number
}): Promise<string | null> {
  const chainId = PENDLE_CHAIN_IDS[opts.chain]
  if (!chainId) return null
  if (!opts.ptAddress || !opts.underlyingAddress) return null

  try {
    const result = await fetchPendleConvert({
      chainId,
      receiver: opts.receiver,
      slippage: opts.slippagePercent / 100,
      tokenIn: opts.ptAddress,
      amountIn: opts.amountIn,
      tokenOut: opts.underlyingAddress,
    })
    return result.amountOut ?? null
  } catch {
    return null
  }
}

export const pendlePlugin: ProtocolPlugin = {
  id: 'pendle',
  displayName: 'Pendle',
  supportedChains: ['ethereum', 'arbitrum'],
  supportedPositionTypes: ['pendle-pt', 'pendle-yt'],
  defillamaSlug: 'pendle',
  addresses: {
    ethereum: { poolAddress: '0x888888888889758F76e7103c6CbF23ABbF58F946' },
    arbitrum: { poolAddress: '0x888888888889758F76e7103c6CbF23ABbF58F946' },
  },
  fetcher: {
    // Best-effort: derives PT/YT positions from the same user-balances endpoint
    // the rewards path uses. Field availability varies by market; entries are
    // mapped defensively and unknown shapes are skipped rather than guessed.
    fetchPositions: async (address: string, chain: ChainId): Promise<RawPosition[]> => {
      const chainId = PENDLE_CHAIN_IDS[chain]
      if (!chainId) return []

      try {
        const res = await fetch(`${PENDLE_API_BASE}/${chainId}/user-balances/${address}`, {
          next: { revalidate: 60 },
          signal: AbortSignal.timeout(15_000),
        })
        if (!res.ok) return []
        const data = await res.json()
        const balances: PendleBalance[] = data.balances ?? data.results ?? []

        const positions: RawPosition[] = []
        for (const b of balances) {
          const ytBalance = Number(b.ytBalance ?? 0)
          if (ytBalance <= 0) continue
          const marketAddress = b.market?.address ?? b.marketAddress ?? ''
          const ytAddress = b.yt?.address ?? b.ytAddress ?? ''
          positions.push({
            id: `pendle-yt-${chain}-${marketAddress || ytAddress}`,
            protocol: 'pendle',
            chain,
            asset: b.underlyingAsset ?? b.pendingYield?.token?.symbol ?? 'YT',
            assetAddress: ytAddress,
            amount: ytBalance,
            amountUsd: Number(b.pendingYield?.amountUsd ?? 0),
            currentApy: 0,
            positionType: 'pendle-yt',
            claimableRewards: [],
            metadata: { marketAddress, ytAddress },
          })
        }
        return positions
      } catch {
        return []
      }
    },
  },
  builder: {
    // Builds a real redeem/swap transaction via Pendle's Convert API. The caller
    // supplies the PT/SY token (extraParams.tokenIn) and the desired output
    // token (extraParams.tokenOut, or resolved from `asset`). Amounts are wei.
    buildTx: async (params: TxBuildParams): Promise<UnsignedTx[]> => {
      const chainId = PENDLE_CHAIN_IDS[params.chain]
      const evmChainId = EVM_CHAIN_IDS[params.chain]
      if (!chainId || !evmChainId) {
        throw new Error(`Pendle is not supported on ${params.chain}`)
      }

      // Accept either tokenIn or the template's ptAddress for the input token.
      const tokenIn =
        (params.extraParams?.tokenIn as string | undefined) ??
        (params.extraParams?.ptAddress as string | undefined)

      // Output token: an explicit address, else resolve the underlyingAsset /
      // asset symbol against the token registry.
      const resolveAddress = (value?: string): string | undefined => {
        if (!value) return undefined
        if (/^0x[a-fA-F0-9]{40}$/.test(value)) return value
        return SUPPORTED_TOKENS[value.toUpperCase()]?.addresses[params.chain]
      }
      const underlyingSymbol = params.extraParams?.underlyingAsset as string | undefined
      const tokenOut =
        (params.extraParams?.tokenOut as string | undefined) ??
        resolveAddress(underlyingSymbol) ??
        resolveAddress(params.asset)

      if (!tokenIn || !tokenOut) {
        throw new Error(
          'Pendle buildTx requires extraParams.tokenIn/ptAddress and a resolvable output token'
        )
      }

      const decimals =
        SUPPORTED_TOKENS[(underlyingSymbol ?? params.asset).toUpperCase()]?.decimals ?? 18
      const isWei = params.extraParams?.isWei === true
      const amountIn = isWei
        ? params.amount
        : BigInt(Math.floor(Number(params.amount) * Math.pow(10, decimals))).toString()
      const slippage = (params.extraParams?.slippagePercent as number | undefined)
        ? (params.extraParams!.slippagePercent as number) / 100
        : 0.01

      const result = await fetchPendleConvert({
        chainId,
        receiver: params.userAddress,
        slippage,
        tokenIn,
        amountIn,
        tokenOut,
      })

      return [
        {
          chainId: evmChainId,
          to: result.to,
          data: result.data,
          value: BigInt(result.value),
          description: `Redeem ${params.amount} ${params.asset} on Pendle`,
        },
      ]
    },
    describeAction: (params) => {
      if (params.action === 'withdraw') {
        return `Redeem ${params.asset} on Pendle`
      }
      return `Pendle ${params.action}`
    },
  },
  rewards: {
    fetchRewards: async (address: string, chain: ChainId): Promise<Reward[]> => {
      const chainId = PENDLE_CHAIN_IDS[chain]
      if (!chainId) return []

      const positions = await fetchPendleUserRewards(address, chainId)
      const rewards: Reward[] = []

      for (const pos of positions) {
        if (!pos.pendingYield) continue
        const { token, amount, amountUsd } = pos.pendingYield
        if (amount <= 0) continue

        rewards.push({
          token,
          amount: amount.toFixed(8),
          amountUsd,
        })
      }

      return rewards
    },

    buildClaimTx: async (params: ClaimParams): Promise<UnsignedTx[]> => {
      const { address, chain } = params
      const chainId = PENDLE_CHAIN_IDS[chain]
      const evmChainId = EVM_CHAIN_IDS[chain]
      if (!chainId || !evmChainId) {
        throw new Error(`Pendle rewards not supported on ${chain}`)
      }

      const positions = await fetchPendleUserRewards(address, chainId)
      const txs: UnsignedTx[] = []

      for (const pos of positions) {
        if (!pos.pendingYield || !pos.ytAddress) continue
        if (pos.pendingYield.amount <= 0) continue

        // Call redeemDueInterestAndRewards on the YT contract
        const claimData = encodeFunctionData({
          abi: PENDLE_YT_ABI,
          functionName: 'redeemDueInterestAndRewards',
          args: [address as `0x${string}`, true, true],
        })

        txs.push({
          chainId: evmChainId,
          to: pos.ytAddress,
          data: claimData,
          value: 0n,
          description: `Claim Pendle YT interest & rewards (market ${pos.marketAddress.slice(0, 10)}...)`,
        })
      }

      return txs
    },
  } satisfies RewardFetcher,
}
