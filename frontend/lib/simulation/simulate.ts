import 'server-only'
import { parseAbi, parseUnits, formatUnits } from 'viem'
import { ChainId, ProtocolId } from '@/types/shared'
import { PROTOCOL_REGISTRY } from '@/lib/plugins/protocols'
import { SUPPORTED_TOKENS } from '@/constants/tokens'
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

// Dummy address for gas estimation routines where the user is unconnected.
const DUMMY_ADDRESS = '0x0000000000000000000000000000000000000001'

// Minimal ERC20 ABI for proxying simulation operations
const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)'
])

/**
 * Estimates the gas required to bridge an asset out of the source chain.
 */
export async function estimateBridgeGas(sourceChain: ChainId, asset: string): Promise<number> {
  try {
    const client = getPublicClient(sourceChain)
    const tokenConfig = SUPPORTED_TOKENS[asset]
    if (!tokenConfig || !tokenConfig.addresses[sourceChain]) {
      return 65_000 // default fallback
    }

    const tokenAddress = tokenConfig.addresses[sourceChain]

    // Estimate an approve to approximate the bridge initiation footprint
    const approveGas = await client.estimateContractGas({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [DUMMY_ADDRESS, parseUnits('1000', tokenConfig.decimals)],
      account: DUMMY_ADDRESS,
    })

    // Bridge usually involves an approve + an event emission on the SpokePool
    const totalGas = Number(approveGas) + 40_000
    return totalGas
  } catch {
    console.warn(`Bridge gas simulation failed for ${sourceChain} ${asset}, using fallback`)
    return 65_000
  }
}

/**
 * Estimates the gas required to deposit into a protocol on the destination chain.
 */
export async function estimateDepositGas(destChain: ChainId, protocol: ProtocolId, asset: string): Promise<number> {
  try {
    const client = getPublicClient(destChain)
    const tokenConfig = SUPPORTED_TOKENS[asset]
    const protocolConfig = PROTOCOL_REGISTRY[protocol]
    
    if (!tokenConfig || !tokenConfig.addresses[destChain] || !protocolConfig || !protocolConfig.addresses[destChain]?.poolAddress) {
      return 250_000 // default fallback
    }

    const tokenAddress = tokenConfig.addresses[destChain]
    const poolAddress = protocolConfig.addresses[destChain]?.poolAddress

    // Estimate an approve against the destination pool.
    // Further granular deposit estimation (e.g. `supply` in Aave V3) is deferred to Milestone 3 SDK integration.
    const approveGas = await client.estimateContractGas({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [poolAddress as `0x${string}`, parseUnits('1000', tokenConfig.decimals)],
      account: DUMMY_ADDRESS,
    })

    const standardDepositBuffer = 200_000 
    
    return Number(approveGas) + standardDepositBuffer
  } catch {
    console.warn(`Deposit gas simulation failed for ${protocol} on ${destChain}, using fallback`)
    return 250_000
  }
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
