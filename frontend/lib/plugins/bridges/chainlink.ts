import 'server-only'
import { BridgePlugin } from '../types/bridge-plugin'
import { BridgeQuoteParams, BridgeQuote, UnsignedTx, BridgeStatus, ChainId } from '@/types/shared'
import { SUPPORTED_TOKENS } from '@/constants/tokens'
import { BRIDGE_QUOTE_TTL_MS } from '@/constants/bridges'
import { encodeFunctionData, encodeAbiParameters, parseAbiParameters, formatUnits, Hex, concat } from 'viem'
import { getPublicClient } from '@/lib/server/rpc'
import { getChainId } from '@/lib/utils/chains'
import { getNativeAssetPrice } from '@/lib/data/prices'

/**
 * Builds the CCIP EVM2AnyMessage struct used by both getFee and ccipSend.
 * Native-ETH transfers carry no token amounts (value is attached separately);
 * ERC20 transfers carry a single token amount. Fees are paid in native gas.
 */
function buildCcipMessage(token: string, amount: string, recipientAddress: string, tokenAddress?: string) {
  const receiver = encodeAbiParameters(parseAbiParameters('address'), [recipientAddress as Hex])
  const tokenAmounts =
    token === 'ETH' || !tokenAddress
      ? []
      : [{ token: tokenAddress as Hex, amount: BigInt(amount) }]
  // 0x97a65719 = EVM extra args v1 tag; default destination gas limit 200k.
  const extraArgs = concat(['0x97a65719', encodeAbiParameters(parseAbiParameters('uint256'), [200000n])])
  return {
    receiver,
    data: '0x' as Hex,
    tokenAmounts,
    feeToken: '0x0000000000000000000000000000000000000000' as Hex, // pay in native
    extraArgs,
  }
}

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
    const { fromChain, toChain, token, amount, recipientAddress } = params
    if (!this.supportedTokens.includes(token)) return null
    const destSelector = CCIP_SELECTORS[toChain]
    if (!destSelector) return null
    const routerAddress = CCIP_ROUTERS[fromChain]
    if (!routerAddress) return null

    const tokenConfig = SUPPORTED_TOKENS[token]
    const tokenAddress = tokenConfig?.addresses[fromChain]
    if (!tokenAddress && token !== 'ETH') return null

    // Query the real CCIP fee on-chain via the router, then price it in USD.
    let feeUsd = 0
    try {
      const client = getPublicClient(fromChain)
      const message = buildCcipMessage(token, amount, recipientAddress, tokenAddress)
      const fee = await client.readContract({
        address: routerAddress as Hex,
        abi: GET_FEE_ABI,
        functionName: 'getFee',
        args: [destSelector, message],
      })
      const nativePrice = await getNativeAssetPrice(fromChain).catch(() => 0)
      feeUsd = Number(formatUnits(fee, 18)) * nativePrice
    } catch (e) {
      console.error('[chainlink] getFee quote failed:', e)
      return null
    }

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
        recipientAddress,
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

    const message = buildCcipMessage(token, amount, recipientAddress, tokenAddress)

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

  async pollStatus(txHash: string, fromChain: ChainId): Promise<BridgeStatus> {
    const trackingUrl = `https://ccip.chain.link/tx/${txHash}`
    // CCIP exposes no public REST status API keyed by the source tx. We can
    // honestly detect a reverted source send; cross-chain delivery (~15 min)
    // is then tracked via the official CCIP explorer.
    try {
      const client = getPublicClient(fromChain)
      const receipt = await client.getTransactionReceipt({ hash: txHash as Hex })
      if (receipt?.status === 'reverted') {
        return { status: 'failed', errorMessage: 'CCIP send reverted on the source chain', trackingUrl }
      }
      return { status: 'pending', trackingUrl }
    } catch {
      return { status: 'pending', trackingUrl }
    }
  },
}
