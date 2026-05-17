import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSequencePlan, updateSequencePlanStep } from '@/lib/data/sequencePlans'
import { simulateTransaction } from '@/lib/simulation/simulate'
import { applyStepUpdate, computePlanStatus, serializeSequenceStep } from '@/lib/sequencer/engine'
import { getNativeAssetPrice } from '@/lib/data/prices'
import { createPublicClient, http, PublicClient } from 'viem'
import { mainnet, arbitrum, base } from 'viem/chains'
import { getRpcUrl } from '@/lib/server/rpc'
import { ChainId, TxBuildParams, BridgeQuoteParams } from '@/types/shared'
import { PROTOCOL_REGISTRY } from '@/lib/plugins/protocols'
import { BRIDGE_REGISTRY } from '@/lib/plugins/bridges'

const SimulateStepSchema = z.object({
  planId: z.string().uuid(),
  stepId: z.string(),
  walletAddress: z.string()
})

const getClient = (chain: ChainId): PublicClient => {
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
    transport: http(rpcUrl, { timeout: 10000 }),
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const result = SimulateStepSchema.safeParse(body)
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { planId, stepId, walletAddress } = result.data

    const plan = await getSequencePlan(planId)
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Auth check
    if (plan.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const step = plan.steps.find(s => s.id === stepId)
    if (!step) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 })
    }

    if (!step.unsignedTx) {
      if (PROTOCOL_REGISTRY[step.pluginId as keyof typeof PROTOCOL_REGISTRY]) {
        const plugin = PROTOCOL_REGISTRY[step.pluginId as keyof typeof PROTOCOL_REGISTRY]
        const txs = await plugin.builder.buildTx(step.buildParams as TxBuildParams)
        if (txs && txs.length > 0) {
          step.unsignedTx = txs[0]
        }
      } else if (BRIDGE_REGISTRY[step.pluginId as keyof typeof BRIDGE_REGISTRY]) {
        const plugin = BRIDGE_REGISTRY[step.pluginId as keyof typeof BRIDGE_REGISTRY]
        const quote = await plugin.getQuote(step.buildParams as BridgeQuoteParams)
        if (quote) {
          step.unsignedTx = await plugin.buildBridgeTx(quote)
        }
      }

      if (!step.unsignedTx) {
        return NextResponse.json({ error: 'Step has no transaction to simulate and failed to build one' }, { status: 400 })
      }
    }

    // Detect stub data (Issue 7)
    if (step.unsignedTx.data === '0x' && step.unsignedTx.value === 0n && step.pluginId === 'pendle') {
      return NextResponse.json({ 
        error: 'Transaction builder returned stub data — this template is not ready for execution' 
      }, { status: 400 })
    }

    // Perform simulation
    const simResult = await simulateTransaction({
      chain: step.chain,
      to: step.unsignedTx.to,
      from: plan.walletAddress,
      data: step.unsignedTx.data,
      value: step.unsignedTx.value.toString(),
    })

    let gasCostUsd = 0
    if (simResult.success && simResult.gasEstimate && step.chain !== 'solana') {
      try {
        const client = getClient(step.chain)
        
        // Timeout for price fetch
        const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
          return Promise.race([
            promise,
            new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
          ]);
        };

        const [gasPrice, nativePrice] = await Promise.all([
          client.getGasPrice(),
          withTimeout(getNativeAssetPrice(step.chain), 5000)
        ])
        
        const costNative = simResult.gasEstimate * gasPrice
        // For EVM chains, native asset has 18 decimals
        gasCostUsd = Number(costNative) * nativePrice / 1e18
      } catch (e) {
        console.error('Failed to calculate gas cost in USD:', e)
      }
    }

    const newStatus: 'ready' | 'failed' = simResult.success ? 'ready' : 'failed'
    
    const updateData = {
      status: newStatus,
      simulation: {
        success: simResult.success,
        revertReason: simResult.error,
        gasEstimate: simResult.gasEstimate,
        gasCostUsd: gasCostUsd,
        simulatedAt: simResult.simulatedAt || new Date()
      }
    }

    const updatedPlan = applyStepUpdate(plan, stepId, updateData)
    const newPlanStatus = computePlanStatus(updatedPlan)

    const success = await updateSequencePlanStep(planId, stepId, updatedPlan.steps, newPlanStatus)
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to save simulation result to database' }, { status: 500 })
    }

    const returnStep = updatedPlan.steps.find(s => s.id === stepId)
    
    if (!returnStep) {
      return NextResponse.json({ error: 'Updated step not found' }, { status: 500 })
    }

    return NextResponse.json({ 
      simulation: {
        ...updateData.simulation,
        gasEstimate: updateData.simulation.gasEstimate ? updateData.simulation.gasEstimate.toString() : undefined
      },
      updatedStep: serializeSequenceStep(returnStep)
    })
  } catch (error) {
    console.error('Error in /api/sequencer/simulate:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
