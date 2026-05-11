import React from 'react'
import { Position } from '@/types/position'
import { WarningBanner } from '@/components/ui/WarningBanner'

export function PendleCard({ position }: { position: Position }) {
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
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-5 hover:border-zinc-700 transition">
      {showExpiryWarning && (
        <WarningBanner message={`This position matures soon (${formattedMaturity})`} />
      )}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">
              {position.asset} {isPT ? 'PT' : 'YT'}
            </h3>
            <span className="text-[10px] bg-purple-950 text-purple-400 border border-purple-900/50 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
              Pendle
            </span>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-white">${position.amountUsd.toFixed(2)}</p>
          </div>
        </div>
        <div className="flex justify-between items-start">
          <p className="text-sm text-zinc-400 capitalize">
            {position.chain} • {isPT ? 'Fixed Yield' : 'Yield Token'}
          </p>
          <div className="text-right">
            <p className="text-sm text-zinc-400">{position.amount.toFixed(4)} {position.asset}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 bg-zinc-950/50 rounded-lg p-3 border border-zinc-800/60">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">
            {isPT ? 'Fixed APY' : 'Implied APY'}
          </p>
          <p className="text-zinc-200 font-medium">{apyPercent}%</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Maturity</p>
          <p className="text-zinc-400 text-sm">{formattedMaturity}</p>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-auto pt-2">
        <button className="text-sm bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg transition-colors font-medium">
          Exit
        </button>
      </div>
    </div>
  )
}
