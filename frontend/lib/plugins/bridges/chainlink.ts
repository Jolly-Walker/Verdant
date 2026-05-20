import 'server-only'
import { BridgePlugin } from '../types/bridge-plugin'
import { BridgeQuoteParams, BridgeQuote, UnsignedTx, BridgeStatus, ChainId } from '@/types/shared'
import { SUPPORTED_TOKENS } from '@/constants/tokens'
import { BRIDGE_QUOTE_TTL_MS } from '@/constants/bridges'
import { encodeFunctionData, encodeAbiParameters, parseAbiParameters, Hex, concat } from 'viem'
import { getPublicClient } from '@/lib/server/rpc'
import { getChainId } from '@/lib/utils/chains'

const CCIP_ROUTERS: Partial<Record<ChainId, string>> = {
  ethereum: '0x80226fc079A2dea56C78548F56E2e88ba1146f7d',
  arbitrum: '0x141f057574EedcCC139bd700f608700e8b58DdE8',
  base: '0x881e3A65B4976C13802645975F58bCD25d0f2193',
}

const CCIP_SELECTORS: Partial<Record<ChainId, bigint>> = {
  ethereum: 5009297550715157269n,
  arbitrum: 4949039107694359620n,
  base: 15971525489660198786n,
}

const ROUTER_ABI = [
  {
    inputs: [
      { name: 'destinationChainSelector', type: 'uint64' },
      {
        name: 'message',
        type: 'tuple',
        components: [
          { name: 'receiver', type: 'bytes' },
          { name: 'data', type: 'bytes' },
          {
            name: 'tokenAmounts',
            type: 'tuple[]',
            components: [
              { name: 'token', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
          },
          { name: 'feeToken', type: 'address' },
          { name: 'extraArgs', type: 'bytes' },
        ],
      },
    ],
    name: 'ccipSend',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'payable',
    type: 'function',
  },
] as const

const GET_FEE_ABI = [
  {
    name: 'getFee',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'destinationChainSelector', type: 'uint64' },
      {
        name: 'message',
        type: 'tuple',
        components: [
          { name: 'receiver', type: 'bytes' },
          { name: 'data', type: 'bytes' },
          {
            name: 'tokenAmounts',
            type: 'tuple[]',
            components: [
              { name: 'token', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
          },
          { name: 'feeToken', type: 'address' },
          { name: 'extraArgs', type: 'bytes' },
        ],
      },
    ],
    outputs: [{ name: 'fee', type: 'uint256' }],
  },
] as const

interface ChainlinkRawQuote {
  destSelector: bigint
  fromChain: ChainId
  toChain: ChainId
  token: string
  amount: string
  recipientAddress: string
}

export const chainlinkBridgePlugin: BridgePlugin = {
  id: 'chainlink',
  displayName: 'Chainlink CCIP',
  supportedTokens: ['ETH', 'USDC', 'LINK'],
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
    const destSelector = CCIP_SELECTORS[toChain]
    if (!destSelector) return null

    // Placeholder fee for CCIP. Real fee depends on destination gas and token prices.
    const feeUsd = 2.5

    return {
      bridgeId: 'chainlink',
      feeUsd,
      estimatedTimeSeconds: 900, // CCIP usually ~15 mins
      expectedOutputAmount: amount,
      slippagePercent: params.slippagePercent,
      expiresAt: new Date(Date.now() + BRIDGE_QUOTE_TTL_MS),
      rawQuote: {
        destSelector,
        fromChain,
        toChain,
        token,
        amount,
        recipientAddress: params.recipientAddress,
      },
    }
  },

  async buildBridgeTx(quote: BridgeQuote): Promise<UnsignedTx> {
    const raw = quote.rawQuote as ChainlinkRawQuote
    const { destSelector, fromChain, token, amount, recipientAddress } = raw
    const routerAddress = CCIP_ROUTERS[fromChain]
    if (!routerAddress) throw new Error(`No CCIP router for ${fromChain}`)

    const tokenConfig = SUPPORTED_TOKENS[token]
    const tokenAddress = tokenConfig?.addresses[fromChain]
    if (!tokenAddress && token !== 'ETH') throw new Error(`Token ${token} not supported on ${fromChain}`)

    // Encode receiver address as bytes
    const receiver = encodeAbiParameters(parseAbiParameters('address'), [recipientAddress as Hex])

    // CCIP token amounts
    const tokenAmounts =
      token === 'ETH'
        ? []
        : [
            {
              token: tokenAddress as Hex,
              amount: BigInt(amount),
            },
          ]

    // Default extra args for EVM (gas limit 200k)
    // 0x97a65719 = EVM extra args v1 tag
    const extraArgs = concat(['0x97a65719', encodeAbiParameters(parseAbiParameters('uint256'), [200000n])])

    const message = {
      receiver,
      data: '0x' as Hex,
      tokenAmounts,
      feeToken: '0x0000000000000000000000000000000000000000' as Hex, // pay in native
      extraArgs,
    }

    // Fetch the required native fee from the router
    const client = getPublicClient(fromChain)
    const fee = await client.readContract({
      address: routerAddress as Hex,
      abi: GET_FEE_ABI,
      functionName: 'getFee',
      args: [destSelector, message],
    })

    const data = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: 'ccipSend',
      args: [destSelector, message],
    })

    return {
      chainId: getChainId(fromChain),
      to: routerAddress,
      data,
      value: token === 'ETH' ? BigInt(amount) + fee : fee,
      description: `Bridge ${token} via Chainlink CCIP`,
    }
  },

  async pollStatus(txHash: string, _fromChain: ChainId): Promise<BridgeStatus> {
    return {
      status: 'pending',
      trackingUrl: `https://ccip.chain.link/tx/${txHash}`,
    }
  },
}
