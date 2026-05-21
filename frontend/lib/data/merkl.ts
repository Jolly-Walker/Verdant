import 'server-only'

/**
 * Merkl Distributor contract address — same on all EVM chains.
 * Source: https://docs.merkl.xyz/merkl-mechanisms/distributor
 */
export const MERKL_DISTRIBUTOR_ADDRESS = '0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae'

/**
 * Chain ID mapping from our internal ChainId strings to EVM numeric chain IDs
 * used by the Merkl API.
 */
const MERKL_CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453,
}

export interface MerklClaim {
  /** ERC20 reward token address */
  token: string
  /** Token symbol */
  symbol: string
  /** Cumulative claimable amount in base units (as string to preserve bigint precision) */
  cumulativeAmount: string
  /** Already claimed amount in base units */
  claimedAmount: string
  /** Claimable amount (cumulative - claimed) in base units */
  claimableAmount: string
  /** Token decimals */
  decimals: number
  /** Merkle proof for claiming */
  proof: string[]
}

export interface MerklResponse {
  chainId: number
  claims: MerklClaim[]
}

interface MerklEntry {
  accumulated?: string
  claimed?: string
  token?: { symbol: string; decimals: number }
  proof?: string[]
}

/**
 * Fetches claimable reward data from the Merkl API for a given user address and chain.
 *
 * @see https://docs.merkl.xyz/merkl-mechanisms/api
 */
export async function fetchMerklClaims(
  userAddress: string,
  chain: string
): Promise<MerklClaim[]> {
  const chainId = MERKL_CHAIN_IDS[chain]
  if (!chainId) return []

  const url = `https://api.merkl.xyz/v4/claim?user=${userAddress}&chainId=${chainId}`

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      // 30s timeout
      signal: AbortSignal.timeout(30_000),
      next: { revalidate: 60 },
    })

    if (!res.ok) {
      console.warn(`[merkl] API returned ${res.status} for ${userAddress} on ${chain}`)
      return []
    }

    const data = await res.json()

    // Merkl v4 response: { [tokenAddress]: { token, proof, accumulated, claimed } }
    const claims: MerklClaim[] = []
    if (data && typeof data === 'object') {
      for (const [tokenAddress, entry] of Object.entries(data as Record<string, MerklEntry>)) {
        const accumulated = BigInt(entry.accumulated ?? '0')
        const claimed = BigInt(entry.claimed ?? '0')
        const claimable = accumulated - claimed
        if (claimable <= 0n) continue

        claims.push({
          token: tokenAddress,
          symbol: entry.token?.symbol ?? tokenAddress.slice(0, 6),
          decimals: entry.token?.decimals ?? 18,
          cumulativeAmount: accumulated.toString(),
          claimedAmount: claimed.toString(),
          claimableAmount: claimable.toString(),
          proof: entry.proof ?? [],
        })
      }
    }

    return claims
  } catch (err) {
    console.error(`[merkl] Failed to fetch claims for ${userAddress} on ${chain}:`, err)
    return []
  }
}

/**
 * Encodes the calldata for the Merkl Distributor `claim` function.
 *
 * function claim(
 *   address[] calldata users,
 *   address[] calldata tokens,
 *   uint256[] calldata amounts,
 *   bytes32[][] calldata proofs
 * )
 */
export function encodeMerklClaim(
  userAddress: string,
  claims: MerklClaim[]
): string {
  // Manual ABI encoding — avoids importing viem's parseAbi at this layer
  // Selector: keccak256("claim(address[],address[],uint256[],bytes32[][])") = 0x2e7ba6ef
  const selector = '0x2e7ba6ef'

  // Use dynamic ABI encoding via the same viem encodeFunctionData pattern
  // but we return a structured object so callers can use it with viem
  // This function is deliberately simple — return the encoded tuple as JSON
  // so the route handler / buildClaimTx can encode it properly with viem.
  return JSON.stringify({
    selector,
    users: [userAddress],
    tokens: claims.map(c => c.token),
    amounts: claims.map(c => c.claimableAmount),
    proofs: claims.map(c => c.proof),
  })
}
