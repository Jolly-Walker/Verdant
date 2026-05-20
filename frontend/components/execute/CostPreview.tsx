'use client'

import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatUsd, formatPercent } from '@/lib/utils/formatting'
import { Spinner } from '@/components/ui/Spinner'

export function CostPreview({ 
  asset,
  amount,
}: { 
  asset: string,
  amount: string,
}) {
  // This would typically fetch real cost previews from /api/sequencer/preview
  // Mock data for display
  const isLoading = false
  const totalCost = 12.50
  const currentApy = 0.052
  const targetApy = 0.084
  const apyUplift = targetApy - currentApy
  const dailyGain = (Number(amount) * apyUplift) / 365
  const breakEvenDays = totalCost / dailyGain

  if (isLoading) {
    return (
      <Card className="p-6 bg-zinc-900 border-zinc-800 flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </Card>
    )
  }

  return (
    <Card className="p-6 bg-zinc-900 border-zinc-800">
      <h2 className="text-xl font-semibold text-white mb-6">Cost & Yield Preview</h2>
      
      <div className="space-y-6">
        <section>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Estimated Costs</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Gas Fees (est.)</span>
              <span className="text-white">$4.50</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Bridge Fees</span>
              <span className="text-white">$8.00</span>
            </div>
            <div className="pt-2 border-t border-zinc-800 flex justify-between font-medium">
              <span className="text-white">Total Switching Cost</span>
              <span className="text-white">{formatUsd(totalCost)}</span>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Yield Impact</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Current APY</span>
              <span className="text-white">{formatPercent(currentApy)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Target APY</span>
              <span className="text-emerald-400">{formatPercent(targetApy)}</span>
            </div>
            <div className="pt-2 border-t border-zinc-800 flex justify-between font-medium">
              <span className="text-white">Net Yield Uplift</span>
              <div className="text-right">
                <div className="text-emerald-400">+{formatPercent(apyUplift)}</div>
                <div className="text-xs text-zinc-500">+{formatUsd(dailyGain)} / day</div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-zinc-800/30 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-zinc-300">Break-even Period</span>
            <Badge variant={breakEvenDays > 30 ? 'warning' : 'success'}>
              {Math.ceil(breakEvenDays)} days
            </Badge>
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">
            Based on current {asset} prices and protocol yields. Gas costs are estimates.
          </p>
        </section>
      </div>
    </Card>
  )
}
