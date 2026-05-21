import 'server-only'
import { ProtocolPlugin, RewardFetcher, ClaimParams } from '../types/protocol-plugin'
import { ChainId, Reward, UnsignedTx } from '@/types/shared'
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
    fetchPositions: async () => [],
  },
  builder: {
    buildTx: async (params) => {
      // Mock implementation: in a real app, this would use Pendle SDK to build a redemption tx
      return [
        {
          chainId: params.chain,
          to: '0x0000000000000000000000000000000000000000', // Router address would go here
          data: '0x', // redemption data
          value: 0n,
          description: `Redeem ${params.amount} ${params.asset} on Pendle`,
        }
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
