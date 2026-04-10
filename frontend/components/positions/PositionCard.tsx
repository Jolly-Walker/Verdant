import React from "react"
import { Position } from "@/types/position"
import { WarningBanner } from "@/components/ui/WarningBanner"
import { useHarvest } from "@/hooks/useHarvest"

export function PositionCard({ position }: { position: Position }) {
  const currentApyPercent = (position.currentApy * 100).toFixed(2)
  const hasRewards = position.claimableRewards.length > 0
  const rewardsUsd = position.claimableRewards.reduce((sum, r) => sum + r.amountUsd, 0)
  
  const { harvest } = useHarvest()

  let showPendleWarning = false
  if (position.protocol === "pendle" && position.metadata?.expiry) {
    const expiryMs = typeof position.metadata.expiry === "number" 
      ? position.metadata.expiry * 1000 
      : Date.parse(position.metadata.expiry as string)
    
    if (expiryMs && (expiryMs - Date.now()) < 30 * 24 * 60 * 60 * 1000) {
      showPendleWarning = true
    }
  }

  const handleHarvest = async () => {
    try {
      const sim = await fetch("/api/simulate", {
        method: "POST",
        body: JSON.stringify({ position: position.id }),
      })
      if (!sim.ok) {
        alert("Transaction simulation failed")
        return
      }
      await harvest(position.id)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-5 hover:border-zinc-700 transition">
      {showPendleWarning && (
        <WarningBanner message="This Pendle position matures in < 30 days" />
      )}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">
              {position.asset} on {position.protocol.charAt(0).toUpperCase() + position.protocol.slice(1)}
            </h3>
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

      <div className="flex justify-end gap-2 mt-auto pt-2">
        {hasRewards && (
          <button 
            onClick={handleHarvest}
            className="text-sm bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition-colors font-medium shadow-sm shadow-emerald-900/20"
          >
            Harvest
          </button>
        )}
      </div>
    </div>
  )
}
