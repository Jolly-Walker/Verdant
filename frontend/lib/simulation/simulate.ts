import 'server-only'
import { formatUnits } from 'viem'
import { ChainId, ProtocolId } from '@/types/shared'
import { CHAIN_REGISTRY } from '@/lib/plugins/chains'
import { SimulationResult, StateChange } from '@/types/sequencer'
import { decodeRevertReason } from './errors'
import { VersionedTransaction } from '@solana/web3.js'
import { getSolanaConnection } from '../server/solana'
import { getPublicClient } from '../server/rpc'

interface AlchemySimulateResult {
  gasUsed?: string
  error?: string
  assetChanges?: Array<{ from?: string; to?: string; rawAmount: string; symbol?: string; decimals: number; contractAddress?: string }>
  approvals?: Array<{ owner?: string; rawAmount: string; symbol?: string; decimals: number; contractAddress?: string }>
}

/**
 * Estimates the gas required to bridge an asset.
 * Refactored to use ChainPlugin's estimation logic.
 */
export async function estimateBridgeGas(sourceChain: ChainId, _asset: string): Promise<number> {
  const plugin = CHAIN_REGISTRY[sourceChain]
  if (!plugin) return 65_000

  // We pass a dummy tx to get a baseline estimate from the plugin
  // In a real scenario, buildBridgeTx would provide the data
  return plugin.estimateGasCostUsd({})
}

/**
 * Estimates the gas required to deposit into a protocol.
 */
export async function estimateDepositGas(destChain: ChainId, _protocol: ProtocolId, _asset: string): Promise<number> {
  const plugin = CHAIN_REGISTRY[destChain]
  if (!plugin) return 250_000

  return plugin.estimateGasCostUsd({})
}

/**
 * Performs a full simulation of a transaction using Alchemy Simulation API or Solana's simulateTransaction.
 */
export async function simulateTransaction(params: {
  chain: ChainId
  to: string
  from: string
  data: string
  value: string
}): Promise<SimulationResult> {
  if (params.chain === 'solana') {
    return simulateSolanaTransaction(params)
  }

  try {
    const client = getPublicClient(params.chain)
    
    // 1. Use alchemy_simulateExecution to get detailed trace and asset changes
    const result = await client.request({
      // @ts-expect-error - alchemy_simulateExecution is an Alchemy extension
      method: 'alchemy_simulateExecution',
      params: [{
        from: params.from as `0x${string}`,
        to: params.to as `0x${string}`,
        data: params.data as `0x${string}`,
        value: `0x${BigInt(params.value).toString(16)}`,
      }]
    }) as AlchemySimulateResult

    if (result.error) {
      return {
        success: false,
        revertReason: decodeRevertReason(result.error),
        revertData: result.error,
        simulatedAt: new Date(),
      }
    }

    // 2. Extract asset changes
    const stateChanges: StateChange[] = []
    if (result.assetChanges) {
      for (const change of result.assetChanges) {
        const isUserFrom = change.from?.toLowerCase() === params.from.toLowerCase()
        const isUserTo = change.to?.toLowerCase() === params.from.toLowerCase()

        if (isUserFrom || isUserTo) {
          const amount = formatUnits(BigInt(change.rawAmount), change.decimals)
          const delta = isUserFrom ? `-${amount}` : `+${amount}`
          
          stateChanges.push({
            asset: change.symbol || 'Unknown',
            assetAddress: change.contractAddress || '',
            change: delta,
            type: 'balance',
            decimals: change.decimals,
            chainId: params.chain
          })
        }
      }
    }

    if (result.approvals) {
      for (const approval of result.approvals) {
        if (approval.owner?.toLowerCase() !== params.from.toLowerCase()) continue
        stateChanges.push({
          asset: approval.symbol || 'Unknown',
          assetAddress: approval.contractAddress || '',
          change: `Approve ${formatUnits(BigInt(approval.rawAmount), approval.decimals)}`,
          type: 'allowance',
          decimals: approval.decimals,
          chainId: params.chain
        })
      }
    }

    return {
      success: true,
      gasEstimate: BigInt(result.gasUsed || 0),
      stateChanges,
      simulatedAt: new Date(),
    }
  } catch (err) {
    console.error('Alchemy simulation error:', err)
    
    // Fallback to Tenderly if configured
    if (process.env.TENDERLY_ACCESS_KEY) {
      try {
        return await simulateWithTenderly(params)
      } catch (tenderlyErr) {
        console.error('Tenderly fallback also failed:', tenderlyErr)
      }
    }

    return {
      success: false,
      revertReason: err instanceof Error ? err.message : 'Unknown simulation error',
      simulatedAt: new Date(),
    }
  }
}

async function simulateWithTenderly(params: {
  chain: ChainId, to: string, from: string, data: string, value: string
}): Promise<SimulationResult> {
  const key = process.env.TENDERLY_ACCESS_KEY
  const account = process.env.TENDERLY_ACCOUNT_SLUG
  const project = process.env.TENDERLY_PROJECT_SLUG
  if (!key || !account || !project) throw new Error('Tenderly not configured')

  const CHAIN_ID_MAP: Partial<Record<ChainId, number>> = {
    ethereum: 1, arbitrum: 42161, base: 8453
  }
  const networkId = CHAIN_ID_MAP[params.chain]
  if (!networkId) throw new Error(`Tenderly does not support chain: ${params.chain}`)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const res = await fetch(
      `https://api.tenderly.co/api/v1/account/${account}/project/${project}/simulate`,
      {
        method: 'POST',
        headers: { 'X-Access-Key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          network_id: networkId.toString(),
          from: params.from,
          to: params.to,
          input: params.data,
          value: params.value,
          save: false,
        }),
        signal: controller.signal
      }
    )
    const json = await res.json()
    if (!json.transaction?.status) {
      return { 
        success: false, 
        revertReason: json.transaction?.error_message || 'Tenderly simulation failed', 
        simulatedAt: new Date() 
      }
    }
    return { 
      success: true, 
      gasEstimate: BigInt(json.transaction.gas_used || 0), 
      stateChanges: [], 
      simulatedAt: new Date() 
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

async function simulateSolanaTransaction(params: {
  to: string
  from: string
  data: string // tx in base64
}): Promise<SimulationResult> {
  try {
    const connection = getSolanaConnection()
    const tx = VersionedTransaction.deserialize(Buffer.from(params.data, 'base64'))
    const result = await connection.simulateTransaction(tx)

    return {
      success: !result.value.err,
      revertReason: result.value.err ? JSON.stringify(result.value.err) : undefined,
      simulatedAt: new Date(),
    }
  } catch (err) {
    return {
      success: false,
      revertReason: err instanceof Error ? err.message : 'Solana simulation failed',
      simulatedAt: new Date(),
    }
  }
}
