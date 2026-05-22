import React, { useState } from "react"
import { Position } from "@/types/position"
import { BorrowCard } from "./BorrowCard"
import { PendleCard } from "./PendleCard"
import { useHarvest } from "@/hooks/useHarvest"
import { useSequencer } from "@/hooks/useSequencer"
import { Tooltip } from "../ui/Tooltip"
import { DEFAULT_MIN_USD_THRESHOLD } from "@/constants/settings"

import { TemplateId } from "@/types/sequencer"

export function PositionCard({ 
  position,
  onSequence
}: { 
  position: Position
  onSequence?: (template: TemplateId, params: Record<string, string>) => void
}) {
  const [isHarvesting, setIsHarvesting] = useState(false)
  const { plan, isSimulating } = useSequencer()
  const { harvest, isSimulating: isHarvestSimulating, isSigning } = useHarvest()

  if (position.positionType === 'borrow') {
    return <BorrowCard position={position} onSequence={onSequence} />
  }

  if (position.positionType === 'pendle-pt' || position.positionType === 'pendle-yt') {
    return <PendleCard position={position} onSequence={onSequence} />
  }

  const currentApyPercent = (position.currentApy * 100).toFixed(2)
  const hasRewards = position.claimableRewards.length > 0
  const rewardsUsd = position.claimableRewards.reduce((sum, r) => sum + r.amountUsd, 0)
  const canHarvest = rewardsUsd >= DEFAULT_MIN_USD_THRESHOLD

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
    <div className="bg-verdant-surface border border-[#E5E0D8] rounded-xl p-5 flex flex-col gap-5 shadow-organic hover:shadow-organic-lg transition-shadow">
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold text-verdant-text-primary">
              {position.asset} {isWallet ? '' : `on ${position.protocol.charAt(0).toUpperCase() + position.protocol.slice(1)}`}
            </h3>
            {isWallet && (
              <span className="text-[10px] bg-verdant-surface-accent text-verdant-text-muted border border-[#D5E8E0] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                Wallet
              </span>
            )}
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-verdant-text-primary font-mono">${position.amountUsd.toFixed(2)}</p>
          </div>
        </div>
        <div className="flex justify-between items-start">
          <p className="text-sm text-verdant-text-muted capitalize">
            {position.chain} • {position.positionType}
          </p>
          <div className="text-right">
            <p className="text-sm text-verdant-text-muted font-mono">{position.amount.toFixed(4)} {position.asset}</p>
          </div>
        </div>
      </div>

      {!isWallet && (
        <div className="flex justify-between items-center bg-verdant-surface-accent border border-[#D5E8E0] rounded-lg p-3">
          <div>
            <p className="text-xs text-verdant-text-muted uppercase tracking-wider font-semibold mb-1">Current APY</p>
            <p className="text-verdant-profit font-medium font-mono">{currentApyPercent}%</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-verdant-text-muted uppercase tracking-wider font-semibold mb-1">Rewards</p>
            {hasRewards ? (
              <p className="text-verdant-profit font-medium font-mono">${rewardsUsd.toFixed(2)}</p>
            ) : (
              <p className="text-verdant-text-muted font-mono">$0.00</p>
            )}
          </div>
        </div>
      )}

      {!isWallet && (
        <div className="flex justify-end gap-2 mt-auto pt-2">
          {hasRewards && (
            <Tooltip content={!canHarvest ? `Minimum harvest is $${DEFAULT_MIN_USD_THRESHOLD.toLocaleString()}` : ""}>
              <button 
                onClick={handleHarvest}
                disabled={!canHarvest || isHarvesting || isSimulating}
                className="text-sm bg-verdant-moss hover:bg-verdant-moss-dark disabled:opacity-50 text-white px-4 py-2 rounded-md transition-colors font-medium"
              >
                {isHarvestSimulating ? "Simulating..." : isSigning ? "Signing..." : isReady ? "Sign Harvest" : "Harvest"}
              </button>
            </Tooltip>
          )}
          <button className="text-sm border border-verdant-teak text-verdant-teak hover:bg-verdant-teak hover:text-white bg-transparent px-4 py-2 rounded-md transition-colors font-medium">
            Manage
          </button>
        </div>
      )}
    </div>
  )
}
