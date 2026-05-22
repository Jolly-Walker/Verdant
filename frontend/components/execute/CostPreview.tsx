'use client'

import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatUsd, formatPercent } from '@/lib/utils/formatting'
import { Spinner } from '@/components/ui/Spinner'
import { CostPreviewInput, CostPreviewResult } from '@/types/quote'
import { useQuote } from '@/hooks/useQuote'

interface CostPreviewProps {
  input?: CostPreviewInput | null
  /** Optional: pre-fetched result (e.g. from useSequenceCost for a multi-step plan) */
  result?: CostPreviewResult | null
  isLoading?: boolean
  error?: string | null
  isStale?: boolean
  quoteAge?: number
  refetch?: () => void
  /** Step IDs whose bridge quotes are stale (show orange indicator) */
  staleStepIds?: Set<string>
  /** Step IDs whose bridge quotes have expired (show red indicator) */
  expiredStepIds?: Set<string>
  /** Labels for each step in the same order as result.steps, for staleness lookup */
  stepIds?: string[]
}

export function CostPreview({
  input = null,
  result: providedResult,
  isLoading: externalLoading,
  error: externalError,
  isStale: externalIsStale,
  quoteAge: externalQuoteAge,
  refetch: externalRefetch,
  staleStepIds,
  expiredStepIds,
  stepIds,
}: CostPreviewProps) {
  const {
    quote: fetchedQuote,
    isLoading: internalLoading,
    error: internalError,
    isStale: internalIsStale,
    quoteAge: internalQuoteAge,
    refetch: internalRefetch,
  } = useQuote(providedResult ? null : input) // skip internal fetch if result provided

  const result = providedResult || fetchedQuote
  const isLoading = externalLoading ?? internalLoading
  const error = externalError ?? internalError
  const isStale = externalIsStale ?? internalIsStale
  const quoteAge = externalQuoteAge ?? internalQuoteAge
  const refetch = externalRefetch ?? internalRefetch

  if (isLoading && !result) {
    return (
      <Card className="p-6 bg-verdant-surface border border-[#E5E0D8] flex flex-col items-center justify-center min-h-[400px] shadow-organic">
        <Spinner size="lg" />
        <p className="text-verdant-text-muted mt-4 animate-pulse">Calculating optimal route...</p>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6 bg-verdant-surface border border-verdant-loss/30 shadow-organic">
        <h2 className="text-xl font-semibold text-verdant-text-primary mb-4">Preview Failed</h2>
        <div className="bg-verdant-loss/10 border border-verdant-loss/20 rounded-lg p-4 mb-6">
          <p className="text-sm text-verdant-loss">{error}</p>
        </div>
        <button
          onClick={refetch}
          className="w-full py-2 bg-verdant-moss hover:bg-verdant-moss-dark text-white rounded-lg transition-colors font-semibold"
        >
          Retry Calculation
        </button>
      </Card>
    )
  }

  if (!result) {
    return (
      <Card className="p-6 bg-verdant-surface border border-[#E5E0D8] flex items-center justify-center min-h-[400px] shadow-organic">
        <p className="text-verdant-text-muted text-center max-w-[200px]">
          Select an asset and template to see cost & yield impact
        </p>
      </Card>
    )
  }

  const hasMultipleSteps = result.steps.length > 2
  const hasSubtotals = result.totalGasUsd !== undefined

  return (
    <Card className="p-6 bg-verdant-surface border border-[#E5E0D8] shadow-organic relative overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 bg-[#1A1614]/5 backdrop-blur-[1px] flex items-center justify-center z-10">
          <Spinner />
        </div>
      )}

      <div className="flex justify-between items-start mb-6">
        <h2 className="text-xl font-semibold text-verdant-text-primary">Cost & Yield Preview</h2>
        {isStale ? (
          <Badge variant="warning" className="cursor-pointer" onClick={refetch}>
            Stale ({quoteAge}s) • Refresh
          </Badge>
        ) : (
          <span className="text-[10px] text-verdant-text-muted uppercase tracking-widest font-bold">
            Updated {quoteAge}s ago
          </span>
        )}
      </div>

      <div className="space-y-8">
        {/* ── Itemized Step Costs ───────────────────────────────────────── */}
        <section>
          <h3 className="text-xs font-bold text-verdant-text-muted uppercase tracking-wider mb-4">
            Itemized Switching Costs
          </h3>
          <div className="space-y-3">
            {result.steps.map((step, i) => {
              const stepId = stepIds?.[i]
              const isStepStale = stepId ? staleStepIds?.has(stepId) : false
              const isStepExpired = stepId ? expiredStepIds?.has(stepId) : false
              const hasBridgeFee = step.bridgeFeeUsd != null && step.bridgeFeeUsd > 0

              return (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-sm items-start">
                    <div className="flex items-center gap-2">
                      <span className="text-verdant-text-primary font-medium">{step.stepLabel}</span>
                      {hasBridgeFee && isStepExpired && (
                        <span className="text-[10px] bg-verdant-loss/10 text-verdant-loss border border-verdant-loss/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                          Quote Expired
                        </span>
                      )}
                      {hasBridgeFee && isStepStale && !isStepExpired && (
                        <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200/50 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                          Stale Quote
                        </span>
                      )}
                    </div>
                    <span className="text-verdant-text-primary font-mono tabular-nums">
                      {formatUsd(step.gasCostUsd + (step.bridgeFeeUsd || 0) + (step.slippageUsd || 0))}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-verdant-text-muted">
                    <span className="bg-verdant-surface-accent border border-[#E5E0D8] px-1.5 rounded uppercase">{step.chain}</span>
                    <span>Gas: {formatUsd(step.gasCostUsd)}</span>
                    {step.bridgeFeeUsd != null && step.bridgeFeeUsd > 0 && (
                      <span>• Fee: {formatUsd(step.bridgeFeeUsd)}</span>
                    )}
                    {step.slippageUsd != null && step.slippageUsd > 0 && (
                      <span>• Slippage: {formatUsd(step.slippageUsd)}</span>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Subtotals — shown for multi-step plans */}
            {hasMultipleSteps && hasSubtotals && (
              <div className="mt-4 pt-4 border-t border-[#E5E0D8] space-y-2">
                {result.totalGasUsd > 0 && (
                  <div className="flex justify-between text-xs text-verdant-text-muted">
                    <span>Total Gas</span>
                    <span className="font-mono tabular-nums">{formatUsd(result.totalGasUsd)}</span>
                  </div>
                )}
                {result.totalBridgeFeeUsd > 0 && (
                  <div className="flex justify-between text-xs text-verdant-text-muted">
                    <span>Total Bridge Fees</span>
                    <span className="font-mono tabular-nums">{formatUsd(result.totalBridgeFeeUsd)}</span>
                  </div>
                )}
                {result.totalSlippageUsd > 0 && (
                  <div className="flex justify-between text-xs text-verdant-text-muted">
                    <span>Total Slippage</span>
                    <span className="font-mono tabular-nums">{formatUsd(result.totalSlippageUsd)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="pt-4 border-t border-[#E5E0D8] flex justify-between items-baseline">
              <span className="text-verdant-text-muted font-semibold uppercase text-xs">Total Cost</span>
              <span className="text-xl font-bold text-verdant-text-primary font-mono">{formatUsd(result.totalCostUsd)}</span>
            </div>
          </div>
        </section>

        {/* ── De-leverage Break-even ────────────────────────────────────── */}
        {result.deleverageBreakEven && (
          <section className="bg-verdant-surface-accent border border-verdant-moss/20 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-verdant-text-muted uppercase tracking-wider">De-leverage Savings</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-verdant-text-muted">Annual Interest Saved</span>
                <span className="text-verdant-profit font-medium tabular-nums font-mono">
                  +{formatUsd(result.deleverageBreakEven.annualInterestSavingsUsd)}/yr
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-verdant-text-muted">Collateral Yield Foregone</span>
                <span className="text-amber-600 font-medium tabular-nums font-mono">
                  -{formatUsd(result.deleverageBreakEven.annualCollateralCostUsd)}/yr
                </span>
              </div>
              <div className="pt-2 border-t border-[#E5E0D8] flex justify-between items-center">
                <span className="text-verdant-text-primary font-semibold text-sm">Net Annual Benefit</span>
                <span className={`font-bold tabular-nums font-mono ${result.deleverageBreakEven.netAnnualUpliftUsd > 0 ? 'text-verdant-profit' : 'text-verdant-loss'}`}>
                  {result.deleverageBreakEven.netAnnualUpliftUsd > 0 ? '+' : ''}
                  {formatUsd(result.deleverageBreakEven.netAnnualUpliftUsd)}/yr
                </span>
              </div>
            </div>
            {result.deleverageBreakEven.breakEvenDays !== Infinity && result.deleverageBreakEven.breakEvenDays > 0 && (
              <div className="flex justify-between items-center pt-1">
                <span className="text-xs text-verdant-text-muted">Break-even</span>
                <Badge
                  variant={result.deleverageBreakEven.breakEvenDays > 60 ? 'warning' : 'success'}
                  className="text-sm px-3 py-1"
                >
                  {Math.ceil(result.deleverageBreakEven.breakEvenDays)} days
                </Badge>
              </div>
            )}
          </section>
        )}

        {/* ── Yield Impact ─────────────────────────────────────────────── */}
        {(result.currentApyDecimal > 0 || result.targetApyDecimal > 0) && (
          <section>
            <h3 className="text-xs font-bold text-verdant-text-muted uppercase tracking-wider mb-4">Yield Impact</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-verdant-text-muted">Current APY</span>
                <span className="text-verdant-text-primary font-medium font-mono">{formatPercent(result.currentApyDecimal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-verdant-text-muted">Target APY</span>
                <span className="text-verdant-profit font-medium font-mono">{formatPercent(result.targetApyDecimal)}</span>
              </div>
              <div className="pt-3 border-t border-[#E5E0D8] flex justify-between items-center">
                <span className="text-verdant-text-primary font-semibold">Net Yield Uplift</span>
                <div className="text-right">
                  <div className="text-lg font-bold text-verdant-profit font-mono">
                    {result.netUpliftDecimal && result.netUpliftDecimal > 0 ? '+' : ''}
                    {formatPercent(result.netUpliftDecimal || 0)}
                  </div>
                  {result.dailyYieldGainUsd !== null && (
                    <div className="text-xs text-verdant-text-muted font-mono">
                      {result.dailyYieldGainUsd > 0 ? '+' : ''}
                      {formatUsd(result.dailyYieldGainUsd)} / day
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Standard Break-even ──────────────────────────────────────── */}
        {result.breakEvenDays !== null &&
          result.breakEvenDays > 0 &&
          result.breakEvenDays !== Infinity &&
          !result.deleverageBreakEven && (
          <section className="bg-verdant-surface-accent border border-verdant-moss/20 rounded-xl p-4">
            <div className="flex justify-between items-center">
              <div className="space-y-0.5">
                <span className="text-xs text-verdant-text-muted uppercase font-bold tracking-tight">Break-even Period</span>
                <p className="text-[11px] text-verdant-text-muted">Recoup switching costs from yield</p>
              </div>
              <Badge variant={result.breakEvenDays > 30 ? 'warning' : 'success'} className="text-sm px-3 py-1">
                {Math.ceil(result.breakEvenDays)} days
              </Badge>
            </div>
          </section>
        )}

        {/* ── Warnings ─────────────────────────────────────────────────── */}
        {result.warnings.length > 0 && (
          <section className="space-y-2">
            {result.warnings.map((warning, i) => (
              <div key={i} className="flex gap-3 bg-amber-50 border border-amber-200/50 rounded-lg p-3">
                <span className="text-amber-600">⚠️</span>
                <p className="text-xs text-amber-800 leading-relaxed">{warning.message}</p>
              </div>
            ))}
          </section>
        )}
      </div>
    </Card>
  )
}
