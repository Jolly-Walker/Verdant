import 'server-only'
import { CostPreviewInput, CostPreviewResult, StepCost, DeleverageBreakEvenInfo } from '@/types/quote'
import { SequencePlan, SequenceStep } from '@/types/sequencer'
import { BridgeQuoteParams } from '@/types/shared'
import { findPoolApy } from '@/lib/data/defillama'
import { getEthPrice } from '@/lib/data/prices'
import { detectWarnings } from '@/lib/utils/warnings'
import { fetchGasPrice } from '@/lib/server/rpc'
import { CHAIN_REGISTRY } from '@/lib/plugins/chains'
import { BRIDGE_REGISTRY } from '@/lib/plugins/bridges'

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
 * Determines if a step uses a bridge plugin.
 */
function isBridgeStep(step: SequenceStep): boolean {
  return Object.keys(BRIDGE_REGISTRY).includes(step.pluginId)
}

/**
 * Fetches real bridge fee + slippage from the bridge plugin for a given step.
 * Falls back to conservative estimates if the quote fails.
 */
async function getBridgeStepCosts(
  step: SequenceStep,
  amountUsd: number
): Promise<{ bridgeFeeUsd: number; slippageUsd: number; quoteExpiresAt?: string }> {
  const bridgePlugin = BRIDGE_REGISTRY[step.pluginId as keyof typeof BRIDGE_REGISTRY]
  if (!bridgePlugin) return { bridgeFeeUsd: 0, slippageUsd: 0 }

  try {
    const quote = await bridgePlugin.getQuote(step.buildParams as BridgeQuoteParams)
    if (quote) {
      return {
        bridgeFeeUsd: quote.feeUsd,
        slippageUsd: amountUsd * (quote.slippagePercent / 100),
        quoteExpiresAt: quote.expiresAt instanceof Date
          ? quote.expiresAt.toISOString()
          : new Date(quote.expiresAt).toISOString(),
      }
    }
  } catch (err) {
    console.warn(`Bridge quote failed for step ${step.id}:`, err)
  }

  // Fallback conservative estimate
  const buildParams = step.buildParams
  const asset = 'token' in buildParams
    ? (buildParams as BridgeQuoteParams).token
    : ('asset' in buildParams ? (buildParams as { asset: string }).asset : 'USDC')
  const isStable = ['USDC', 'USDT'].includes(asset.toUpperCase())
  return {
    bridgeFeeUsd: amountUsd * (isStable ? 0.0006 : 0.0012),
    slippageUsd: amountUsd * (isStable ? 0.001 : 0.003),
  }
}

/**
 * Compute Aave de-leverage break-even info.
 *
 * When unwinding a recursive Aave loop:
 * - The user stops paying borrow interest on the unwound debt portion
 * - The user also loses the supply APY on the unwound collateral portion
 * Net annual uplift = (debtUnwoundUsd * borrowApy) - (collateralUnwoundUsd * supplyApy)
 */
function computeDeleverageBreakEven(params: {
  totalCostUsd: number
  debtUnwoundUsd: number
  collateralUnwoundUsd: number
  borrowApy: number   // as decimal, e.g. 0.045 = 4.5%
  supplyApy: number   // as decimal, e.g. 0.02 = 2%
}): DeleverageBreakEvenInfo {
  const annualInterestSavingsUsd = params.debtUnwoundUsd * params.borrowApy
  const annualCollateralCostUsd = params.collateralUnwoundUsd * params.supplyApy
  const netAnnualUpliftUsd = annualInterestSavingsUsd - annualCollateralCostUsd

  const breakEvenDays = netAnnualUpliftUsd > 0
    ? (params.totalCostUsd / netAnnualUpliftUsd) * 365
    : Infinity

  return {
    annualInterestSavingsUsd,
    annualCollateralCostUsd,
    netAnnualUpliftUsd,
    breakEvenDays,
  }
}

export interface SequencePlanCostInput {
  plan: SequencePlan
  currentApy?: number
  targetApy?: number
  // De-leverage specific APY info
  borrowApy?: number
  supplyApy?: number
  totalCollateralUsd?: number
}

/**
 * Core cost preview calculation engine.
 *
 * Supports both legacy Phase 1 simple inputs and N-step SequencePlans.
 * For SequencePlans:
 *  - Gas: estimated via chain plugin's estimateGasCostUsd()
 *  - Bridge fees: fetched from real BridgeQuote via bridge plugin
 *  - Slippage: derived from BridgeQuote.slippagePercent
 *  - Subtotals: totalGasUsd, totalBridgeFeeUsd, totalSlippageUsd
 *  - De-leverage break-even: computed from borrowApy/supplyApy when present
 */
