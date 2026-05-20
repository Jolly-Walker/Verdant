import React, { useState } from "react"
import { Position } from "@/types/position"
import { BorrowCard } from "./BorrowCard"
import { PendleCard } from "./PendleCard"
import { useHarvest } from "@/hooks/useHarvest"
import { useSequencer } from "@/hooks/useSequencer"
import { Tooltip } from "../ui/Tooltip"

export function PositionCard({ position }: { position: Position }) {
  const [isHarvesting, setIsHarvesting] = useState(false)
  const { plan, isSimulating } = useSequencer()
  const { harvest, isSimulating: isHarvestSimulating, isSigning } = useHarvest()

  if (position.positionType === 'borrow') {
    return <BorrowCard position={position} />
  }

  if (position.positionType === 'pendle-pt' || position.positionType === 'pendle-yt') {
    return <PendleCard position={position} />
  }

  const currentApyPercent = (position.currentApy * 100).toFixed(2)
  const hasRewards = position.claimableRewards.length > 0
  const rewardsUsd = position.claimableRewards.reduce((sum, r) => sum + r.amountUsd, 0)
  const canHarvest = rewardsUsd >= 1000

  const handleHarvest = async () => {
    if (!canHarvest) return
    
    setIsHarvesting(true)
    try {
      await harvest(position.protocol as string, position.chain)
    } catch (e) {
      console.error(e)
      alert("An error occurred during harvest")
    } finally {
      setIsHarvesting(false)
    }
  }

  const isWallet = position.positionType === 'wallet'
  const currentStep = plan?.steps[0]
  const isReady = currentStep?.status === 'ready'

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-5 hover:border-zinc-700 transition">
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">
              {position.asset} {isWallet ? '' : `on ${position.protocol.charAt(0).toUpperCase() + position.protocol.slice(1)}`}
            </h3>
            {isWallet && (
              <span className="text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                Wallet
              </span>
            )}
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-white">${position.amountUsd.toFixed(2)}</p>
          </div>
        </div>
        <div className="flex justify-between items-start">
          <p className="text-sm text-zinc-400 capitalize">
            {position.chain} • {position.positionType}
          </p>
          <div className="text-right">
            <p className="text-sm text-zinc-400">{position.amount.toFixed(4)} {position.asset}</p>
          </div>
        </div>
      </div>

      {!isWallet && (
        <div className="flex justify-between items-center bg-zinc-950/50 rounded-lg p-3 border border-zinc-800/60">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Current APY</p>
            <p className="text-zinc-200 font-medium">{currentApyPercent}%</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Rewards</p>
            {hasRewards ? (
              <p className="text-emerald-400 font-medium">${rewardsUsd.toFixed(2)}</p>
            ) : (
              <p className="text-zinc-600 font-medium">$0.00</p>
            )}
          </div>
        </div>
      )}

      {!isWallet && (
        <div className="flex justify-end gap-2 mt-auto pt-2">
          {hasRewards && (
            <Tooltip content={!canHarvest ? "Minimum harvest is $1,000" : ""}>
              <button 
                onClick={handleHarvest}
                disabled={!canHarvest || isHarvesting || isSimulating}
                className="text-sm bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-4 py-2 rounded-lg transition-colors font-medium shadow-sm shadow-emerald-900/20"
              >
                {isHarvestSimulating ? "Simulating..." : isSigning ? "Signing..." : isReady ? "Sign Harvest" : "Harvest"}
              </button>
            </Tooltip>
          )}
          <button className="text-sm bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg transition-colors font-medium">
            Manage
          </button>
        </div>
      )}
    </div>
  )
}
