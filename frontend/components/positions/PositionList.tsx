import React from 'react'
import { Position } from '@/types/position'
import { PositionCard } from './PositionCard'
import { PositionSkeleton } from './PositionSkeleton'
import { CHAIN_REGISTRY } from '@/lib/plugins/chains'
import { ChainId } from '@/lib/plugins/types/shared'

interface PositionListProps {
  positions: Position[]
  isLoading?: boolean
}

export function PositionList({ positions, isLoading }: PositionListProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <PositionSkeleton key={i} />
        ))}
      </div>
    )
  }

  const chainIds = Object.keys(CHAIN_REGISTRY) as ChainId[]
  const positionsByChain = chainIds.map(chainId => ({
    chainId,
    displayName: CHAIN_REGISTRY[chainId].displayName,
    positions: positions.filter(p => p.chain === chainId)
  })).filter(group => group.positions.length > 0)

  if (!positions || positions.length === 0 || positionsByChain.length === 0) {
    const supportedChains = chainIds
      .map(id => CHAIN_REGISTRY[id].displayName)
      .filter(Boolean)
      .join(', ')

    return (
      <div className="flex flex-col items-center justify-center py-16 bg-zinc-900 border border-zinc-800 border-dashed rounded-xl">
        <div className="h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500"><circle cx="12" cy="12" r="10"></circle><path d="M16 16s-1.5-2-4-2-4 2-4 2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
        </div>
        <h3 className="text-zinc-200 font-medium text-lg mb-1">No active positions</h3>
        <p className="text-zinc-500 text-sm max-w-sm text-center">
          You don&apos;t have any positions on supported protocols across {supportedChains || 'supported chains'}.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {positionsByChain.map((group) => (
        <section key={group.chainId}>
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-xl font-bold text-zinc-100">{group.displayName}</h2>
            <div className="h-px flex-1 bg-zinc-800"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {group.positions.map((p) => (
              <PositionCard key={p.id} position={p} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
