import { Warning, CostPreviewResult } from '@/types/quote'
import { DEFAULT_MIN_USD_THRESHOLD } from '@/constants/settings'

/**
 * Detect warning conditions per SPECS.md §5.
 * Returns an array of warnings that should be displayed as yellow banners.
 */
export function detectWarnings(
  result: Partial<CostPreviewResult>,
  amountUsd: number,
  pendleMaturityMs?: number
): Warning[] {
  const warnings: Warning[] = []

  // Bridge fee > 0.5% of transaction value
  if (
    result.bridgeFeeUsd !== undefined &&
    amountUsd > 0 &&
    result.bridgeFeeUsd / amountUsd > 0.005
  ) {
    warnings.push({
      type: 'high_bridge_fee',
      message: 'High bridge fee relative to transaction size',
    })
  }

  // Slippage > 0.5%
  if (
    result.slippageUsd !== undefined &&
    amountUsd > 0 &&
    result.slippageUsd / amountUsd > 0.005
  ) {
    warnings.push({
      type: 'high_slippage',
      message:
        'Significant slippage expected — consider splitting into smaller transactions',
    })
  }

  // Break-even > 30 days
  if (
    result.breakEvenDays !== undefined &&
    isFinite(result.breakEvenDays) &&
    result.breakEvenDays > 30
  ) {
    warnings.push({
      type: 'long_breakeven',
      message:
        'Long break-even period — only worthwhile for long-term positions',
    })
  }

  // Pendle maturity < 30 days away
  if (pendleMaturityMs !== undefined) {
    const daysToMaturity = Math.ceil(
      (pendleMaturityMs - Date.now()) / (24 * 60 * 60 * 1000)
    )
    if (daysToMaturity < 30 && daysToMaturity > 0) {
      warnings.push({
        type: 'pendle_maturity',
        message: `This Pendle position matures in ${daysToMaturity} days`,
      })
    }
  }

  // Amount below minimum
  if (amountUsd > 0 && amountUsd < DEFAULT_MIN_USD_THRESHOLD) {
    warnings.push({
      type: 'below_minimum',
      message: `Minimum transaction is $${DEFAULT_MIN_USD_THRESHOLD.toLocaleString()} to cover fees`,
    })
  }

  // Negative yield uplift (moving to lower APY)
  if (
    result.netUpliftDecimal !== undefined &&
    result.netUpliftDecimal < 0
  ) {
    warnings.push({
      type: 'negative_uplift',
      message: 'Target APY is lower than current APY — you would earn less after moving',
    })
  }

  // Target protocol utilisation > 90%
  if (
    result.targetUtilisationDecimal !== undefined &&
    result.targetUtilisationDecimal !== null &&
    result.targetUtilisationDecimal > 0.90
  ) {
    warnings.push({
      type: 'high_utilisation',
      message: 'High utilisation — APY may compress after your deposit',
    })
  }

  return warnings
}
