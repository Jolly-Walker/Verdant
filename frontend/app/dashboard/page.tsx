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
    <div className="min-h-screen bg-verdant-canvas text-verdant-text-primary">
      <header className="border-b border-[#E5E0D8] bg-verdant-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold tracking-tight text-verdant-text-primary">Verdant</h1>
            {!isLoading && positions.length > 0 && (
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-verdant-text-muted">Portfolio </span>
                  <span className="font-semibold text-verdant-text-primary font-mono">{formatUsd(totalValueUsd)}</span>
                </div>
                {totalRewardsUsd > 1 && (
                  <div>
                    <span className="text-verdant-text-muted">Claimable </span>
                    <span className="font-semibold text-verdant-profit font-mono">{formatUsd(totalRewardsUsd)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => openModal()}
              className="text-sm bg-verdant-moss hover:bg-verdant-moss-dark text-white px-4 py-2 rounded-md transition-colors font-semibold cursor-pointer"
            >
              Sequence
            </button>
            <ConnectButton />
            <button
              onClick={() => disconnect()}
              className="px-3 py-2 text-sm text-verdant-text-muted hover:text-verdant-loss transition-colors font-medium"
            >
              Disconnect
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && (
          <div className="mb-6 px-4 py-3 bg-verdant-surface-accent border border-[#D5E8E0] rounded-lg text-sm text-verdant-text-muted flex items-center gap-2">
            <span className="text-verdant-moss font-semibold">Demo Mode</span>
            {' — '}Positions and transactions are simulated. No wallet connected, no real funds.
          </div>
        )}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-verdant-text-primary">Your Positions</h2>
          <button
            onClick={refetch}
            disabled={isLoading}
            className="text-sm border border-[#E5E0D8] text-verdant-text-muted hover:border-verdant-moss hover:text-verdant-moss disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm px-4 py-3 rounded-lg mb-6">
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
