'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@/hooks/useWallet'
import { ConnectButton } from '@/components/wallet/ConnectButton'
import { PositionList } from '@/components/positions/PositionList'
import { usePositions } from '@/hooks/usePositions'
import { formatUsd } from '@/lib/utils/formatting'
import { useSequenceModal } from '@/hooks/useSequenceModal'
import { SequenceModal } from '@/components/sequence/SequenceModal'

export default function Dashboard() {
  const { isConnected, disconnect, isMounted } = useWallet()
  const router = useRouter()
  const { positions, isLoading, error, refetch, totalValueUsd, totalRewardsUsd } = usePositions()
  const { isOpen, options, openModal, closeModal } = useSequenceModal()

  useEffect(() => {
    if (isMounted && !isConnected) {
      router.push('/')
    }
  }, [isConnected, isMounted, router])

  if (!isMounted || !isConnected) {
    return null
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold tracking-tight">Verdant</h1>
            {!isLoading && positions.length > 0 && (
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-zinc-500">Portfolio </span>
                  <span className="font-semibold text-zinc-100">{formatUsd(totalValueUsd)}</span>
                </div>
                {totalRewardsUsd > 1 && (
                  <div>
                    <span className="text-zinc-500">Claimable </span>
                    <span className="font-semibold text-emerald-400">{formatUsd(totalRewardsUsd)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => openModal()}
              className="text-sm bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition-colors font-medium cursor-pointer"
            >
              Sequence
            </button>
            <ConnectButton />
            <button
              onClick={() => disconnect()}
              className="px-3 py-2 text-sm text-zinc-400 hover:text-red-400 transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Your Positions</h2>
          <button
            onClick={refetch}
            disabled={isLoading}
            className="text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="bg-amber-900/30 border border-amber-800 text-amber-200 text-sm px-4 py-3 rounded-lg mb-6">
            ⚠️ {error}
          </div>
        )}

        <PositionList 
          positions={positions} 
          isLoading={isLoading} 
          onSequence={(template, params) => openModal({ template, params })}
        />
      </main>

      <SequenceModal
        isOpen={isOpen}
        onClose={closeModal}
        initialTemplate={options.template}
        initialParams={options.params}
      />
    </div>
  )
}
