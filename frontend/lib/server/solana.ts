import 'server-only'
import { Connection } from '@solana/web3.js'
import { getRpcUrl } from './rpc'

export function getSolanaConnection(): Connection {
  return new Connection(getRpcUrl('solana'))
}
