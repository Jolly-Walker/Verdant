'use client'

import React from 'react'
import { SimulationResult } from '@/types/sequencer'
import { Badge } from '@/components/ui/Badge'

interface SimulationResultViewProps {
  result: SimulationResult
}

export function SimulationResultView({ result }: SimulationResultViewProps) {
  if (!result.success) {
    return (
      <div className="border border-red-200 bg-red-50 rounded-lg p-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-verdant-loss font-semibold">
            <span>Simulation Failed</span>
            <Badge variant="error">REVERT</Badge>
          </div>
          <p className="text-sm text-verdant-loss font-mono">
            {result.revertReason || 'The transaction is expected to fail on-chain.'}
          </p>
          {result.revertData && (
            <div className="mt-2 p-2 bg-red-50/50 border border-red-100 rounded text-[10px] font-mono text-verdant-loss break-all overflow-auto max-h-24">
              {result.revertData}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-verdant-surface-accent border border-[#D5E8E0] rounded-lg p-5">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-verdant-profit font-semibold">
            <span>Simulation Success</span>
            <Badge variant="success">READY</Badge>
          </div>
          {result.gasCostUsd !== undefined && (
            <div className="text-xs text-verdant-text-muted">
              Est. Gas: <span className="text-verdant-text-primary font-mono font-semibold">${result.gasCostUsd.toFixed(2)}</span>
            </div>
          )}
        </div>

        {result.stateChanges && result.stateChanges.length > 0 && (
          <div className="flex flex-col gap-2">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-verdant-text-muted">Expected Balance Changes</h4>
            <div className="flex flex-col gap-1">
              {result.stateChanges.map((change, idx) => {
                const isPositive = change.change.startsWith('+')
                return (
                  <div key={idx} className="flex items-center justify-between text-sm py-1 border-b border-[#E5E0D8] last:border-0">
                    <span className="text-verdant-text-muted">{change.asset}</span>
                    <span className={`font-mono text-sm ${isPositive ? 'text-verdant-profit' : 'text-verdant-text-primary'}`}>
                      {change.change}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {(!result.stateChanges || result.stateChanges.length === 0) && (
          <p className="text-xs text-verdant-text-muted italic">
            No significant balance changes detected.
          </p>
        )}
      </div>
    </div>
  )
}
