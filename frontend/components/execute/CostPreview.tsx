'use client'

import React from 'react'
import { CostPreviewResult } from '@/types/quote'
import { ProtocolId, ChainId } from '@/types/shared'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { WarningBanner } from '@/components/ui/WarningBanner'
import { formatUsd, formatPercent } from '@/lib/utils/formatting'
import { getChainDisplayName } from '@/lib/utils/chains'
import { useProtocolMetadata } from '@/hooks/useProtocolMetadata'

interface CostPreviewProps {
  quote: CostPreviewResult | null
  isLoading: boolean
  isStale: boolean
  quoteAge: number
  asset: string
  amount: number
  amountUsd: number
  sourceChain: Chain
  destChain: Chain
  destProtocol: Protocol
  onRefresh: () => void
  onProceed: () => void
  onCancel: () => void
}

export function CostPreview({
  quote,
  isLoading,
  isStale,
  quoteAge,
  asset,
  amount,
  amountUsd,
  sourceChain,
  destChain,
  destProtocol,
  onRefresh,
  onProceed,
  onCancel,
}: CostPreviewProps) {
  const { getProtocolMetadata } = useProtocolMetadata()
  const [hasConfirmedHealthFactor, setHasConfirmedHealthFactor] = React.useState(false)
  const isExpired = quoteAge > 90

  const healthFactorWarning = quote?.warnings.find(w => 
    w.message.toLowerCase().includes('health factor') && 
    w.message.includes('below 1.5')
  )

  if (isLoading && !quote) {
    return (
      <Card className="flex flex-col items-center justify-center py-16 gap-4">
        <Spinner size="lg" />
        <p className="text-zinc-400 text-sm">Calculating costs...</p>
      </Card>
    )
  }

  if (!quote) {
    return null
  }

  const protocolDisplay = getProtocolMetadata(destProtocol)?.displayName || destProtocol

  return (
    <Card className="flex flex-col gap-0 p-0 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-zinc-800">
        <h3 className="text-lg font-semibold text-white">
          Moving {amount.toLocaleString()} {asset}
        </h3>
        <p className="text-sm text-zinc-400 mt-1">
          {getChainDisplayName(sourceChain)} → {protocolDisplay} on{' '}
          {getChainDisplayName(destChain)}
        </p>
      </div>

      {/* Costs Section */}
      <div className="px-6 py-4 border-b border-zinc-800">
        <h4 className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-3">
          Costs
        </h4>
        <div className="space-y-2">
          <CostRow label="Bridge fee (est.)" value={quote.bridgeFeeUsd} />
          <CostRow label="Swap slippage (est.)" value={quote.slippageUsd} />
          <CostRow
            label={`Gas — Step 1 (${getChainDisplayName(sourceChain)})`}
            value={quote.gasStep1Usd}
          />
          <CostRow
            label={`Gas — Step 2 (${getChainDisplayName(destChain)})`}
            value={quote.gasStep2Usd}
          />
          <div className="border-t border-zinc-800 pt-2 mt-2">
            <CostRow
              label="Total switching cost"
              value={quote.totalSwitchingCostUsd}
              bold
            />
          </div>
        </div>
      </div>

      {/* Yield Section */}
      <div className="px-6 py-4 border-b border-zinc-800">
        <h4 className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-3">
          Yield
        </h4>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Current APY</span>
            <span className="text-zinc-200">{formatPercent(quote.currentApyDecimal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Target APY</span>
            <span className="text-zinc-200">{formatPercent(quote.targetApyDecimal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Net uplift</span>
            <span
              className={
                quote.netUpliftDecimal > 0
                  ? 'text-emerald-400'
                  : quote.netUpliftDecimal < 0
                    ? 'text-red-400'
                    : 'text-zinc-400'
              }
            >
              {quote.netUpliftDecimal > 0 ? '+' : ''}
              {formatPercent(quote.netUpliftDecimal)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Daily yield gain</span>
            <span
              className={
                quote.dailyYieldGainUsd > 0
                  ? 'text-emerald-400'
                  : quote.dailyYieldGainUsd < 0
                    ? 'text-red-400'
                    : 'text-zinc-400'
              }
            >
              {quote.dailyYieldGainUsd > 0 ? '+' : ''}
              {formatUsd(quote.dailyYieldGainUsd)}
            </span>
          </div>
        </div>
      </div>

      {/* Break-even Section */}
      <div className="px-6 py-4 border-b border-zinc-800">
        <h4 className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-3">
          Break-even
        </h4>
        {quote.breakEvenDays > 0 && isFinite(quote.breakEvenDays) ? (
          <div>
            <p className="text-sm text-zinc-200">
              Recover switching cost in{' '}
              <span className="font-semibold text-white">
                {Math.ceil(quote.breakEvenDays)} days
              </span>
            </p>
            <p className="text-sm text-emerald-400 mt-1">
              ✓ Worth moving if holding {Math.ceil(quote.breakEvenDays)}+ days
            </p>
          </div>
        ) : quote.breakEvenDays === -1 ? (
          <p className="text-sm text-red-400">
            ✗ Target APY is lower — this move would reduce your yield
          </p>
        ) : (
          <p className="text-sm text-zinc-400">
            APYs are equal — no yield advantage from moving
          </p>
        )}
      </div>

      {/* Warnings */}
      {quote.warnings.length > 0 && (
        <div className="px-6 py-4 border-b border-zinc-800 space-y-2">
          {quote.warnings.map((w, i) => (
            <WarningBanner key={i} message={w.message} />
          ))}
          
          {healthFactorWarning && (
            <label className="flex items-start gap-3 p-3 bg-red-950/20 border border-red-900/50 rounded-lg cursor-pointer hover:bg-red-950/30 transition-colors">
              <input
                type="checkbox"
                checked={hasConfirmedHealthFactor}
                onChange={(e) => setHasConfirmedHealthFactor(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-zinc-700 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-zinc-900 bg-zinc-800"
              />
              <span className="text-sm text-zinc-300">
                I understand that this action brings my health factor below 1.5 and increases liquidation risk.
              </span>
            </label>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs ${isStale ? 'text-amber-400' : 'text-zinc-500'}`}
            >
              Quotes refreshed {quoteAge}s ago
            </span>
            {isStale && <Badge variant="warning">Stale</Badge>}
            {isExpired && <Badge variant="error">Expired</Badge>}
          </div>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50 px-2 py-1 rounded border border-zinc-800 hover:border-zinc-700 transition-colors"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors border border-zinc-700"
          >
            Cancel
          </button>
          <button
            onClick={onProceed}
            disabled={
              isExpired || 
              isLoading || 
              amountUsd < 1000 || 
              (!!healthFactorWarning && !hasConfirmedHealthFactor)
            }
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {isExpired
              ? 'Refresh quote to proceed'
              : amountUsd < 1000
                ? 'Min. $1,000 required'
                : 'Proceed to Step 1'}
          </button>
        </div>
      </div>
    </Card>
  )
}

function CostRow({
  label,
  value,
  bold = false,
}: {
  label: string
  value: number
  bold?: boolean
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className={bold ? 'text-zinc-200 font-semibold' : 'text-zinc-400'}>
        {label}
      </span>
      <span className={bold ? 'text-white font-semibold' : 'text-zinc-200'}>
        {formatUsd(value)}
      </span>
    </div>
  )
}
