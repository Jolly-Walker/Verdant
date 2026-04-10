import 'server-only'
import { CostPreviewInput, CostPreviewResult } from '@/types/quote'
import { findPoolApy } from '@/lib/data/defillama'
import { getEthPrice } from '@/lib/data/prices'
import { detectWarnings } from '@/lib/utils/warnings'
import { fetchGasPrice } from '@/lib/server/rpc'
import { estimateBridgeGas, estimateDepositGas } from '@/lib/simulation/simulate'

/**
 * Average gas prices in Gwei per chain.
 * Used as fallbacks when on-chain gas estimation is not available.
 * These are now handled within lib/server/rpc.ts which is called by the calculator.
 */

/**
 * Conservative fee estimates for Phase 1.
 * These will be replaced with real Across API and NEAR Intents quotes in Milestone 2.
 */
function estimateBridgeFee(amountUsd: number, asset: string): number {
  // Stablecoins have lower bridge fees (~0.06%)
  // Volatile assets ~0.12%
  const isStable = ['USDC', 'USDT'].includes(asset.toUpperCase())
  const rate = isStable ? 0.0006 : 0.0012
  return amountUsd * rate
}

function estimateSlippage(
  amountUsd: number,
  sourceChain: string,
  destChain: string,
  asset: string
): number {
  // Same-chain: minimal slippage
  if (sourceChain === destChain) {
    return amountUsd * 0.0005 // 0.05%
  }
  // Cross-chain: slightly higher
  const isStable = ['USDC', 'USDT'].includes(asset.toUpperCase())
  const rate = isStable ? 0.001 : 0.003
  return amountUsd * rate
}

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
 * Core cost preview calculation engine.
 *
 * For Phase 1, bridge fees and slippage use conservative percentage estimates.
 * Gas costs are calculated from estimated gas units × average gas price × ETH price.
 * APYs are fetched live from Defillama.
 *
 * All figures are in USD.
 */
export async function calculateCostPreview(
  input: CostPreviewInput
): Promise<CostPreviewResult> {
  // Fetch ETH price, live gas prices, and live gas unit simulations concurrently
  const [ethPrice, sourceGasPrice, destGasPrice, bridgeGasUnits, depositGasUnits] = await Promise.all([
    getEthPrice(),
    fetchGasPrice(input.sourceChain),
    fetchGasPrice(input.destChain),
    estimateBridgeGas(input.sourceChain, input.asset),
    estimateDepositGas(input.destChain, input.destProtocol, input.asset),
  ])

  // 1. Bridge fee estimate
  const bridgeFeeUsd =
    input.sourceChain === input.destChain
      ? 0
      : estimateBridgeFee(input.amountUsd, input.asset)

  // 2. Slippage estimate
  const slippageUsd = estimateSlippage(
    input.amountUsd,
    input.sourceChain,
    input.destChain,
    input.asset
  )

  // 3. Gas cost estimates (using live gas units simulated via Viem and gas prices fetched from Alchemy RPC)
  const gasStep1Usd = calculateGasCostUsd(
    bridgeGasUnits,
    sourceGasPrice,
    ethPrice
  )
  const gasStep2Usd = calculateGasCostUsd(
    depositGasUnits,
    destGasPrice,
    ethPrice
  )

  // 4. Total switching cost
  const totalSwitchingCostUsd =
    bridgeFeeUsd + slippageUsd + gasStep1Usd + gasStep2Usd

  // 5. Fetch APYs from Defillama
  // @phase1 architecture note: Defillama is the mandated source for Phase 1. 
  // Protocol-specific SDKs (@aave/contract-helpers, @morpho-org/morpho-ts, Pendle SDK)
  // are explicitly deferred to Milestones 2-3 per SPECS.md and AGENTS.md.
  const [currentApyResult, targetApyResult] = await Promise.all([
    findPoolApy(input.sourceProtocol, input.sourceChain, input.asset).catch(
      () => null
    ),
    findPoolApy(input.destProtocol, input.destChain, input.asset).catch(
      () => null
    ),
  ])

  const currentApyDecimal = currentApyResult?.apy ?? 0
  const targetApyDecimal = targetApyResult?.apy ?? 0
  const targetUtilisationDecimal = targetApyResult?.utilisationDecimal ?? null

  // 6. Yield calculations
  const netUpliftDecimal = targetApyDecimal - currentApyDecimal
  const dailyYieldGainUsd = (netUpliftDecimal * input.amountUsd) / 365

  // 7. Break-even calculation
  const breakEvenDays =
    dailyYieldGainUsd > 0
      ? totalSwitchingCostUsd / dailyYieldGainUsd
      : dailyYieldGainUsd === 0
        ? Infinity
        : -1 // Negative means worse APY — never breaks even

  // 8. Build partial result for warning detection
  const partialResult: Partial<CostPreviewResult> = {
    bridgeFeeUsd,
    slippageUsd,
    gasStep1Usd,
    gasStep2Usd,
    totalSwitchingCostUsd,
    currentApyDecimal,
    targetApyDecimal,
    targetUtilisationDecimal,
    netUpliftDecimal,
    dailyYieldGainUsd,
    breakEvenDays,
  }

  // 9. Detect warnings (threading pendle maturity through)
  // Note: For Phase 1, pendleMaturityMs is passed from the dashboard position state
  // into CostPreviewInput. In Milestone 3 this will be requested live from the Pendle SDK.
  const warnings = detectWarnings(
    partialResult,
    input.amountUsd,
    input.pendleMaturityMs
  )

  return {
    bridgeFeeUsd,
    slippageUsd,
    gasStep1Usd,
    gasStep2Usd,
    totalSwitchingCostUsd,
    currentApyDecimal,
    targetApyDecimal,
    targetUtilisationDecimal,
    netUpliftDecimal,
    dailyYieldGainUsd,
    breakEvenDays,
    quoteFetchedAt: new Date(),
    warnings,
  }
}
