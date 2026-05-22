import React from 'react'
import { useRouter } from 'next/navigation'
import { Position } from '@/types/position'
import { usePositions } from '@/hooks/usePositions'
import { HealthFactor } from '../ui/HealthFactor'
import { TemplateId } from '@/types/sequencer'

export function BorrowCard({ 
  position,
  onSequence
}: { 
  position: Position
  onSequence?: (template: TemplateId, params: Record<string, string>) => void
}) {
  const router = useRouter()
  const { positions } = usePositions()
  const borrowApyPercent = (position.currentApy * 100).toFixed(2)

  // Identify all possible collateral positions (supply) on the same protocol/chain
  const potentialCollaterals = positions.filter(
    p => p.chain === position.chain &&
         p.protocol === position.protocol &&
         p.positionType === 'supply'
  )

  // NOTE: This currently defaults to the collateral position with the largest balance.
  // For users with multiple collateral types, they may need to select which one to use.
  // TODO: Implement a selector for multi-collateral scenarios.
  const collateralPosition = potentialCollaterals.length > 0
    ? [...potentialCollaterals].sort((a, b) => b.amountUsd - a.amountUsd)[0]
    : undefined

  const hasMultipleCollaterals = potentialCollaterals.length > 1

  const handleDeleverage = () => {
    const params: Record<string, string> = {
      template: 'deleverageAave',
      protocol: position.protocol,
      chain: position.chain,
      borrowAsset: position.asset,
      amount: position.amount.toString(),
      totalDebtUsd: position.amountUsd.toString(),
    }

    if (collateralPosition) {
      params.collateralAsset = collateralPosition.asset
      params.collateralAmount = collateralPosition.amount.toString()
      params.totalCollateralUsd = collateralPosition.amountUsd.toString()
    }

    if (position.healthFactor !== undefined) {
      params.healthFactor = position.healthFactor.toString()
    }

    if (onSequence) {
      onSequence('deleverageAave', params)
    } else {
      const query = new URLSearchParams(params)
      router.push(`/sequence?${query.toString()}`)
    }
  }
  
  return (
    <div className="bg-verdant-surface border border-red-200 rounded-xl p-5 flex flex-col gap-5 shadow-organic hover:shadow-organic-lg transition-shadow">
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold text-verdant-text-primary">
              {position.asset} Debt
            </h3>
            <span className="text-[10px] bg-red-50 text-verdant-loss border border-red-200 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
              Borrow
            </span>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-verdant-text-primary font-mono">${position.amountUsd.toFixed(2)}</p>
          </div>
        </div>
        <div className="flex justify-between items-start">
          <p className="text-sm text-verdant-text-muted capitalize">
            {position.protocol} • {position.chain}
          </p>
          <div className="text-right">
            <p className="text-sm text-verdant-text-muted font-mono">{position.amount.toFixed(4)} {position.asset}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 bg-red-50/60 border border-red-100 rounded-lg p-3">
        <div>
          <p className="text-xs text-verdant-text-muted uppercase tracking-wider font-semibold mb-1">Borrow APY</p>
          <p className="text-verdant-loss font-medium font-mono">{borrowApyPercent}%</p>
        </div>
        {position.healthFactor !== undefined && (
          <HealthFactor value={position.healthFactor} />
        )}
      </div>

      {hasMultipleCollaterals && (
        <div className="text-[11px] text-verdant-text-muted bg-amber-50 px-2 py-1.5 rounded border border-amber-200 flex gap-1.5 items-start">
          <span>⚠️</span>
          <span>Multiple collateral assets found. De-leverage pre-filled with <strong className="font-mono">{collateralPosition?.asset}</strong> (largest position).</span>
        </div>
      )}

      <div className="flex justify-end gap-2 mt-auto pt-2">
        {position.healthFactor !== undefined ? (
          <button 
            onClick={handleDeleverage}
            className="text-sm bg-verdant-loss hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors font-medium"
          >
            De-leverage
          </button>
        ) : (
          <button className="text-sm border border-verdant-teak text-verdant-teak hover:bg-verdant-teak hover:text-white bg-transparent px-4 py-2 rounded-md transition-colors font-medium">
            Repay
          </button>
        )}
      </div>
    </div>
  )
}
