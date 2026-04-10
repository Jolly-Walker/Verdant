'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import { Position } from '@/types/position'
import { Protocol } from '@/types/protocol'
import { Chain } from '@/types/chain'
import { CostPreviewInput } from '@/types/quote'
import { usePositions } from '@/hooks/usePositions'
import { useQuote } from '@/hooks/useQuote'
import { AssetSelector } from '@/components/execute/AssetSelector'
import { ProtocolSelector } from '@/components/execute/ProtocolSelector'
import { CostPreview } from '@/components/execute/CostPreview'
import { ConnectButton } from '@/components/wallet/ConnectButton'
import { Spinner } from '@/components/ui/Spinner'

type ExecuteStep = 'select_asset' | 'select_destination' | 'preview_cost' | 'proceeding'

export default function ExecutePage() {
  const { isConnected } = useAccount()
  const router = useRouter()
  const { positions, isLoading: positionsLoading } = usePositions()

  // Step state
  const [step, setStep] = useState<ExecuteStep>('select_asset')
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [destProtocol, setDestProtocol] = useState<Protocol | null>(null)
  const [destChain, setDestChain] = useState<Chain | null>(null)

  useEffect(() => {
    if (!isConnected) {
      router.push('/')
    }
  }, [isConnected, router])

  // Build quote input when all selections are made
  const quoteInput = useMemo<CostPreviewInput | null>(() => {
    if (!selectedPosition || !destProtocol || !destChain || !customAmount) {
      return null
    }

    const amountNum = parseFloat(customAmount)
    if (isNaN(amountNum) || amountNum <= 0) return null

    const amountUsd =
      (amountNum / selectedPosition.amount) * selectedPosition.amountUsd

    const pendleMaturityMs =
      selectedPosition.protocol === 'pendle' && selectedPosition.metadata?.maturity
        ? Number(selectedPosition.metadata.maturity)
        : undefined

    return {
      asset: selectedPosition.asset,
      amountUsd,
      sourceProtocol: selectedPosition.protocol,
      sourceChain: selectedPosition.chain,
      destProtocol,
      destChain,
      pendleMaturityMs,
    }
  }, [selectedPosition, destProtocol, destChain, customAmount])

  const { quote, isLoading: quoteLoading, isStale, quoteAge, refetch } = useQuote(quoteInput)

  // Auto-advance to preview when quote arrives
  useEffect(() => {
    if (quote && step === 'select_destination') {
      setStep('preview_cost')
    }
  }, [quote, step])

  const handleSelectPosition = (p: Position) => {
    setSelectedPosition(p)
    setCustomAmount(p.amount.toString())
    setStep('select_destination')
  }

  const handleSelectDestination = (protocol: Protocol, chain: Chain) => {
    setDestProtocol(protocol)
    setDestChain(chain)
  }

  const handleProceed = () => {
    setStep('proceeding')
  }

  const handleCancel = () => {
    setStep('select_asset')
    setSelectedPosition(null)
    setCustomAmount('')
    setDestProtocol(null)
    setDestChain(null)
  }

  const handleBack = () => {
    if (step === 'preview_cost') {
      setStep('select_destination')
    } else if (step === 'select_destination') {
      setStep('select_asset')
      setSelectedPosition(null)
      setCustomAmount('')
    } else {
      router.push('/dashboard')
    }
  }

  if (!isConnected) return null

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              ← Back
            </button>
            <h1 className="text-lg font-bold">Execute</h1>
          </div>
          <ConnectButton />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {['Select Asset', 'Destination', 'Cost Preview'].map((label, i) => {
            const stepIndex =
              step === 'select_asset'
                ? 0
                : step === 'select_destination'
                  ? 1
                  : 2
            const isActive = i <= stepIndex
            return (
              <div key={label} className="flex items-center gap-2">
                {i > 0 && (
                  <div
                    className={`h-px w-8 ${isActive ? 'bg-emerald-600' : 'bg-zinc-800'}`}
                  />
                )}
                <span
                  className={`text-sm ${
                    isActive ? 'text-emerald-400 font-medium' : 'text-zinc-600'
                  }`}
                >
                  {label}
                </span>
              </div>
            )
          })}
        </div>

        {positionsLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Spinner size="lg" />
            <p className="text-zinc-400 text-sm">Loading positions...</p>
          </div>
        ) : step === 'proceeding' ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center space-y-4">
            <div className="text-4xl">🚧</div>
            <h3 className="text-xl font-semibold text-white">Bridge Step Coming Soon</h3>
            <p className="text-zinc-400 text-sm max-w-md mx-auto">
              The bridge and deposit execution flow (NEAR Intents + Across Protocol)
              will be implemented in Milestone 2. The cost preview above shows what
              you would pay.
            </p>
            <button
              onClick={handleCancel}
              className="mt-4 px-6 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
            >
              Back to Execute
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Step 0: Asset selection (always visible) */}
            <AssetSelector
              positions={positions}
              selectedPosition={selectedPosition}
              onSelect={handleSelectPosition}
              customAmount={customAmount}
              onAmountChange={setCustomAmount}
            />

            {/* Step 1: Destination selection */}
            {(step === 'select_destination' || step === 'preview_cost') &&
              selectedPosition && (
                <ProtocolSelector
                  selectedProtocol={destProtocol}
                  selectedChain={destChain}
                  onSelect={handleSelectDestination}
                  sourceProtocol={selectedPosition.protocol}
                  sourceChain={selectedPosition.chain}
                  asset={selectedPosition.asset}
                />
              )}

            {/* Step 2: Cost preview */}
            {step === 'preview_cost' &&
              selectedPosition &&
              destProtocol &&
              destChain && (
                <CostPreview
                  quote={quote}
                  isLoading={quoteLoading}
                  isStale={isStale}
                  quoteAge={quoteAge}
                  asset={selectedPosition.asset}
                  amount={parseFloat(customAmount) || 0}
                  amountUsd={quoteInput?.amountUsd || 0}
                  sourceChain={selectedPosition.chain}
                  destChain={destChain}
                  destProtocol={destProtocol}
                  onRefresh={refetch}
                  onProceed={handleProceed}
                  onCancel={handleCancel}
                />
              )}
          </div>
        )}
      </main>
    </div>
  )
}
