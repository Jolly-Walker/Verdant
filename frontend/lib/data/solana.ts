import { getSolanaConnection } from '@/lib/server/solana'
import { PublicKey } from '@solana/web3.js'
import { RawPosition } from '@/types/shared'
import { fetchTokenPrices } from './prices'

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
    positions.push({
      id: `solana-sol-${address}`,
      protocol: 'wallet',
      chain: 'solana',
      asset: 'SOL',
      assetAddress: '11111111111111111111111111111111',
      amount: solAmount,
      amountUsd: 0, // Will enrich later
      currentApy: 0,
      positionType: 'wallet',
      claimableRewards: [],
      metadata: {}
    })
  }

  for (const account of tokenAccounts.value) {
    const data = account.account.data.parsed.info
    const mint = data.mint
    const amount = data.tokenAmount.uiAmount
    
    if (amount > 0) {
      positions.push({
        id: `solana-${mint}-${address}`,
        protocol: 'wallet',
        chain: 'solana',
        asset: mint, // Should map to symbol if possible
        assetAddress: mint,
        amount: amount,
        amountUsd: 0,
        currentApy: 0,
        positionType: 'wallet',
        claimableRewards: [],
        metadata: {}
      })
    }
  }

  // Enrich with prices
  const prices = await fetchTokenPrices(positions.map(p => p.asset))
  return positions.map(p => ({
    ...p,
    amountUsd: p.amount * (prices[p.asset] || 0)
  }))
}
