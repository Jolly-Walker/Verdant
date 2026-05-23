'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePositions } from '@/hooks/usePositions'
import { useSequencer } from '@/hooks/useSequencer'
import { useWallet } from '@/hooks/useWallet'
import { DEMO_WALLET_ADDRESS } from '@/lib/demo/wallet'
import { BuilderStep, TokenState, ActionType, DepositDestination } from '@/lib/sequenceBuilder/types'
import { canSubmit, builderStepsToSequencePlan } from '@/lib/sequenceBuilder/logic'
import { SourceCard } from './SourceCard'
import { ActionSelectCard } from './ActionSelectCard'
import { DepositCard } from './DepositCard'
import { RepayCard } from './RepayCard'
import { RepayAndWithdrawCard } from './RepayAndWithdrawCard'
import { BridgeCard } from './BridgeCard'
import { SwapCard } from './SwapCard'
import { WithdrawCard } from './WithdrawCard'
import { SummaryBar } from './SummaryBar'
import { ChainId, BridgeId } from '@/types/shared'

interface SequenceBuilderModalProps {
  isOpen: boolean
  onClose: () => void
  initialPositionId?: string
}

export function SequenceBuilderModal({
  isOpen,
  onClose,
  initialPositionId
}: SequenceBuilderModalProps) {
  const router = useRouter()
  const { positions } = usePositions()
  const { createPlan } = useSequencer()
  const { address } = useWallet()
  const [isExecuting, setIsExecuting] = useState(false)

  // Initialize steps array
  const [steps, setSteps] = useState<BuilderStep[]>([
    { kind: 'source', tokenOut: { token: '', chain: 'ethereum', amount: 0, amountUsd: 0 } }
  ])
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0)

  // Sync / pre-seed from initialPositionId
  useEffect(() => {
    if (isOpen && initialPositionId && positions.length > 0) {
      const pos = positions.find(p => p.id === initialPositionId)
      if (pos && pos.positionType !== 'borrow') {
        const tokenOut: TokenState = {
          token: pos.asset,
          chain: pos.chain,
          amount: pos.amount,
          amountUsd: pos.amountUsd,
          sourcePositionId: pos.id,
          positionType: pos.positionType === 'supply' ? 'supply' : 'wallet'
        }
        setSteps([
          { kind: 'source', tokenOut },
          { kind: 'action-select', tokenIn: tokenOut }
        ])
        setActiveStepIndex(1)
      }
    } else if (isOpen && !initialPositionId) {
      // Reset
      setSteps([
        { kind: 'source', tokenOut: { token: '', chain: 'ethereum', amount: 0, amountUsd: 0 } }
      ])
      setActiveStepIndex(0)
    }
  }, [isOpen, initialPositionId, positions])

  if (!isOpen) return null

  const handleStepFocus = (idx: number) => {
    setActiveStepIndex(idx)
  }

  // Truncates subsequent steps when a change occurs at idx
  const updateStepsAndTruncate = (idx: number, newStep: BuilderStep) => {
    const updated = steps.slice(0, idx + 1)
    updated[idx] = newStep
    setSteps(updated)
  }

  // Step event handlers
  const handleSourceSelect = (tokenOut: TokenState) => {
    const newStep: BuilderStep = { kind: 'source', tokenOut }
    const updated = [newStep, { kind: 'action-select', tokenIn: tokenOut } as BuilderStep]
    setSteps(updated)
    setActiveStepIndex(1)
  }

  const handleActionSelect = (action: ActionType) => {
    const currentStep = steps[activeStepIndex]
    if (currentStep.kind !== 'action-select') return

    const tokenIn = currentStep.tokenIn
    let newStep: BuilderStep

    switch (action) {
      case 'deposit':
        newStep = { kind: 'deposit', tokenIn, destination: {} as DepositDestination }
        break
      case 'repay':
        newStep = { kind: 'repay', tokenIn, targetPositionId: '' }
        break
      case 'withdraw':
        newStep = { kind: 'withdraw', tokenIn, sourcePositionId: tokenIn.sourcePositionId || '', tokenOut: {} as TokenState }
        break
      case 'repayAndWithdraw':
        newStep = { kind: 'repayAndWithdraw', tokenIn, targetPositionId: '', tokenOut: {} as TokenState }
        break
      case 'bridge':
        newStep = { kind: 'bridge', tokenIn, toChain: '' as ChainId, bridgeId: '' as BridgeId, feeUsd: 0, tokenOut: {} as TokenState }
        break
      case 'swap':
        newStep = { kind: 'swap', tokenIn, toToken: '', feeUsd: 0, tokenOut: {} as TokenState }
        break
    }

    updateStepsAndTruncate(activeStepIndex, newStep)
  }

  const handleDepositSelect = (destination: DepositDestination) => {
    const currentStep = steps[activeStepIndex]
    if (currentStep.kind !== 'deposit') return

    const updatedStep: BuilderStep = { ...currentStep, destination }
    updateStepsAndTruncate(activeStepIndex, updatedStep)
  }

  const handleRepaySelect = (targetPositionId: string) => {
    const currentStep = steps[activeStepIndex]
    if (currentStep.kind !== 'repay') return

    const updatedStep: BuilderStep = { ...currentStep, targetPositionId }
    updateStepsAndTruncate(activeStepIndex, updatedStep)
  }

  const handleWithdrawConfirm = (tokenOut: TokenState) => {
    const currentStep = steps[activeStepIndex]
    if (currentStep.kind !== 'withdraw') return

    const updatedStep: BuilderStep = { ...currentStep, tokenOut }
    const updated = steps.slice(0, activeStepIndex + 1)
    updated[activeStepIndex] = updatedStep
    updated.push({ kind: 'action-select', tokenIn: tokenOut })
    setSteps(updated)
    setActiveStepIndex(activeStepIndex + 1)
  }

  const handleRepayAndWithdrawSelect = (targetPositionId: string, tokenOut: TokenState) => {
    const currentStep = steps[activeStepIndex]
    if (currentStep.kind !== 'repayAndWithdraw') return

    const updatedStep: BuilderStep = { ...currentStep, targetPositionId, tokenOut }
    const updated = steps.slice(0, activeStepIndex + 1)
    updated[activeStepIndex] = updatedStep
    updated.push({ kind: 'action-select', tokenIn: tokenOut })
    setSteps(updated)
    setActiveStepIndex(activeStepIndex + 1)
  }

  const handleBridgeSelect = (toChain: ChainId, bridgeId: BridgeId, feeUsd: number, tokenOut: TokenState) => {
    const currentStep = steps[activeStepIndex]
    if (currentStep.kind !== 'bridge') return

    const updatedStep: BuilderStep = { ...currentStep, toChain, bridgeId, feeUsd, tokenOut }
    const updated = steps.slice(0, activeStepIndex + 1)
    updated[activeStepIndex] = updatedStep
    updated.push({ kind: 'action-select', tokenIn: tokenOut })
    setSteps(updated)
    setActiveStepIndex(activeStepIndex + 1)
  }

  const handleSwapSelect = (toToken: string, feeUsd: number, tokenOut: TokenState) => {
    const currentStep = steps[activeStepIndex]
    if (currentStep.kind !== 'swap') return

    const updatedStep: BuilderStep = { ...currentStep, toToken, feeUsd, tokenOut }
    const updated = steps.slice(0, activeStepIndex + 1)
    updated[activeStepIndex] = updatedStep
    updated.push({ kind: 'action-select', tokenIn: tokenOut })
    setSteps(updated)
    setActiveStepIndex(activeStepIndex + 1)
  }

  const handleExecute = async () => {
    if (!canSubmit(steps)) return
    setIsExecuting(true)

    try {
      const activeAddress = address || DEMO_WALLET_ADDRESS
      const customPlan = builderStepsToSequencePlan(steps, activeAddress, positions)

      const plan = await createPlan('custom', { customPlan })
      if (plan) {
        onClose()
        router.push(`/sequence/${plan.id}`)
      }
    } catch (e) {
      console.error(e)
      alert('Failed to execute sequence')
    } finally {
      setIsExecuting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-[#1A1614]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="max-w-5xl w-full bg-verdant-surface rounded-2xl shadow-organic-lg border border-[#E5E0D8] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="border-b border-[#E5E0D8] px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-verdant-text-primary">
            Build a Sequence
          </h2>
          <button
            onClick={onClose}
            className="text-verdant-text-muted hover:text-verdant-text-primary p-1 rounded-md transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Steps Grid */}
        <div className="flex-1 overflow-y-auto px-6 py-6 min-h-[300px]">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 gap-y-8">
            {steps.map((step, idx) => {
              const isActive = idx === activeStepIndex
              return (
                <div key={idx} className="relative flex justify-center">
                  {step.kind === 'source' && (
                    <SourceCard
                      step={step}
                      isActive={isActive}
                      userPositions={positions}
                      onSelect={handleSourceSelect}
                      onFocus={() => handleStepFocus(idx)}
                    />
                  )}

                  {step.kind === 'action-select' && (
                    <ActionSelectCard
                      tokenIn={step.tokenIn}
                      userPositions={positions}
                      onSelect={handleActionSelect}
                    />
                  )}

                  {step.kind === 'deposit' && (
                    <DepositCard
                      tokenIn={step.tokenIn}
                      selectedDestination={step.destination.id ? step.destination : undefined}
                      isActive={isActive}
                      onSelect={handleDepositSelect}
                      onFocus={() => handleStepFocus(idx)}
                    />
                  )}

                  {step.kind === 'repay' && (
                    <RepayCard
                      tokenIn={step.tokenIn}
                      userPositions={positions}
                      selectedPositionId={step.targetPositionId || undefined}
                      isActive={isActive}
                      onSelect={handleRepaySelect}
                      onFocus={() => handleStepFocus(idx)}
                    />
                  )}

                  {step.kind === 'repayAndWithdraw' && (
                    <RepayAndWithdrawCard
                      tokenIn={step.tokenIn}
                      userPositions={positions}
                      selectedPositionId={step.targetPositionId || undefined}
                      isActive={isActive}
                      onSelect={handleRepayAndWithdrawSelect}
                      onFocus={() => handleStepFocus(idx)}
                    />
                  )}

                  {step.kind === 'bridge' && (
                    <BridgeCard
                      tokenIn={step.tokenIn}
                      selectedToChain={step.toChain || undefined}
                      selectedBridgeId={step.bridgeId || undefined}
                      selectedFeeUsd={step.feeUsd || undefined}
                      isActive={isActive}
                      onSelect={handleBridgeSelect}
                      onFocus={() => handleStepFocus(idx)}
                    />
                  )}

                  {step.kind === 'swap' && (
                    <SwapCard
                      tokenIn={step.tokenIn}
                      selectedToToken={step.toToken || undefined}
                      selectedFeeUsd={step.feeUsd || undefined}
                      isActive={isActive}
                      onSelect={handleSwapSelect}
                      onFocus={() => handleStepFocus(idx)}
                    />
                  )}

                  {step.kind === 'withdraw' && (
                    <WithdrawCard
                      tokenIn={step.tokenIn}
                      isActive={isActive}
                      onConfirm={handleWithdrawConfirm}
                      onFocus={() => handleStepFocus(idx)}
                    />
                  )}

                  {/* Right arrow connector */}
                  {idx < steps.length - 1 && (
                    <span className="absolute -right-5 top-1/2 -translate-y-1/2 text-verdant-text-muted text-lg hidden sm:block pointer-events-none select-none">
                      →
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer/Summary */}
        <SummaryBar
          steps={steps}
          onCancel={onClose}
          onExecute={handleExecute}
          isExecuting={isExecuting}
        />
      </div>
    </div>
  )
}
