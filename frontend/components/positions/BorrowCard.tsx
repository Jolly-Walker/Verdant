import React from 'react'
import { useRouter } from 'next/navigation'
import { Position } from '@/types/position'
import { usePositions } from '@/hooks/usePositions'
import { HealthFactor } from '../ui/HealthFactor'

export function BorrowCard({ position }: { position: Position }) {
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
    const query = new URLSearchParams({
      template: 'deleverageAave',
      protocol: position.protocol,
      chain: position.chain,
      borrowAsset: position.asset,
      amount: position.amount.toString(),
      totalDebtUsd: position.amountUsd.toString(),
    })

    if (collateralPosition) {
      query.set('collateralAsset', collateralPosition.asset)
      query.set('collateralAmount', collateralPosition.amount.toString())
      query.set('totalCollateralUsd', collateralPosition.amountUsd.toString())
    }

    if (position.healthFactor !== undefined) {
      query.set('healthFactor', position.healthFactor.toString())
    }

    router.push(`/sequence?${query.toString()}`)
  }
  
  return (
    <div className="bg-zinc-900 border border-red-900/30 rounded-xl p-5 flex flex-col gap-5 hover:border-red-900/50 transition">
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">
              {position.asset} Debt
            </h3>
            <span className="text-[10px] bg-red-950 text-red-400 border border-red-900/50 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
              Borrow
            </span>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-white">${position.amountUsd.toFixed(2)}</p>
          </div>
        </div>
        <div className="flex justify-between items-start">
          <p className="text-sm text-zinc-400 capitalize">
            {position.protocol} • {position.chain}
          </p>
          <div className="text-right">
            <p className="text-sm text-zinc-400">{position.amount.toFixed(4)} {position.asset}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 bg-zinc-950/50 rounded-lg p-3 border border-zinc-800/60">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Borrow APY</p>
          <p className="text-red-400 font-medium">{borrowApyPercent}%</p>
        </div>
        {position.healthFactor !== undefined && (
          <HealthFactor value={position.healthFactor} />
        )}
      </div>

      {hasMultipleCollaterals && (
        <div className="text-[11px] text-zinc-500 bg-zinc-800/40 px-2 py-1.5 rounded border border-zinc-700/50 flex gap-1.5 items-start">
          <span>⚠️</span>
          <span>Multiple collateral assets found. De-leverage pre-filled with <strong>{collateralPosition?.asset}</strong> (largest position).</span>
        </div>
      )}

      <div className="flex justify-end gap-2 mt-auto pt-2">
        {position.healthFactor !== undefined ? (
          <button 
            onClick={handleDeleverage}
            className="text-sm bg-red-650 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors font-medium"
          >
            De-leverage
          </button>
        ) : (
          <button className="text-sm bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg transition-colors font-medium">
            Repay
          </button>
        )}
      </div>
    </div>
  )
}
