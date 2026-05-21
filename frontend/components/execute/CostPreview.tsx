'use client'

import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatUsd, formatPercent } from '@/lib/utils/formatting'
import { Spinner } from '@/components/ui/Spinner'
import { CostPreviewInput, CostPreviewResult } from '@/types/quote'
import { useQuote } from '@/hooks/useQuote'

interface CostPreviewProps {
  input: CostPreviewInput | null
  // Optional result if already fetched by parent (e.g. for a SequencePlan)
  result?: CostPreviewResult | null
}

export function CostPreview({ 
  input,
  result: providedResult
}: CostPreviewProps) {
  const { quote: fetchedQuote, isLoading, error, isStale, quoteAge, refetch } = useQuote(input)
  
  const result = providedResult || fetchedQuote

  if (isLoading && !result) {
    return (
      <Card className="p-6 bg-zinc-900 border-zinc-800 flex flex-col items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
        <p className="text-zinc-500 mt-4 animate-pulse">Calculating optimal route...</p>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6 bg-zinc-900 border-zinc-800 border-red-900/50">
        <h2 className="text-xl font-semibold text-white mb-4">Preview Failed</h2>
        <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-200">{error}</p>
        </div>
        <button 
          onClick={refetch}
          className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
        >
          Retry Calculation
        </button>
      </Card>
    )
  }

  if (!result) {
    return (
      <Card className="p-6 bg-zinc-900 border-zinc-800 flex items-center justify-center min-h-[400px]">
        <p className="text-zinc-500 text-center max-w-[200px]">
          Select an asset and template to see cost & yield impact
        </p>
      </Card>
    )
  }

  return (
    <Card className="p-6 bg-zinc-900 border-zinc-800 relative overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center z-10">
          <Spinner />
        </div>
      )}
      
      <div className="flex justify-between items-start mb-6">
        <h2 className="text-xl font-semibold text-white">Cost & Yield Preview</h2>
        {isStale ? (
          <Badge variant="warning" className="cursor-pointer" onClick={refetch}>
            Stale ({quoteAge}s) • Refresh
          </Badge>
        ) : (
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
            Updated {quoteAge}s ago
          </span>
        )}
      </div>
      
      <div className="space-y-8">
        <section>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Itemized Switching Costs</h3>
          <div className="space-y-3">
            {result.steps.map((step, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-300 font-medium">{step.stepLabel}</span>
                  <span className="text-white font-mono">
                    {formatUsd(step.gasCostUsd + (step.bridgeFeeUsd || 0) + (step.slippageUsd || 0))}
                  </span>
                </div>
                <div className="flex gap-2 text-[11px] text-zinc-500">
                  <span className="bg-zinc-800 px-1.5 rounded uppercase">{step.chain}</span>
                  <span>Gas: {formatUsd(step.gasCostUsd)}</span>
                  {step.bridgeFeeUsd && <span>• Fee: {formatUsd(step.bridgeFeeUsd)}</span>}
                  {step.slippageUsd && <span>• Slippage: {formatUsd(step.slippageUsd)}</span>}
                </div>
              </div>
            ))}
            
            <div className="pt-4 border-t border-zinc-800 flex justify-between items-baseline">
              <span className="text-zinc-400 font-semibold uppercase text-xs">Total Cost</span>
              <span className="text-xl font-bold text-white">{formatUsd(result.totalCostUsd)}</span>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Yield Impact</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Current APY</span>
              <span className="text-white font-medium">{formatPercent(result.currentApyDecimal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Target APY</span>
              <span className="text-emerald-400 font-medium">{formatPercent(result.targetApyDecimal)}</span>
            </div>
            <div className="pt-3 border-t border-zinc-800 flex justify-between items-center">
              <span className="text-white font-semibold">Net Yield Uplift</span>
              <div className="text-right">
                <div className="text-lg font-bold text-emerald-400">
                  {result.netUpliftDecimal && result.netUpliftDecimal > 0 ? '+' : ''}
                  {formatPercent(result.netUpliftDecimal || 0)}
                </div>
                {result.dailyYieldGainUsd !== null && (
                  <div className="text-xs text-zinc-500">
                    {result.dailyYieldGainUsd > 0 ? '+' : ''}
                    {formatUsd(result.dailyYieldGainUsd)} / day
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {result.breakEvenDays !== null && result.breakEvenDays > 0 && result.breakEvenDays !== Infinity && (
          <section className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4">
            <div className="flex justify-between items-center">
              <div className="space-y-0.5">
                <span className="text-xs text-zinc-400 uppercase font-bold tracking-tight">Break-even Period</span>
                <p className="text-[11px] text-zinc-500">Recoup switching costs from yield</p>
              </div>
              <Badge variant={result.breakEvenDays > 30 ? 'warning' : 'success'} className="text-sm px-3 py-1">
                {Math.ceil(result.breakEvenDays)} days
              </Badge>
            </div>
          </section>
        )}

        {result.warnings.length > 0 && (
          <section className="space-y-2">
            {result.warnings.map((warning, i) => (
              <div key={i} className="flex gap-3 bg-amber-500/5 border border-amber-500/10 rounded-lg p-3">
                <span className="text-amber-500">⚠️</span>
                <p className="text-xs text-amber-200/80 leading-relaxed">{warning.message}</p>
              </div>
            ))}
          </section>
        )}
      </div>
    </Card>
  )
}
