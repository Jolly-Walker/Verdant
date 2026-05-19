import 'server-only'
import { BridgePlugin } from '../types/bridge-plugin'
import { BridgeQuoteParams, BridgeQuote, UnsignedTx, BridgeStatus, ChainId } from '@/types/shared'
import { SUPPORTED_TOKENS } from '@/constants/tokens'
import { encodeFunctionData, formatUnits } from 'viem'

const DEFUSE_RPC_URL = 'https://bridge.chaindefuser.com/rpc'

const CHAIN_MAP: Partial<Record<ChainId, string>> = {
  ethereum: 'eth:1',
  arbitrum: 'eth:42161',
  base: 'eth:8453',
}

const EVM_CHAIN_ID_MAP: Partial<Record<ChainId, number>> = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453,
}

const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

export const nearIntentsBridgePlugin: BridgePlugin = {
  id: 'nearIntents',
  displayName: 'NEAR Intents (Defuse)',
  supportedTokens: ['ETH', 'USDC'],
  supportedRoutes: [
    { from: 'ethereum', to: 'solana' },
    { from: 'arbitrum', to: 'solana' },
    { from: 'base', to: 'solana' },
  ],

  async getQuote(params: BridgeQuoteParams): Promise<BridgeQuote | null> {
    const { fromChain, toChain, token, amount, recipientAddress } = params

    if (toChain !== 'solana') return null
    const defuseChain = CHAIN_MAP[fromChain]
    if (!defuseChain) return null

    try {
      const response = await fetch(DEFUSE_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'deposit_address',
          params: [{ account_id: recipientAddress, chain: defuseChain }],
        }),
      })

      if (!response.ok) return null
      const data = await response.json()
      if (data.error || !data.result) return null

      const depositAddress = data.result

      // Placeholder fee as per requirements
      const feeUsd = 2.0

      return {
        bridgeId: 'nearIntents',
        feeUsd,
        estimatedTimeSeconds: 60,
        expectedOutputAmount: amount, // Defuse handles exact output, simplified for quote
        slippagePercent: params.slippagePercent,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        rawQuote: {
          depositAddress,
          fromChain,
          token,
          amount,
          recipientAddress,
        },
      }
    } catch (error) {
      console.error('[nearIntents] getQuote failed:', error)
      return null
    }
  },

  async buildBridgeTx(quote: BridgeQuote): Promise<UnsignedTx> {
    const raw = quote.rawQuote as any
    const { depositAddress, fromChain, token, amount } = raw
    const chainId = EVM_CHAIN_ID_MAP[fromChain as ChainId]
    if (!chainId) throw new Error(`Unsupported chain ${fromChain}`)

    if (token === 'ETH') {
      return {
        chainId,
        to: depositAddress,
        data: '0x',
        value: BigInt(amount),
        description: `Bridge ETH to Solana via NEAR Intents`,
      }
    }

    const tokenConfig = SUPPORTED_TOKENS[token]
    const tokenAddress = tokenConfig?.addresses[fromChain as ChainId]
    if (!tokenAddress) throw new Error(`Unsupported token ${token} on ${fromChain}`)

    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [depositAddress, BigInt(amount)],
    })

    return {
      chainId,
      to: tokenAddress,
      data,
      value: BigInt(0),
      description: `Bridge ${token} to Solana via NEAR Intents`,
    }
  },

  async pollStatus(txHash: string, _fromChain: ChainId): Promise<BridgeStatus> {
    // Note: To fully implement recent_deposits, we need account_id (Solana address).
    // The current BridgePlugin interface only provides txHash and fromChain.
    // In a production environment, we would either:
    // 1. Update the interface to pass the recipientAddress/account_id.
    // 2. Extract the account_id from a mapping of txHash to account_id stored during execution.
    // 3. Look up the transaction on-chain to find the deposit address and map it back.
    
    // For now, we return pending as we cannot call recent_deposits without account_id.
    // If we had the account_id, we would do:
    /*
    const response = await fetch(DEFUSE_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'recent_deposits',
        params: [{ account_id: solanaAddress }]
      })
    });
    const data = await response.json();
    const deposit = data.result.find((d: any) => d.tx_hash === txHash || d.amount === amount);
    if (deposit?.status === 'completed') return { status: 'complete', destinationTxHash: deposit.dest_tx_hash };
    */

    return { status: 'pending' }
  },
}
