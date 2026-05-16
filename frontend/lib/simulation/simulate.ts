import 'server-only'
import { createPublicClient, http, parseAbi, parseUnits } from 'viem'
import { mainnet, arbitrum, base } from 'viem/chains'
import { Chain } from '@/types/chain'
import { Protocol } from '@/types/protocol'
import { getRpcUrl } from '@/lib/server/rpc'
import { PROTOCOL_REGISTRY } from '@/lib/plugins/protocols'
import { SUPPORTED_TOKENS } from '@/lib/plugins/tokens'

// Dummy address for gas estimation routines where the user is unconnected.
const DUMMY_ADDRESS = '0x0000000000000000000000000000000000000001'

const getClient = (chain: Chain) => {
  const rpcUrl = getRpcUrl(chain)
  let viemChain
  switch (chain) {
    case 'ethereum':
      viemChain = mainnet
      break
    case 'arbitrum':
      viemChain = arbitrum
      break
    case 'base':
      viemChain = base
      break
    default:
      viemChain = mainnet
  }
  return createPublicClient({
    chain: viemChain,
    transport: http(rpcUrl),
  })
}

// Minimal ERC20 ABI for proxying simulation operations
const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)'
])

/**
 * Estimates the gas required to bridge an asset out of the source chain.
 */
export async function estimateBridgeGas(sourceChain: Chain, asset: string): Promise<number> {
  try {
    const client = getClient(sourceChain)
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
export async function estimateDepositGas(destChain: Chain, protocol: Protocol, asset: string): Promise<number> {
  try {
    const client = getClient(destChain)
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
 * Performs a full simulation of a transaction.
 */
export async function simulateTransaction(params: {
  chain: Chain
  to: string
  from: string
  data: string
  value: string
}) {
  const client = getClient(params.chain)
  
  try {
    const gas = await client.estimateGas({
      account: params.from as `0x${string}`,
      to: params.to as `0x${string}`,
      data: params.data as `0x${string}`,
      value: BigInt(params.value),
    })

    return {
      success: true,
      gasEstimate: gas,
      simulatedAt: new Date(),
    }
  } catch (err) {
    console.error('Simulation error details:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown simulation error',
      simulatedAt: new Date(),
    }
  }
}
