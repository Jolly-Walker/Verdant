import React from 'react'
import { Position } from '@/types/position'
import { WarningBanner } from '@/components/ui/WarningBanner'
import Link from 'next/link'
import { TemplateId } from '@/types/sequencer'

export function PendleCard({ 
  position,
  onSequence
}: { 
  position: Position
  onSequence?: (template: TemplateId, params: Record<string, string>) => void
}) {
  const apyPercent = (position.currentApy * 100).toFixed(2)
  const isPT = position.positionType === 'pendle-pt'
  
  const maturityDate = position.maturityDate ? new Date(position.maturityDate) : null
  const isValidDate = maturityDate && !isNaN(maturityDate.getTime())

  const showExpiryWarning = isValidDate &&
    (maturityDate!.getTime() - Date.now()) < 30 * 24 * 60 * 60 * 1000

  const formattedMaturity = isValidDate
    ? maturityDate!.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Unknown'

  return (
    <div className="bg-verdant-surface border border-[#E5E0D8] rounded-xl p-5 flex flex-col gap-5 shadow-organic hover:shadow-organic-lg transition-shadow">
      {showExpiryWarning && (
        <WarningBanner message={`This position matures soon (${formattedMaturity})`} variant="error" />
      )}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold text-verdant-text-primary">
              {position.asset} {isPT ? 'PT' : 'YT'}
            </h3>
            <span className="text-[10px] bg-verdant-surface-accent text-verdant-text-muted border border-[#D5E8E0] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
              Pendle
            </span>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-verdant-text-primary font-mono">${position.amountUsd.toFixed(2)}</p>
          </div>
        </div>
        <div className="flex justify-between items-start">
          <p className="text-sm text-verdant-text-muted capitalize">
            {position.chain} • {isPT ? 'Fixed Yield' : 'Yield Token'}
          </p>
          <div className="text-right">
            <p className="text-sm text-verdant-text-muted font-mono">{position.amount.toFixed(4)} {position.asset}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 bg-verdant-surface-accent rounded-lg p-3 border border-[#D5E8E0]">
        <div>
          <p className="text-xs text-verdant-text-muted uppercase tracking-wider font-semibold mb-1">
            {isPT ? 'Fixed APY' : 'Implied APY'}
          </p>
          <p className="text-verdant-profit font-medium font-mono">{apyPercent}%</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-verdant-text-muted uppercase tracking-wider font-semibold mb-1">Maturity</p>
          <p className={`text-sm font-mono ${showExpiryWarning ? 'text-verdant-loss' : 'text-verdant-text-muted'}`}>{formattedMaturity}</p>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-auto pt-2">
        {onSequence ? (
          <button 
            onClick={() => onSequence('exitPendle', {
              template: 'exitPendle',
              asset: position.asset,
              amount: position.amount.toString(),
              ptAddress: position.assetAddress || '',
              chain: position.chain,
            })}
            className="text-sm border border-verdant-teak text-verdant-teak hover:bg-verdant-teak hover:text-white bg-transparent px-4 py-2 rounded-md transition-colors font-medium text-center cursor-pointer"
          >
            Exit
          </button>
        ) : (
          <Link 
            href={`/sequence?template=exitPendle&asset=${position.asset}&amount=${position.amount}&ptAddress=${position.assetAddress}&chain=${position.chain}`}
            className="text-sm border border-verdant-teak text-verdant-teak hover:bg-verdant-teak hover:text-white bg-transparent px-4 py-2 rounded-md transition-colors font-medium text-center"
          >
            Exit
          </Link>
        )}
      </div>
    </div>
  )
}
