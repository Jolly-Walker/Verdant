'use client'

import React from 'react'
import { SimulationResult } from '@/types/sequencer'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface SimulationResultViewProps {
  result: SimulationResult
}

export function SimulationResultView({ result }: SimulationResultViewProps) {
  if (!result.success) {
    return (
      <Card className="border-red-900/50 bg-red-900/10">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-red-400 font-medium">
            <span>Simulation Failed</span>
            <Badge variant="error">REVERT</Badge>
          </div>
          <p className="text-sm text-red-300/80">
            {result.revertReason || 'The transaction is expected to fail on-chain.'}
          </p>
          {result.revertData && (
            <div className="mt-2 p-2 bg-black/40 rounded text-[10px] font-mono text-red-400 break-all overflow-auto max-h-24">
              {result.revertData}
            </div>
          )}
        </div>
      </Card>
    )
  }

  return (
    <Card className="border-emerald-900/30 bg-emerald-900/5">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400 font-medium">
            <span>Simulation Success</span>
            <Badge variant="success">READY</Badge>
          </div>
          {result.gasCostUsd !== undefined && (
            <div className="text-xs text-zinc-400">
              Est. Gas: <span className="text-zinc-200">${result.gasCostUsd.toFixed(2)}</span>
            </div>
          )}
        </div>

        {result.stateChanges && result.stateChanges.length > 0 && (
          <div className="flex flex-col gap-2">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Expected Balance Changes</h4>
            <div className="flex flex-col gap-1">
              {result.stateChanges.map((change, idx) => {
                const isPositive = change.change.startsWith('+')
                return (
                  <div key={idx} className="flex items-center justify-between text-sm py-1 border-b border-zinc-800/50 last:border-0">
                    <span className="text-zinc-400">{change.asset}</span>
                    <span className={`font-medium ${isPositive ? 'text-emerald-400' : 'text-zinc-200'}`}>
                      {change.change}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {(!result.stateChanges || result.stateChanges.length === 0) && (
          <p className="text-xs text-zinc-500 italic">
            No significant balance changes detected.
          </p>
        )}
      </div>
    </Card>
  )
}