export async function calculateCostPreview(
  input: CostPreviewInput | SequencePlanCostInput
): Promise<CostPreviewResult> {
  const ethPrice = await getEthPrice()
  const steps: StepCost[] = []
  let totalCostUsd = 0
  let totalGasUsd = 0
  let totalBridgeFeeUsd = 0
  let totalSlippageUsd = 0

  if ('plan' in input) {
    // ── N-step SequencePlan path ──────────────────────────────────────────────
    const plan = input.plan

    // Estimate overall position size for proportional bridge fee fallback
    const amountUsd = plan.positionSizeUsd ?? (plan.totalCostUsd > 0 ? plan.totalCostUsd : 10_000)

    for (const step of plan.steps) {
      const chainPlugin = CHAIN_REGISTRY[step.chain]
      const gasCostUsd = await chainPlugin.estimateGasCostUsd(step.unsignedTx || {})
      totalGasUsd += gasCostUsd

      let bridgeFeeUsd = 0
      let slippageUsd = 0
      let quoteExpiresAt: string | undefined

      if (isBridgeStep(step)) {
        const bridgeCosts = await getBridgeStepCosts(step, amountUsd)
        bridgeFeeUsd = bridgeCosts.bridgeFeeUsd
        slippageUsd = bridgeCosts.slippageUsd
        quoteExpiresAt = bridgeCosts.quoteExpiresAt
        totalBridgeFeeUsd += bridgeFeeUsd
        totalSlippageUsd += slippageUsd
      }

      const stepTotal = gasCostUsd + bridgeFeeUsd + slippageUsd
      totalCostUsd += stepTotal

      steps.push({
        stepLabel: step.label,
        chain: step.chain,
        gasCostUsd,
        bridgeFeeUsd: bridgeFeeUsd > 0 ? bridgeFeeUsd : undefined,
        slippageUsd: slippageUsd > 0 ? slippageUsd : undefined,
        quoteExpiresAt,
      })
    }

    const currentApyDecimal = input.currentApy ?? 0
    const targetApyDecimal = input.targetApy ?? 0
    const netUpliftDecimal = targetApyDecimal - currentApyDecimal
    const dailyYieldGainUsd = (netUpliftDecimal * amountUsd) / 365
    const breakEvenDays = dailyYieldGainUsd > 0
      ? totalCostUsd / dailyYieldGainUsd
      : dailyYieldGainUsd === 0 ? Infinity : -1

    // De-leverage break-even calculation
    let deleverageBreakEven: DeleverageBreakEvenInfo | undefined
    if (
      input.borrowApy !== undefined &&
      input.supplyApy !== undefined &&
      plan.templateId === 'deleverageAave'
    ) {
      deleverageBreakEven = computeDeleverageBreakEven({
        totalCostUsd,
        debtUnwoundUsd: amountUsd,
        collateralUnwoundUsd: input.totalCollateralUsd ?? amountUsd * 1.3,
        borrowApy: input.borrowApy,
        supplyApy: input.supplyApy,
      })
    }

    const warnings = detectWarnings(
      {
        steps,
        totalCostUsd,
        dailyYieldGainUsd,
        breakEvenDays,
        currentApyDecimal,
        targetApyDecimal,
      },
      amountUsd
    )

    return {
      steps,
      totalCostUsd,
      totalGasUsd,
      totalBridgeFeeUsd,
      totalSlippageUsd,
      currentApyDecimal,
      targetApyDecimal,
      netUpliftDecimal,
      dailyYieldGainUsd,
      breakEvenDays,
      targetUtilisationDecimal: null,
      quoteFetchedAt: new Date(),
      warnings,
      deleverageBreakEven,
    }
  } else {
    // ── Legacy CostPreviewInput path (bridge + deposit) ────────────────────────
    const [sourceGasPrice, destGasPrice] = await Promise.all([
      fetchGasPrice(input.sourceChain),
      fetchGasPrice(input.destChain),
    ])

    const { estimateBridgeGas, estimateDepositGas } = await import('@/lib/simulation/simulate')
    const [bridgeGasUnits, depositGasUnits] = await Promise.all([
      estimateBridgeGas(input.sourceChain, input.asset),
      estimateDepositGas(input.destChain, input.destProtocol, input.asset),
    ])

    const gasStep1Usd = calculateGasCostUsd(bridgeGasUnits, sourceGasPrice, ethPrice)
    const gasStep2Usd = calculateGasCostUsd(depositGasUnits, destGasPrice, ethPrice)
    totalGasUsd = gasStep1Usd + gasStep2Usd

    const isStable = ['USDC', 'USDT'].includes(input.asset.toUpperCase())
    const bridgeFeeUsd = input.sourceChain === input.destChain
      ? 0
      : input.amountUsd * (isStable ? 0.0006 : 0.0012)
    const slippageUsd = input.amountUsd * (
      input.sourceChain === input.destChain ? 0.0005 : (isStable ? 0.001 : 0.003)
    )
    totalBridgeFeeUsd = bridgeFeeUsd
    totalSlippageUsd = slippageUsd

    steps.push({
      stepLabel: `Bridge ${input.asset}`,
      chain: input.sourceChain,
      gasCostUsd: gasStep1Usd,
      bridgeFeeUsd: bridgeFeeUsd > 0 ? bridgeFeeUsd : undefined,
      slippageUsd: slippageUsd > 0 ? slippageUsd : undefined,
    })

    steps.push({
      stepLabel: `Deposit into ${input.destProtocol}`,
      chain: input.destChain,
      gasCostUsd: gasStep2Usd,
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
    const breakEvenDays = dailyYieldGainUsd > 0
      ? totalCostUsd / dailyYieldGainUsd
      : dailyYieldGainUsd === 0 ? Infinity : -1

    const warnings = detectWarnings(
      {
        steps,
        totalCostUsd,
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
      totalGasUsd,
      totalBridgeFeeUsd,
      totalSlippageUsd,
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
