import React, { useState } from 'react'
import { Position } from '@/types/position'
import { PositionCard } from './PositionCard'
import { PositionSkeleton } from './PositionSkeleton'
import { PositionTypeFilter } from './PositionTypeFilter'
import { useChainMetadata } from '@/hooks/useChainMetadata'
import { PositionType } from '@/types/shared'

interface PositionListProps {
  positions: Position[]
  isLoading?: boolean
}

export function PositionList({ positions, isLoading }: PositionListProps) {
  const [filter, setFilter] = useState<PositionType | 'all' | 'pendle'>('all')
  const { chainIds, getChainMetadata } = useChainMetadata()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <PositionSkeleton key={i} />
        ))}
      </div>
    )
  }

  const filteredPositions = filter === 'all' 
    ? positions 
    : positions.filter(p => {
        if (filter === 'pendle') return p.positionType === 'pendle-pt' || p.positionType === 'pendle-yt'
        return p.positionType === filter
      })

  const positionsByChain = chainIds.map(chainId => {
    const chainPositions = filteredPositions.filter(p => p.chain === chainId)
    const assets = chainPositions.filter(p => p.positionType !== 'borrow')
    const liabilities = chainPositions.filter(p => p.positionType === 'borrow')
    
    return {
      chainId,
      displayName: getChainMetadata(chainId).displayName,
      assets,
      liabilities,
      hasPositions: chainPositions.length > 0
    }
  }).filter(group => group.hasPositions)

  if (!positions || positions.length === 0) {
    const supportedChains = chainIds
      .map(id => getChainMetadata(id).displayName)
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
    <div className="space-y-6">
      <PositionTypeFilter selected={filter} onChange={setFilter} />
      
      <div className="space-y-12 pt-4">
        {positionsByChain.map((group) => (
          <section key={group.chainId}>
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-xl font-bold text-zinc-100">{group.displayName}</h2>
              <div className="h-px flex-1 bg-zinc-800"></div>
              <p className="text-xs text-zinc-500 font-mono uppercase">
                {group.assets.length + group.liabilities.length} positions
              </p>
            </div>

            {group.assets.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {group.assets.map((p) => (
                  <PositionCard key={p.id} position={p} />
                ))}
              </div>
            )}

            {group.liabilities.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <span className="h-1 w-1 rounded-full bg-red-500"></span>
                  <h3 className="text-xs font-bold text-red-500/80 uppercase tracking-widest">Liabilities</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {group.liabilities.map((p) => (
                    <PositionCard key={p.id} position={p} />
                  ))}
                </div>
              </div>
            )}
          </section>
        ))}

        {positionsByChain.length === 0 && (
          <div className="py-12 text-center border border-zinc-800 rounded-xl bg-zinc-900/50">
            <p className="text-zinc-500">No positions match the selected filter.</p>
          </div>
        )}
      </div>
    </div>
  )
}
