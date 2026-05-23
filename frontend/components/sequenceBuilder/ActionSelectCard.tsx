'use client'

import React from 'react'
import { Position } from '@/types/position'
import { ActionType, TokenState } from '@/lib/sequenceBuilder/types'
import { getEligibleActions } from '@/lib/sequenceBuilder/logic'

interface ActionSelectCardProps {
  tokenIn: TokenState
  userPositions: Position[]
  onSelect: (action: ActionType) => void
}

const ACTION_METADATA: Record<ActionType, { label: string; description: string }> = {
  deposit: {
    label: 'Deposit',
    description: 'Earn yield in a protocol'
  },
  repay: {
    label: 'Repay',
    description: 'Pay down existing debt'
  },
  repayAndWithdraw: {
    label: 'Repay & Withdraw',
    description: 'Repay debt, free collateral'
  },
  bridge: {
    label: 'Bridge',
    description: 'Move to another chain'
  },
  swap: {
    label: 'Swap',
    description: 'Exchange for another token'
  },
  withdraw: {
    label: 'Withdraw',
    description: 'Exit protocol position'
  }
}

export function ActionSelectCard({
  tokenIn,
  userPositions,
  onSelect
}: ActionSelectCardProps) {
  const eligibleActions = getEligibleActions(tokenIn, userPositions)

  return (
    <div className="w-56 min-h-48 bg-verdant-surface border-2 border-verdant-moss rounded-xl p-4 shadow-organic flex flex-col">
      <div className="text-[10px] text-verdant-text-muted uppercase tracking-wider font-semibold mb-2">
        ACTION
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
        {eligibleActions.map(action => {
          const meta = ACTION_METADATA[action]
          return (
            <div
              key={action}
              onClick={() => onSelect(action)}
              className="p-2 bg-verdant-surface border border-[#E5E0D8] rounded-lg cursor-pointer hover:border-verdant-moss hover:bg-verdant-surface-accent transition-all"
            >
              <div className="text-xs text-verdant-text-primary font-semibold">
                {meta.label}
              </div>
              <div className="text-[10px] text-verdant-text-muted mt-0.5 leading-snug">
                {meta.description}
              </div>
            </div>
          )
        })}
        {eligibleActions.length === 0 && (
          <div className="text-xs text-verdant-text-muted text-center py-6">
            No valid actions available.
          </div>
        )}
      </div>
    </div>
  )
}
