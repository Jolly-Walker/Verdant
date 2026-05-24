import 'server-only'
import { SwapPlugin, SwapQuote, SwapQuoteParams } from '../types/swap-plugin'
import { UnsignedTx } from '@/types/shared'

export const oneinchPlugin: SwapPlugin = {
  id: '1inch',
  displayName: '1inch',
  supportedChains: ['ethereum', 'arbitrum', 'base'],

  async getQuote(_params: SwapQuoteParams): Promise<SwapQuote | null> {
    // STUB: 1inch API integration not yet implemented
    // Real implementation will call https://api.1inch.dev/swap/v6.0/{chainId}/quote
    throw new Error('1inch swap quote not yet implemented')
  },

  async buildSwapTx(_quote: SwapQuote, _userAddress: string): Promise<UnsignedTx> {
    // STUB: 1inch API integration not yet implemented
    // Real implementation will call https://api.1inch.dev/swap/v6.0/{chainId}/swap
    throw new Error('1inch swap tx build not yet implemented')
  }
}
