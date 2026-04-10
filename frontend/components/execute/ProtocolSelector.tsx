'use client'

import React from 'react'
import { Protocol } from '@/types/protocol'
import { Chain } from '@/types/chain'
import { PROTOCOL_CONFIG, PROTOCOL_LIST } from '@/constants/protocols'
import { useApys } from '@/hooks/useApys'
import { formatPercent } from '@/lib/utils/formatting'
import { getChainDisplayName } from '@/lib/utils/chains'

interface ProtocolSelectorProps {
  selectedProtocol: Protocol | null
  selectedChain: Chain | null
  onSelect: (p: Protocol, c: Chain) => void
  sourceProtocol?: Protocol
  sourceChain?: Chain
  asset: string
}

export function ProtocolSelector({
  selectedProtocol,
  selectedChain,
  onSelect,
  sourceProtocol,
  sourceChain,
  asset,
}: ProtocolSelectorProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm text-zinc-500 uppercase tracking-wider font-semibold">
        Select Destination
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PROTOCOL_LIST.map((protocol) =>
          PROTOCOL_CONFIG[protocol].chains.map((chain) => {
            const isSource =
              protocol === sourceProtocol && chain === sourceChain
            const isSelected =
              protocol === selectedProtocol && chain === selectedChain

            return (
              <ProtocolOption
                key={`${protocol}-${chain}`}
                protocol={protocol}
                chain={chain}
                asset={asset}
                isSource={isSource}
                isSelected={isSelected}
                onSelect={onSelect}
              />
            )
          })
        )}
      </div>
    </div>
  )
}

function ProtocolOption({
  protocol,
  chain,
  asset,
  isSource,
  isSelected,
  onSelect,
}: {
  protocol: Protocol
  chain: Chain
  asset: string
  isSource: boolean
  isSelected: boolean
  onSelect: (p: Protocol, c: Chain) => void
}) {
  const { apy, isLoading } = useApys(protocol, chain, asset)
  const config = PROTOCOL_CONFIG[protocol]

  return (
    <button
      onClick={() => onSelect(protocol, chain)}
      disabled={isSource}
      className={`text-left px-4 py-3.5 rounded-lg border transition-colors ${
        isSource
          ? 'bg-zinc-900/50 border-zinc-800/50 text-zinc-600 cursor-not-allowed'
          : isSelected
            ? 'bg-emerald-900/20 border-emerald-800 text-white'
            : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
      }`}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="font-medium text-sm">{config.displayName}</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {getChainDisplayName(chain)}
          </p>
        </div>
        <div className="text-right">
          {isSource ? (
            <span className="text-xs text-zinc-600">Current</span>
          ) : isLoading ? (
            <span className="text-xs text-zinc-500">Loading...</span>
          ) : apy !== null ? (
            <span className="text-sm font-medium text-emerald-400">
              {formatPercent(apy)}
            </span>
          ) : (
            <span className="text-xs text-zinc-500">—</span>
          )}
        </div>
      </div>
      {isSource && (
        <p className="text-xs text-zinc-600 mt-1">
          Same as source — cannot move here
        </p>
      )}
    </button>
  )
}
