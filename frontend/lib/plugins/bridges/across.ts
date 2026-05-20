import 'server-only'
import { BridgePlugin } from '../types/bridge-plugin'
import { BridgeQuoteParams, BridgeQuote, UnsignedTx, BridgeStatus, ChainId } from '@/types/shared'
import { SUPPORTED_TOKENS } from '@/constants/tokens'
import { fetchTokenPrices } from '@/lib/data/prices'
import { encodeFunctionData, formatUnits } from 'viem'

const CHAIN_ID_MAP: Record<ChainId, number> = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453,
  solana: 0,
}

const SPOKE_POOL_ADDRESSES: Record<number, string> = {
  1: '0x59728544B08AB483533076417FbBB2fD0B17CE3a',
  42161: '0xe35e90606014e36ce7752fe314d19af0c7e0c7e9',
  8453: '0x09aea4b2242abec37395018139bd7529c29d3388',
}

const SPOKE_POOL_ABI = [
  {
    inputs: [
      { name: 'depositor', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'inputToken', type: 'address' },
      { name: 'outputToken', type: 'address' },
      { name: 'inputAmount', type: 'uint256' },
      { name: 'outputAmount', type: 'uint256' },
      { name: 'destinationChainId', type: 'uint256' },
      { name: 'exclusiveRelayer', type: 'address' },
      { name: 'quoteTimestamp', type: 'uint32' },
      { name: 'fillDeadline', type: 'uint32' },
      { name: 'exclusivityDeadline', type: 'uint32' },
      { name: 'message', type: 'bytes' },
    ],
    name: 'depositV3',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
] as const

interface AcrossRawQuote {
  inputAmount: string
  inputToken: `0x${string}`
  outputToken: `0x${string}`
  originChainId: number
  destinationChainId: number
  recipientAddress: `0x${string}`
  tokenSymbol: string
  decimals: number
  timestamp: string | number
  exclusiveRelayer?: `0x${string}`
  exclusivityDeadline?: string | number
}

export const acrossBridgePlugin: BridgePlugin = {
  id: 'across',
  displayName: 'Across Protocol',
  supportedTokens: ['ETH', 'USDC', 'USDT', 'WBTC'],
  supportedRoutes: [
    { from: 'ethereum', to: 'arbitrum' },
    { from: 'arbitrum', to: 'ethereum' },
    { from: 'ethereum', to: 'base' },
    { from: 'base', to: 'ethereum' },
    { from: 'arbitrum', to: 'base' },
    { from: 'base', to: 'arbitrum' },
  ],

  async getQuote(params: BridgeQuoteParams): Promise<BridgeQuote | null> {
    const { fromChain, toChain, token, amount, recipientAddress } = params
    const originChainId = CHAIN_ID_MAP[fromChain]
    const destinationChainId = CHAIN_ID_MAP[toChain]

    if (!originChainId || !destinationChainId) return null

    const tokenConfig = SUPPORTED_TOKENS[token === 'ETH' ? 'WETH' : token]
    if (!tokenConfig) return null

    const inputToken = tokenConfig.addresses[fromChain]
    const outputToken = tokenConfig.addresses[toChain]

    if (!inputToken || !outputToken) return null

    try {
      const url = `https://app.across.to/api/suggested-fees?inputToken=${inputToken}&outputToken=${outputToken}&originChainId=${originChainId}&destinationChainId=${destinationChainId}&amount=${amount}&recipient=${recipientAddress}`
      
      const response = await fetch(url)
      if (!response.ok) return null

      const data = await response.json()

      const relayFeeTotal = BigInt(data.relayFeeTotal || '0')
      const relayGasFeeTotal = BigInt(data.relayGasFeeTotal || '0')
      const capitalFeeTotal = BigInt(data.capitalFeeTotal || '0')
      const totalFeeAtomic = relayFeeTotal + relayGasFeeTotal + capitalFeeTotal
      
      const inputAmount = BigInt(amount)
      const expectedOutputAmount = (inputAmount - totalFeeAtomic).toString()

      // Fetch token price to calculate feeUsd
      let feeUsd = 0
      try {
        const priceData = await fetchTokenPrices([`coingecko:${tokenConfig.coingeckoId}`])
        const price = priceData[`coingecko:${tokenConfig.coingeckoId}`]
        if (price) {
          feeUsd = Number(formatUnits(totalFeeAtomic, tokenConfig.decimals)) * price
        }
      } catch (e) {
        console.warn('Failed to fetch price for Across feeUsd calculation', e)
      }

      return {
        bridgeId: 'across',
        feeUsd,
        estimatedTimeSeconds: data.estimatedFillTime || 120,
        expectedOutputAmount,
        slippagePercent: params.slippagePercent,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        rawQuote: {
          ...data,
          inputToken,
          outputToken,
          originChainId,
          destinationChainId,
          recipientAddress,
          inputAmount: amount,
          tokenSymbol: token,
          decimals: tokenConfig.decimals
        }
      }
    } catch (error) {
      console.error('Error fetching Across quote:', error)
      return null
    }
  },

  async buildBridgeTx(quote: BridgeQuote): Promise<UnsignedTx> {
    const raw = quote.rawQuote as AcrossRawQuote
    const inputAmount = BigInt(raw.inputAmount)
    const outputAmount = BigInt(quote.expectedOutputAmount)
    const destinationChainId = BigInt(raw.destinationChainId)
    
    const data = encodeFunctionData({
      abi: SPOKE_POOL_ABI,
      functionName: 'depositV3',
      args: [
        raw.recipientAddress, // depositor
        raw.recipientAddress, // recipient
        raw.inputToken,
        raw.outputToken,
        inputAmount,
        outputAmount,
        destinationChainId,
        raw.exclusiveRelayer || '0x0000000000000000000000000000000000000000',
        Number(raw.timestamp),
        Number(raw.timestamp) + 21600, // fillDeadline, 6 hours default
        Number(raw.exclusivityDeadline || 0),
        '0x', // message
      ],
    })

    // Check if it's native ETH. In Across, WETH address + value = native ETH deposit
    const isEth = raw.tokenSymbol === 'ETH'
    
    return {
      chainId: raw.originChainId,
      to: (SPOKE_POOL_ADDRESSES[raw.originChainId] || '0x59728544B08AB483533076417FbBB2fD0B17CE3a') as `0x${string}`,
      data,
      value: isEth ? inputAmount : BigInt(0),
      description: `Bridge ${formatUnits(inputAmount, raw.decimals)} ${raw.tokenSymbol} via Across`,
    }
  },

  async pollStatus(txHash: string, _fromChain: ChainId): Promise<BridgeStatus> {
    try {
      const response = await fetch(`https://across.to/api/deposit/status?originTransactionHash=${txHash}`, {
        cache: 'no-store'
      })

      if (!response.ok) {
        return { status: 'pending' }
      }

      const data = await response.json()
      
      if (data.status === 'filled') {
        return {
          status: 'complete',
          destinationTxHash: data.fillTxs?.[0]?.hash
        }
      }

      if (data.status === 'expired') {
        return {
          status: 'failed',
          errorMessage: 'Across deposit expired'
        }
      }

      return { status: 'pending' }
    } catch (error) {
      console.error('Error polling Across bridge status:', error)
      return { status: 'pending' }
    }
  }
}
