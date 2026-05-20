import 'server-only'
import { ProtocolPlugin, RewardFetcher, ClaimParams } from '../types/protocol-plugin'
import { ChainId, Reward, UnsignedTx } from '@/types/shared'
import { fetchMerklClaims, MERKL_DISTRIBUTOR_ADDRESS, MerklClaim } from '@/lib/data/merkl'
import { encodeFunctionData, parseAbi } from 'viem'

/**
 * Merkl Distributor ABI — the claim function used by both Morpho and Euler rewards.
 * Source: https://docs.merkl.xyz/merkl-mechanisms/distributor
 */
const MERKL_DISTRIBUTOR_ABI = parseAbi([
  'function claim(address[] users, address[] tokens, uint256[] amounts, bytes32[][] proofs) external'
])

/**
 * Chain ID mapping for Merkl API numeric IDs.
 */
const EVM_CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453,
}

/**
 * Fetches token prices for Merkl reward tokens.
 * Falls back to 0 if the price cannot be resolved.
 */
async function fetchRewardPricesFromDefillama(
  tokenAddresses: string[],
  chain: string
): Promise<Record<string, number>> {
  if (tokenAddresses.length === 0) return {}

  const chainPrefix = chain === 'ethereum' ? 'ethereum' : chain
  const coinsParam = tokenAddresses
    .map(addr => `${chainPrefix}:${addr.toLowerCase()}`)
    .join(',')

  try {
    const res = await fetch(
      `https://coins.llama.fi/prices/current/${coinsParam}`,
      { next: { revalidate: 120 }, signal: AbortSignal.timeout(10_000) }
    )
    if (!res.ok) return {}

    const data = await res.json()
    const priceMap: Record<string, number> = {}
    for (const [key, val] of Object.entries(data.coins ?? {})) {
      const addr = key.split(':')[1]
      if (addr) priceMap[addr.toLowerCase()] = (val as any).price ?? 0
    }
    return priceMap
  } catch {
    return {}
  }
}

/**
 * Converts MerklClaim[] into the Reward[] shape used by the app.
 */
async function merklClaimsToRewards(
  claims: MerklClaim[],
  chain: string
): Promise<Reward[]> {
  const tokenAddresses = claims.map(c => c.token)
  const priceMap = await fetchRewardPricesFromDefillama(tokenAddresses, chain)

  return claims.map(claim => {
    const amount = Number(BigInt(claim.claimableAmount)) / Math.pow(10, claim.decimals)
    const price = priceMap[claim.token.toLowerCase()] ?? 0
    return {
      token: claim.symbol,
      amount: amount.toFixed(8),
      amountUsd: amount * price,
    }
  })
}

/**
 * Encodes a Merkl Distributor claim transaction.
 */
function buildMerklClaimTx(
  userAddress: string,
  claims: MerklClaim[],
  chainId: number,
  chainLabel: string,
  protocolLabel: string
): UnsignedTx {
  // Merkl claim(users[], tokens[], amounts[], proofs[][])
  // proofs[i] = the bytes32[] merkle path proving users[i] can claim tokens[i]
  // We submit one user with N tokens, so proofs has N entries (one per token)
  const claimData = encodeFunctionData({
    abi: MERKL_DISTRIBUTOR_ABI,
    functionName: 'claim',
    args: [
      claims.map(() => userAddress as `0x${string}`),
      claims.map(c => c.token as `0x${string}`),
      claims.map(c => BigInt(c.claimableAmount)),
      claims.map(c => c.proof as `0x${string}`[]),
    ],
  })

  return {
    chainId,
    to: MERKL_DISTRIBUTOR_ADDRESS,
    data: claimData,
    value: 0n,
    description: `Claim ${protocolLabel} rewards on ${chainLabel}`,
  }
}

export const morphoPlugin: ProtocolPlugin = {
  id: 'morpho',
  displayName: 'Morpho',
  supportedChains: ['ethereum', 'arbitrum', 'base'],
  supportedPositionTypes: ['supply'],
  defillamaSlug: 'morpho-blue',
  addresses: {
    ethereum: { poolAddress: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb' },
    arbitrum: { poolAddress: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb' },
    base: { poolAddress: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb' },
  },
  fetcher: {
    fetchPositions: async () => [],
  },
  builder: {
    buildTx: async () => [],
    describeAction: () => 'Morpho Action',
  },
  rewards: {
    fetchRewards: async (address: string, chain: ChainId): Promise<Reward[]> => {
      // Morpho rewards are distributed via Merkl
      const claims = await fetchMerklClaims(address, chain)
      if (claims.length === 0) return []

      return merklClaimsToRewards(claims, chain)
    },

    buildClaimTx: async (params: ClaimParams): Promise<UnsignedTx[]> => {
      const { address, chain } = params
      const chainId = EVM_CHAIN_IDS[chain]
      if (!chainId) throw new Error(`Morpho rewards not supported on ${chain}`)

      const claims = await fetchMerklClaims(address, chain)
      if (claims.length === 0) return []

      return [buildMerklClaimTx(address, claims, chainId, chain, 'Morpho')]
    },
  } satisfies RewardFetcher,
}
