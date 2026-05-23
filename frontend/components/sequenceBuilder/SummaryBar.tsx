'use client'

import React from 'react'
import { BuilderStep } from '@/lib/sequenceBuilder/types'
import { computeTokenDelta, canSubmit } from '@/lib/sequenceBuilder/logic'
import { formatUsd, formatToken } from '@/lib/utils/formatting'

interface SummaryBarProps {
  steps: BuilderStep[]
  onCancel: () => void
  onExecute: () => void
  isExecuting?: boolean
}

export function SummaryBar({
  steps,
  onCancel,
  onExecute,
  isExecuting = false
}: SummaryBarProps) {
  const isComplete = canSubmit(steps)
  const delta = computeTokenDelta(steps)

  // Calculate gas fee: flat $1.30 per non-bridge transaction step
  const gasStepCount = steps.filter(
    s => s.kind === 'deposit' ||
         s.kind === 'repay' ||
         s.kind === 'withdraw' ||
         s.kind === 'repayAndWithdraw' ||
         s.kind === 'swap'
  ).length
  const gasFee = gasStepCount * 1.30

  const totalFeeWithGas = delta.totalFeeUsd + gasFee

  return (
    <div className="border-t border-[#E5E0D8] bg-[#FAF9F6]/50">
      {/* 1. Summary details */}
      <div className="px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-[#E5E0D8]/60">
        {isComplete && delta.input && delta.output ? (
          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-mono text-verdant-text-primary">
                -{formatToken(delta.input.amount)} {delta.input.token} ({delta.input.chain})
              </span>
              <span className="text-verdant-text-muted">→</span>
              <span className="font-mono font-bold text-verdant-profit">
                +{formatToken(delta.output.amount)} {delta.output.token} ({delta.output.chain})
              </span>
            </div>
            
            <div className="text-xs text-verdant-text-muted mt-1">
              Est. fees:{' '}
              <span className="font-mono font-semibold text-verdant-text-primary">
                {formatUsd(totalFeeWithGas)}
              </span>{' '}
              <span className="font-sans">
                ({delta.feeBreakdown.map(f => `${f.label} ${formatUsd(f.feeUsd)}`).join(' · ')}
                {delta.feeBreakdown.length > 0 ? ' · ' : ''}
                Gas ~{formatUsd(gasFee)})
              </span>
            </div>
          </div>
        ) : (
          <div className="text-sm text-verdant-text-muted italic py-1">
            Complete your sequence to see the full summary.
          </div>
        )}
      </div>

      {/* 2. Action buttons */}
      <div className="px-6 py-4 flex items-center justify-between">
        <button
          onClick={onCancel}
          disabled={isExecuting}
          className="text-sm text-verdant-text-muted hover:text-verdant-loss transition-colors font-medium cursor-pointer disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          onClick={onExecute}
          disabled={!isComplete || isExecuting}
          className="text-sm bg-verdant-moss hover:bg-verdant-moss-dark text-white px-5 py-2.5 rounded-lg transition-colors font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm"
        >
          {isExecuting ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Executing...
            </>
          ) : (
            'Execute Sequence →'
          )}
        </button>
      </div>
    </div>
  )
}
