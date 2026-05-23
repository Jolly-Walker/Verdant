import React, { useState } from 'react'
import { Position } from '@/types/position'
import { PositionCard } from './PositionCard'
import { PositionSkeleton } from './PositionSkeleton'
import { PositionTypeFilter } from './PositionTypeFilter'
import { useChainMetadata } from '@/hooks/useChainMetadata'
import { PositionType } from '@/types/shared'

import { Badge } from '../ui/Badge'
import { TemplateId } from '@/types/sequencer'
import { formatUsd } from '@/lib/utils/formatting'

interface PositionListProps {
  positions: Position[]
  isLoading?: boolean
  onSequence?: (template: TemplateId, params: Record<string, string>) => void
}

export function PositionList({ positions, isLoading, onSequence }: PositionListProps) {
  const [filter, setFilter] = useState<PositionType | 'all' | 'pendle'>('all')
  const { chainIds, getChainMetadata } = useChainMetadata()

  if (isLoading) {
    return (
      <div className="space-y-8">
        {[1, 2].map((i) => (
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
    const metadata = getChainMetadata(chainId)
    
    // Group chainPositions by protocol
    const groupedByProtocol: Record<string, Position[]> = {}
    chainPositions.forEach(p => {
      const proto = p.protocol || 'wallet'
      if (!groupedByProtocol[proto]) {
        groupedByProtocol[proto] = []
      }
      groupedByProtocol[proto].push(p)
    })

    const PROTOCOL_NAMES: Record<string, string> = {
      aave: 'Aave V3',
      morpho: 'Morpho',
      pendle: 'Pendle',
      euler: 'Euler',
      wallet: 'Wallet Balances'
    }

    // Map each protocol group to summary info
    const protocolGroups = Object.entries(groupedByProtocol).map(([protocolId, protocolPositions]) => {
      const netValueUsd = protocolPositions.reduce((sum, p) => {
        if (p.positionType === 'borrow') {
          return sum - p.amountUsd
        }
        return sum + p.amountUsd
      }, 0)

      const healthFactor = protocolPositions.find(p => p.healthFactor !== undefined)?.healthFactor

      return {
        protocolId,
        displayName: PROTOCOL_NAMES[protocolId] || (protocolId.charAt(0).toUpperCase() + protocolId.slice(1)),
        positions: protocolPositions,
        netValueUsd,
        healthFactor
      }
    })

    // Sort protocolGroups: DeFi protocols first (by absolute net value descending), wallet balances last
    const sortedProtocolGroups = protocolGroups.sort((a, b) => {
      if (a.protocolId === 'wallet') return 1
      if (b.protocolId === 'wallet') return -1
      
      return Math.abs(b.netValueUsd) - Math.abs(a.netValueUsd)
    })

    return {
      chainId,
      displayName: metadata.displayName,
      family: metadata.family,
      protocolGroups: sortedProtocolGroups,
      hasPositions: chainPositions.length > 0,
      totalPositionsCount: chainPositions.length
    }
  }).filter(group => group.hasPositions)

  if (!positions || positions.length === 0) {
    const supportedChains = chainIds
      .map(id => getChainMetadata(id).displayName)
      .filter(Boolean)
      .join(', ')

    return (
      <div className="flex flex-col items-center justify-center py-16 bg-verdant-surface border border-[#E5E0D8] border-dashed rounded-xl shadow-organic">
        <div className="h-12 w-12 rounded-full bg-verdant-surface-accent flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-verdant-text-muted"><circle cx="12" cy="12" r="10"></circle><path d="M16 16s-1.5-2-4-2-4 2-4 2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
        </div>
        <h3 className="text-verdant-text-primary font-medium text-lg mb-1">No active positions</h3>
        <p className="text-verdant-text-muted text-sm max-w-sm text-center">
          You don&apos;t have any positions on supported protocols across {supportedChains || 'supported chains'}.
        </p>
      </div>
    )
  }

  const getHealthFactorColor = (hf: number) => {
    if (hf < 1.5) return 'text-verdant-loss'
    if (hf < 2.0) return 'text-amber-600'
    return 'text-verdant-profit'
  }

  return (
    <div className="space-y-6">
      <PositionTypeFilter selected={filter} onChange={setFilter} />
      
      <div className="space-y-12 pt-4">
        {positionsByChain.map((group) => (
          <section key={group.chainId}>
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-xl font-bold text-verdant-text-primary">{group.displayName}</h2>
              {group.family === 'solana' && (
                <Badge className="bg-purple-50 text-purple-700 border-purple-200/50">Solana</Badge>
              )}
              <div className="h-px flex-1 bg-[#E5E0D8]"></div>
              <p className="text-xs text-verdant-text-muted font-mono uppercase">
                {group.totalPositionsCount} {group.totalPositionsCount === 1 ? 'position' : 'positions'}
              </p>
            </div>

            {group.protocolGroups.map((protoGroup) => (
              <div 
                key={protoGroup.protocolId} 
                className="bg-verdant-surface border border-[#E5E0D8] rounded-xl shadow-organic overflow-hidden mb-6 last:mb-0"
              >
                {/* Sub-header */}
                <div className="bg-[#FAF9F6] border-b border-[#E5E0D8]/40 px-5 py-3.5 flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-verdant-text-primary text-sm tracking-wide">
                      {protoGroup.displayName}
                    </span>
                    <span className="text-[10px] bg-verdant-surface-accent text-verdant-moss font-semibold px-2 py-0.5 rounded font-mono">
                      {protoGroup.positions.length} {protoGroup.positions.length === 1 ? 'asset' : 'assets'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-5">
                    {/* Health Factor if exists */}
                    {protoGroup.healthFactor !== undefined && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-verdant-text-muted">Health Factor:</span>
                        <span className={`font-mono text-xs font-bold ${getHealthFactorColor(protoGroup.healthFactor)}`}>
                          {protoGroup.healthFactor.toFixed(2)}
                        </span>
                      </div>
                    )}
                    
                    {/* Net Value */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-verdant-text-muted">Net Value:</span>
                      <span className={`font-mono text-sm font-bold ${protoGroup.netValueUsd < 0 ? 'text-verdant-loss' : 'text-verdant-text-primary'}`}>
                        {protoGroup.netValueUsd < 0 ? '-' : ''}{formatUsd(Math.abs(protoGroup.netValueUsd))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E5E0D8]/40 bg-[#FAF9F6]/30">
                        <th className="px-5 py-3 text-xs font-bold text-verdant-text-muted uppercase tracking-wider">Asset</th>
                        <th className="px-5 py-3 text-xs font-bold text-verdant-text-muted uppercase tracking-wider text-right">Price</th>
                        <th className="px-5 py-3 text-xs font-bold text-verdant-text-muted uppercase tracking-wider text-right">Balance</th>
                        <th className="px-5 py-3 text-xs font-bold text-verdant-text-muted uppercase tracking-wider text-right">APY</th>
                        <th className="px-5 py-3 text-xs font-bold text-verdant-text-muted uppercase tracking-wider text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {protoGroup.positions.map((p) => (
                        <PositionCard key={p.id} position={p} onSequence={onSequence} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>
        ))}

        {positionsByChain.length === 0 && (
          <div className="py-12 text-center border border-[#E5E0D8] rounded-xl bg-verdant-surface-accent">
            <p className="text-verdant-text-muted">No positions match the selected filter.</p>
          </div>
        )}
      </div>
    </div>
  )
}
