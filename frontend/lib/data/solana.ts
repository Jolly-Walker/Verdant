import { getSolanaConnection } from '@/lib/server/solana'
import { PublicKey } from '@solana/web3.js'
import { RawPosition } from '@/types/shared'
import { fetchTokenPrices } from './prices'
import { SUPPORTED_TOKENS } from '@/constants/tokens'

function getSymbolAndCoingeckoId(mint: string): { symbol: string; coingeckoId: string | null } {
  if (mint === '11111111111111111111111111111111' || mint === 'SOL') {
    return { symbol: 'SOL', coingeckoId: 'coingecko:solana' }
  }

  for (const token of Object.values(SUPPORTED_TOKENS)) {
    if (token.addresses.solana === mint) {
      return { symbol: token.symbol, coingeckoId: `coingecko:${token.coingeckoId}` }
    }
  }

  return { symbol: mint, coingeckoId: null }
}

export async function fetchSolanaTokenBalances(address: string): Promise<RawPosition[]> {
  const connection = getSolanaConnection()
  const pubkey = new PublicKey(address)
  
  // Fetch SOL balance
  const balance = await connection.getBalance(pubkey)
  const solAmount = balance / 1e9

  // Fetch SPL token accounts
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
    programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
  })

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
  
  const prices = await fetchTokenPrices(coingeckoIds)
  
  return positions.map(p => {
    const cgId = p.metadata.coingeckoId as string
    const price = cgId ? (prices[cgId] || 0) : 0
    return {
      ...p,
      amountUsd: p.amount * price
    }
  })
}
