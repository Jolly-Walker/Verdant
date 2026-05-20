import 'server-only'
import { BridgePlugin } from '../types/bridge-plugin'
import { BridgeQuoteParams, BridgeQuote, UnsignedTx, BridgeStatus, ChainId } from '@/types/shared'
import { SUPPORTED_TOKENS } from '@/constants/tokens'
import { encodeFunctionData, pad, Hex } from 'viem'

const TOKEN_MESSENGER_V2 = '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d'

const CIRCLE_DOMAIN_MAP: Partial<Record<ChainId, number>> = {
  ethereum: 0,
  arbitrum: 3,
  base: 6,
}

const EVM_CHAIN_ID_MAP: Partial<Record<ChainId, number>> = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453,
}

const TOKEN_MESSENGER_ABI = [
  {
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
    ],
    name: 'depositForBurn',
    outputs: [{ name: 'nonce', type: 'uint64' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

interface LayerZeroRawQuote {
  destDomain: number
  fromChain: ChainId
  toChain: ChainId
  amount: string
  recipientAddress: string
}

export const layerzeroBridgePlugin: BridgePlugin = {
  id: 'layerzero',
  displayName: 'LayerZero V2 (CCTP)',
  supportedTokens: ['USDC'],
  supportedRoutes: [
    { from: 'ethereum', to: 'arbitrum' },
    { from: 'arbitrum', to: 'ethereum' },
    { from: 'ethereum', to: 'base' },
    { from: 'base', to: 'ethereum' },
    { from: 'arbitrum', to: 'base' },
    { from: 'base', to: 'arbitrum' },
  ],

  async getQuote(params: BridgeQuoteParams): Promise<BridgeQuote | null> {
    const { fromChain, toChain, token, amount } = params

    if (token !== 'USDC') return null
    const destDomain = CIRCLE_DOMAIN_MAP[toChain]
    if (destDomain === undefined) return null

    // For CCTP via LZ, we'd normally query LZ for the messaging fee
    // However, CCTP itself often has zero fee (just gas).
    // LZ adds a messaging fee on top for attestation delivery.
    // Placeholder for now as per requirements.
    const feeUsd = 1.50

    return {
      bridgeId: 'layerzero',
      feeUsd,
      estimatedTimeSeconds: 600, // CCTP usually takes ~10-20 mins
      expectedOutputAmount: amount,
      slippagePercent: params.slippagePercent,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      rawQuote: {
        destDomain,
        fromChain,
        toChain,
        amount,
        recipientAddress: params.recipientAddress,
      },
    }
  },

  async buildBridgeTx(quote: BridgeQuote): Promise<UnsignedTx> {
    const raw = quote.rawQuote as LayerZeroRawQuote
    const { destDomain, fromChain, amount, recipientAddress } = raw
    const chainId = EVM_CHAIN_ID_MAP[fromChain]
    if (!chainId) throw new Error(`Unsupported chain ${fromChain}`)

    const tokenConfig = SUPPORTED_TOKENS['USDC']
    const tokenAddress = tokenConfig?.addresses[fromChain]
    if (!tokenAddress) throw new Error(`USDC not supported on ${fromChain}`)

    // Convert address to bytes32
    const mintRecipient = pad(recipientAddress as Hex, { size: 32 })

    const data = encodeFunctionData({
      abi: TOKEN_MESSENGER_ABI,
      functionName: 'depositForBurn',
      args: [BigInt(amount), destDomain, mintRecipient, tokenAddress as Hex],
    })

    return {
      chainId,
      to: TOKEN_MESSENGER_V2,
      data,
      value: BigInt(0),
      description: `Bridge USDC via LayerZero CCTP`,
    }
  },

  async pollStatus(_txHash: string, _fromChain: ChainId): Promise<BridgeStatus> {
    // LayerZero Scan API can be used to poll status
    return {
      status: 'pending',
    }
  },
}
