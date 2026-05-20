import 'server-only'
import { CostPreviewInput, CostPreviewResult, StepCost } from '@/types/quote'
import { SequencePlan, SequenceStep } from '@/types/sequencer'
import { findPoolApy } from '@/lib/data/defillama'
import { getEthPrice, fetchTokenPrices } from '@/lib/data/prices'
import { detectWarnings } from '@/lib/utils/warnings'
import { fetchGasPrice } from '@/lib/server/rpc'
import { CHAIN_REGISTRY } from '@/lib/plugins/chains'
import { BRIDGE_REGISTRY } from '@/lib/plugins/bridges'
import { SUPPORTED_TOKENS } from '@/constants/tokens'

/**
 * Calculate gas cost in USD for a given number of gas units on a chain.
 */
function calculateGasCostUsd(
  gasUnits: number,
  gasPriceGwei: number,
  ethPriceUsd: number
): number {
  const gasPriceEth = gasPriceGwei * 1e-9
  const gasCostEth = gasUnits * gasPriceEth
  return gasCostEth * ethPriceUsd
}

/**
 * Estimates bridge fee in USD.
 * In Milestone 10, this should ideally pull from real BridgeQuotes.
 */
async function getBridgeFee(step: SequenceStep, amountUsd: number): Promise<number> {
  // If the step already has a bridge quote (not yet implemented in builder but planned), use it.
  // For now, fall back to conservative estimates or query the bridge plugin.
  const isBridge = Object.keys(BRIDGE_REGISTRY).includes(step.pluginId)
  if (!isBridge) return 0

  const bridgePlugin = BRIDGE_REGISTRY[step.pluginId as keyof typeof BRIDGE_REGISTRY]
  if (!bridgePlugin) return 0

  // Fallback estimate for now
  const asset = (step.buildParams as any).token || 'USDC'
  const isStable = ['USDC', 'USDT'].includes(asset.toUpperCase())
  const rate = isStable ? 0.0006 : 0.0012
  return amountUsd * rate
}

/**
 * Core cost preview calculation engine.
 * 
 * Supports both legacy Phase 1 simple inputs and N-step SequencePlans.
 */
export async function calculateCostPreview(
  input: CostPreviewInput | { plan: SequencePlan; currentApy?: number; targetApy?: number }
): Promise<CostPreviewResult> {
  const ethPrice = await getEthPrice()
  const steps: StepCost[] = []
  let totalCostUsd = 0

  if ('plan' in input) {
    // N-step SequencePlan logic
    const plan = input.plan
    const amountUsd = plan.totalCostUsd || 0 // Use plan's value or some other heuristic

    for (const step of plan.steps) {
      const chainPlugin = CHAIN_REGISTRY[step.chain]
      const gasCostUsd = await chainPlugin.estimateGasCostUsd(step.unsignedTx || {})
      
      let bridgeFeeUsd = 0
      if (Object.keys(BRIDGE_REGISTRY).includes(step.pluginId)) {
        bridgeFeeUsd = await getBridgeFee(step, amountUsd)
      }

      steps.push({
        stepLabel: step.label,
        chain: step.chain,
        gasCostUsd,
        bridgeFeeUsd: bridgeFeeUsd > 0 ? bridgeFeeUsd : undefined,
        // Slippage is hard to estimate without a real quote, using 0 for now in multi-step
      })

      totalCostUsd += gasCostUsd + bridgeFeeUsd
    }

    const currentApyDecimal = input.currentApy ?? 0
    const targetApyDecimal = input.targetApy ?? 0
    const netUpliftDecimal = targetApyDecimal - currentApyDecimal
    const dailyYieldGainUsd = (netUpliftDecimal * amountUsd) / 365
    const breakEvenDays = dailyYieldGainUsd > 0 ? totalCostUsd / dailyYieldGainUsd : dailyYieldGainUsd === 0 ? Infinity : -1

    return {
      steps,
      totalCostUsd,
      currentApyDecimal,
      targetApyDecimal,
      netUpliftDecimal,
      dailyYieldGainUsd,
      breakEvenDays,
      targetUtilisationDecimal: null,
      quoteFetchedAt: new Date(),
      warnings: [], // Warnings should be added here
    }
  } else {
    // Legacy CostPreviewInput logic (synthesize 2 steps)
    const [sourceGasPrice, destGasPrice] = await Promise.all([
      fetchGasPrice(input.sourceChain),
      fetchGasPrice(input.destChain),
    ])

    // For legacy, we still use the hardcoded gas unit estimates in simulate.ts for now
    // until we refactor them into the plugins properly.
    const { estimateBridgeGas, estimateDepositGas } = await import('@/lib/simulation/simulate')
    const [bridgeGasUnits, depositGasUnits] = await Promise.all([
      estimateBridgeGas(input.sourceChain, input.asset),
      estimateDepositGas(input.destChain, input.destProtocol, input.asset),
    ])

    const gasStep1Usd = calculateGasCostUsd(bridgeGasUnits, sourceGasPrice, ethPrice)
    const gasStep2Usd = calculateGasCostUsd(depositGasUnits, destGasPrice, ethPrice)

    const isStable = ['USDC', 'USDT'].includes(input.asset.toUpperCase())
    const bridgeFeeUsd = input.sourceChain === input.destChain ? 0 : input.amountUsd * (isStable ? 0.0006 : 0.0012)
    const slippageUsd = input.amountUsd * (input.sourceChain === input.destChain ? 0.0005 : (isStable ? 0.001 : 0.003))

    steps.push({
      stepLabel: `Bridge ${input.asset}`,
      chain: input.sourceChain,
      gasCostUsd: gasStep1Usd,
      bridgeFeeUsd: bridgeFeeUsd > 0 ? bridgeFeeUsd : undefined,
      slippageUsd: slippageUsd > 0 ? slippageUsd : undefined
    })

    steps.push({
      stepLabel: `Deposit into ${input.destProtocol}`,
      chain: input.destChain,
      gasCostUsd: gasStep2Usd
    })

    totalCostUsd = gasStep1Usd + gasStep2Usd + bridgeFeeUsd + slippageUsd

    const [currentApyResult, targetApyResult] = await Promise.all([
      findPoolApy(input.sourceProtocol, input.sourceChain, input.asset).catch(() => null),
      findPoolApy(input.destProtocol, input.destChain, input.asset).catch(() => null),
    ])

    const currentApyDecimal = currentApyResult?.apy ?? 0
    const targetApyDecimal = targetApyResult?.apy ?? 0
    const netUpliftDecimal = targetApyDecimal - currentApyDecimal
    const dailyYieldGainUsd = (netUpliftDecimal * input.amountUsd) / 365
    const breakEvenDays = dailyYieldGainUsd > 0 ? totalCostUsd / dailyYieldGainUsd : dailyYieldGainUsd === 0 ? Infinity : -1

    const warnings = detectWarnings(
      {
        totalSwitchingCostUsd: totalCostUsd,
        dailyYieldGainUsd,
        breakEvenDays,
        currentApyDecimal,
        targetApyDecimal,
      },
      input.amountUsd,
      input.pendleMaturityMs
    )

    return {
      steps,
      totalCostUsd,
      currentApyDecimal,
      targetApyDecimal,
      netUpliftDecimal,
      dailyYieldGainUsd,
      breakEvenDays,
      targetUtilisationDecimal: targetApyResult?.utilisationDecimal ?? null,
      quoteFetchedAt: new Date(),
      warnings,
    }
  }
}
