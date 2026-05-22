'use client'

import React from 'react'
import { useHarvest } from '@/hooks/useHarvest'
import { ChainId } from '@/types/shared'
import { Spinner } from '@/components/ui/Spinner'

interface HarvestButtonProps {
  protocol: string
  chain: ChainId
  rewardsUsd: number
  onSuccess?: () => void
  className?: string
}

export function HarvestButton({
  protocol,
  chain,
  rewardsUsd,
  onSuccess,
  className = '',
}: HarvestButtonProps) {
  const { harvest, isSimulating, isSigning, error } = useHarvest()
  const isDisabled = rewardsUsd < 0.01 || isSimulating || isSigning

  const handleClick = async () => {
    if (isDisabled) return
    try {
      await harvest(protocol, chain)
      onSuccess?.()
    } catch {
      // error already captured in hook state
    }
  }

  const label = isSimulating
    ? 'Simulating…'
    : isSigning
    ? 'Sign in wallet…'
    : 'Claim Rewards'

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        id={`harvest-btn-${protocol}-${chain}`}
        onClick={handleClick}
        disabled={isDisabled}
        className={`
          inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold
          transition-all duration-150
          ${isDisabled
            ? (isSimulating || isSigning
                ? 'bg-verdant-moss text-white opacity-50 cursor-not-allowed'
                : 'bg-verdant-surface-accent text-verdant-text-muted/50 border border-[#E5E0D8] cursor-not-allowed')
            : 'bg-verdant-moss hover:bg-verdant-moss-dark text-white'
          }
          ${className}
        `}
      >
        {(isSimulating || isSigning) && <Spinner size="sm" />}
        {label}
      </button>
      {error && (
        <p className="text-verdant-loss text-xs max-w-xs text-right font-mono">{error}</p>
      )}
    </div>
  )
}
