import 'server-only'
import { getSolanaConnection } from '@/lib/server/solana'
import { PublicKey } from '@solana/web3.js'
import { RawPosition } from '@/types/shared'
import { fetchTokenPrices } from './prices'
import { SUPPORTED_TOKENS } from '@/constants/tokens'
import { withTimeout } from '@/lib/utils/fetch'

// Minimal registry for common Solana tokens not in global SUPPORTED_TOKENS
const SOLANA_TOKEN_REGISTRY: Record<string, { symbol: string; coingeckoId: string }> = {
  'So11111111111111111111111111111111111111112': { symbol: 'wSOL', coingeckoId: 'solana' },
  'J1toso9zYvRGbHcvY9PrpCfMmcQykSreSsiS6UvvS8hH': { symbol: 'JitoSOL', coingeckoId: 'jito-staked-sol' },
  'mSoLzYSa17Bg69K5T6S2n4E52KstT6FBa9M93nE8h7J': { symbol: 'mSOL', coingeckoId: 'msol' },
  'bSo13r4T9reA9S6S7Gf5D7U5Gf5D7U5Gf5D7U5Gf5D7': { symbol: 'bSOL', coingeckoId: 'solblaze-staked-sol' },
  'DezXAZ8z7PnrnMcZE2z49W2n4f38RZ8feY6e8uKdiW1A': { symbol: 'BONK', coingeckoId: 'bonk' },
}

function getSymbolAndCoingeckoId(mint: string): { symbol: string; coingeckoId: string | null } {
  if (mint === '11111111111111111111111111111111' || mint === 'SOL') {
    return { symbol: 'SOL', coingeckoId: 'coingecko:solana' }
  }

  // 1. Check global registry
  for (const token of Object.values(SUPPORTED_TOKENS)) {
    if (token.addresses.solana === mint) {
      return { symbol: token.symbol, coingeckoId: `coingecko:${token.coingeckoId}` }
    }
  }

  // 2. Check Solana-specific local registry
  const local = SOLANA_TOKEN_REGISTRY[mint]
  if (local) {
    return { symbol: local.symbol, coingeckoId: `coingecko:${local.coingeckoId}` }
  }

  // Fallback to short mint address
  return { symbol: `${mint.slice(0, 4)}...${mint.slice(-4)}`, coingeckoId: null }
}

export async function fetchSolanaTokenBalances(address: string): Promise<RawPosition[]> {
  const connection = getSolanaConnection()
  
  try {
    const pubkey = new PublicKey(address)
    
    // Fetch SOL balance and token accounts in parallel with timeout
    const [balance, tokenAccounts] = await Promise.all([
      withTimeout(connection.getBalance(pubkey), 10000),
      withTimeout(connection.getParsedTokenAccountsByOwner(pubkey, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
      }), 10000)
    ])

    const solAmount = balance / 1e9
    const positions: RawPosition[] = []

    if (solAmount > 0) {
      const { symbol, coingeckoId } = getSymbolAndCoingeckoId('SOL')
      positions.push({
        id: `solana-sol-${address}`,
        protocol: 'wallet',
        chain: 'solana',
        asset: symbol,
        assetAddress: '11111111111111111111111111111111',
        amount: solAmount,
        amountUsd: 0,
        currentApy: 0,
        positionType: 'wallet',
        claimableRewards: [],
        metadata: { coingeckoId }
      })
    }

    for (const account of tokenAccounts.value) {
      const data = account.account.data.parsed.info
      const mint = data.mint
      const amount = data.tokenAmount.uiAmount
      
      if (amount > 0) {
        const { symbol, coingeckoId } = getSymbolAndCoingeckoId(mint)
        positions.push({
          id: `solana-${mint}-${address}`,
          protocol: 'wallet',
          chain: 'solana',
          asset: symbol,
          assetAddress: mint,
          amount: amount,
          amountUsd: 0,
          currentApy: 0,
          positionType: 'wallet',
          claimableRewards: [],
          metadata: { coingeckoId }
        })
      }
    }

    // Enrich with prices
    const coingeckoIds = positions
      .map(p => p.metadata.coingeckoId as string)
      .filter(id => !!id)
    
    if (coingeckoIds.length === 0) return positions

    const prices = await fetchTokenPrices(coingeckoIds)
    
    return positions.map(p => {
      const cgId = p.metadata.coingeckoId as string
      const price = cgId ? (prices[cgId] || 0) : 0
      return {
        ...p,
        amountUsd: p.amount * price
      }
    })
  } catch (err) {
    console.warn(`[solana] failed to fetch balances for ${address}:`, err)
    return []
  }
}
