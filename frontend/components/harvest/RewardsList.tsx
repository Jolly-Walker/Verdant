'use client'

import React from 'react'
import { AggregatedReward } from '@/hooks/useRewards'
import { Badge } from '@/components/ui/Badge'

const PROTOCOL_LABELS: Record<string, string> = {
  aave: 'Aave V3',
  morpho: 'Morpho',
  euler: 'Euler',
  pendle: 'Pendle',
}

const CHAIN_LABELS: Record<string, string> = {
  ethereum: 'Ethereum',
  arbitrum: 'Arbitrum',
  base: 'Base',
}

interface RewardsListProps {
  rewards: AggregatedReward[]
  isLoading?: boolean
}

function RewardRow({ reward }: { reward: AggregatedReward }) {
  const protocolLabel = PROTOCOL_LABELS[reward.protocol] ?? reward.protocol
  const chainLabel = CHAIN_LABELS[reward.chain] ?? reward.chain

  return (
    <div className="flex items-center justify-between py-3 px-4 bg-verdant-surface border border-[#E5E0D8] rounded-xl hover:border-verdant-moss/50 shadow-organic hover:shadow-organic-lg transition-all">
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-verdant-text-primary font-semibold text-sm">{reward.token}</span>
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-[10px]">{protocolLabel}</Badge>
            <Badge variant="default" className="text-[10px]">{chainLabel}</Badge>
          </div>
        </div>
      </div>
      <div className="text-right">
        <p className="text-verdant-profit font-semibold text-sm font-mono">{Number(reward.amount).toFixed(6)}</p>
        <p className="text-verdant-text-muted text-xs font-mono">${reward.amountUsd.toFixed(2)}</p>
      </div>
    </div>
  )
}

export function RewardsList({ rewards, isLoading }: RewardsListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-verdant-surface-accent border border-[#E5E0D8] rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (rewards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-4xl mb-3">🌱</div>
        <p className="text-verdant-text-muted text-sm font-medium">No claimable rewards found</p>
        <p className="text-verdant-text-muted/70 text-xs mt-1">Rewards will appear here once your positions start accruing</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {rewards.map((r, i) => (
        <RewardRow key={`${r.protocol}-${r.chain}-${r.token}-${i}`} reward={r} />
      ))}
    </div>
  )
}
