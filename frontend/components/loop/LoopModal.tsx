'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Position } from '@/types/position'
import { useSequencer } from '@/hooks/useSequencer'
import { computeOptimalCycles } from '@/lib/sequencer/templates/deleverageAave'
import { formatUsd, formatToken, formatPercent } from '@/lib/utils/formatting'
import { Badge } from '../ui/Badge'
import { TemplateParams } from '@/types/sequencer'

interface LoopModalProps {
  isOpen: boolean
  onClose: () => void
  position: Position
  collateralPosition?: Position
}

export function LoopModal({
  isOpen,
  onClose,
  position,
  collateralPosition
}: LoopModalProps) {
  const router = useRouter()
  const { createPlan } = useSequencer()
  const [activeTab, setActiveTab] = useState<'deleverage' | 'leverage'>('deleverage')
  const [isExecuting, setIsExecuting] = useState(false)

  // Deleverage settings
  const [cycles, setCycles] = useState<number>(3)

  // Leverage settings
  const [multiplier, setMultiplier] = useState<number>(2.0)
  const [borrowAsset, setBorrowAsset] = useState<string>(position.asset)

  // Compute optimal cycles for Deleverage
  useEffect(() => {
    if (isOpen && position) {
      const debtUsd = position.amountUsd
      const collUsd = collateralPosition?.amountUsd || 1.0
      const hf = position.healthFactor || 2.5
      const lt = (hf * debtUsd) / collUsd
      const optCycles = computeOptimalCycles(debtUsd, collUsd, lt)
      setCycles(optCycles)
    }
  }, [isOpen, position, collateralPosition])

  if (!isOpen) return null

  // Deleverage math
  const collateralPrice = collateralPosition && collateralPosition.amount > 0
    ? collateralPosition.amountUsd / collateralPosition.amount
    : 1
  const debtAmountInCollateral = position.amountUsd / collateralPrice
  const freedCollateralAmount = collateralPosition
    ? Math.max(collateralPosition.amount - debtAmountInCollateral, 0)
    : 0
  const freedCollateralUsd = collateralPosition
    ? Math.max(collateralPosition.amountUsd - position.amountUsd, 0)
    : 0
  const netGainVsInstant = Math.round(position.amountUsd * 0.003) // ~0.3% savings

  // Leverage math
  const currentCollateralUsd = collateralPosition?.amountUsd || 0
  const newCollateralUsd = currentCollateralUsd * multiplier
  const newDebtUsd = newCollateralUsd - currentCollateralUsd
  const estHealthFactor = newDebtUsd > 0 ? (newCollateralUsd * 0.82) / newDebtUsd : 99.9

  // Health Factor styling
  const getHealthFactorColor = (hf: number) => {
    if (hf < 1.5) return 'text-verdant-loss font-semibold'
    if (hf < 2.0) return 'text-amber-600 font-semibold'
    return 'text-verdant-profit font-semibold'
  }

  const handleExecuteDeleverage = async () => {
    if (!collateralPosition) return
    setIsExecuting(true)

    try {
      const params: TemplateParams = {
        borrowAsset: position.asset,
        collateralAsset: collateralPosition.asset,
        totalDebt: position.amount.toString(),
        totalCollateral: collateralPosition.amount.toString(),
        totalDebtUsd: position.amountUsd,
        totalCollateralUsd: collateralPosition.amountUsd,
        initialHealthFactor: position.healthFactor || 2.0,
        cycles,
        protocol: position.protocol,
        chain: position.chain,
        walletAddress: '',
        amountUsd: position.amountUsd
      }

      const plan = await createPlan('deleverageAave', params)
      if (plan) {
        onClose()
        router.push(`/sequence/${plan.id}`)
      }
    } catch (e) {
      console.error(e)
      alert('Failed to execute deleverage plan')
    } finally {
      setIsExecuting(false)
    }
  }

  const handleExecuteLeverage = async () => {
    setIsExecuting(true)

    try {
      // Stub leverage with crossChainRebalance placeholder in demo mode
      const params: TemplateParams = {
        asset: collateralPosition?.asset || 'WETH',
        amount: (collateralPosition?.amount || 0).toString(),
        amountUsd: collateralPosition?.amountUsd || 0,
        fromProtocol: position.protocol,
        fromChain: position.chain,
        toProtocol: position.protocol,
        toChain: position.chain,
        walletAddress: '',
        slippagePercent: 0.5
      }

      const plan = await createPlan('crossChainRebalance', params)
      if (plan) {
        onClose()
        router.push(`/sequence/${plan.id}`)
      }
    } catch (e) {
      console.error(e)
      alert('Failed to execute leverage plan')
    } finally {
      setIsExecuting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-[#1A1614]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="max-w-xl w-full bg-verdant-surface rounded-2xl shadow-organic-lg border border-[#E5E0D8] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-[#E5E0D8] px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-verdant-text-primary">
            Manage Position
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

        {/* Tabs selector */}
        <div className="flex border-b border-[#E5E0D8]">
          <button
            onClick={() => setActiveTab('deleverage')}
            className={`flex-1 py-3 text-center text-sm font-semibold transition-all border-b-2 ${
              activeTab === 'deleverage'
                ? 'border-verdant-moss text-verdant-moss'
                : 'border-transparent text-verdant-text-muted hover:text-verdant-text-primary'
            }`}
          >
            Deleverage
          </button>
          <button
            onClick={() => setActiveTab('leverage')}
            className={`flex-1 py-3 text-center text-sm font-semibold transition-all border-b-2 ${
              activeTab === 'leverage'
                ? 'border-verdant-moss text-verdant-moss'
                : 'border-transparent text-verdant-text-muted hover:text-verdant-text-primary'
            }`}
          >
            Leverage
          </button>
        </div>

        {/* Tab content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-5">
          {activeTab === 'deleverage' ? (
            <>
              {/* Position details */}
              <div>
                <h3 className="text-xs font-bold text-verdant-text-muted uppercase tracking-wider mb-2">
                  Position
                </h3>
                <div className="bg-[#FAF9F6] border border-[#E5E0D8] rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-verdant-text-muted">Debt:</span>
                    <span className="font-mono text-verdant-loss font-semibold">
                      {formatToken(position.amount)} {position.asset} ({formatPercent(position.currentApy || position.borrowApy || 0)} APY)
                    </span>
                  </div>
                  {collateralPosition && (
                    <div className="flex justify-between">
                      <span className="text-verdant-text-muted">Collateral:</span>
                      <span className="font-mono text-verdant-text-primary font-medium">
                        {formatToken(collateralPosition.amount)} {collateralPosition.asset} ({formatUsd(collateralPosition.amountUsd)})
                      </span>
                    </div>
                  )}
                  {position.healthFactor !== undefined && (
                    <div className="flex justify-between pt-1 border-t border-[#E5E0D8]/60">
                      <span className="text-verdant-text-muted">Health Factor:</span>
                      <span className={`font-mono ${getHealthFactorColor(position.healthFactor)}`}>
                        {position.healthFactor.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Settings */}
              <div>
                <h3 className="text-xs font-bold text-verdant-text-muted uppercase tracking-wider mb-2">
                  Unwind Settings
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-verdant-text-primary">Cycles:</label>
                    <select
                      value={cycles}
                      onChange={(e) => setCycles(parseInt(e.target.value))}
                      className="bg-verdant-canvas text-verdant-text-primary text-xs px-3 py-1.5 rounded-lg border border-[#E5E0D8] focus:border-verdant-moss focus:outline-none font-mono"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-between text-xs text-verdant-text-muted">
                    <span>Est. gas:</span>
                    <span className="font-mono">
                      ~{formatUsd(cycles * 2.80)} ({cycles} × $2.80)
                    </span>
                  </div>
                </div>
              </div>

              {/* Summary panel */}
              <div className="bg-verdant-surface-accent border border-[#D5E8E0] rounded-xl p-4 space-y-2 text-sm">
                <div className="text-xs font-bold text-verdant-moss uppercase tracking-wider mb-1">
                  After Unwind
                </div>
                {collateralPosition && (
                  <div className="flex justify-between">
                    <span className="text-verdant-text-muted">Freed Collateral:</span>
                    <span className="font-mono text-verdant-profit font-semibold">
                      ~{formatToken(freedCollateralAmount)} {collateralPosition.asset} (~{formatUsd(freedCollateralUsd)})
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-verdant-text-muted">Remaining Debt:</span>
                  <span className="font-mono text-verdant-text-primary font-medium">$0</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-[#D5E8E0] text-xs text-verdant-moss font-semibold">
                  <span>Net gain vs. instant:</span>
                  <span className="font-mono">+{formatUsd(netGainVsInstant)} (reduced liquidation risk)</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={onClose}
                  disabled={isExecuting}
                  className="px-4 py-2 text-sm text-verdant-text-muted hover:text-verdant-loss transition-colors font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteDeleverage}
                  disabled={isExecuting || !collateralPosition}
                  className="px-5 py-2.5 bg-verdant-moss hover:bg-verdant-moss-dark text-white rounded-lg transition-colors font-semibold text-sm disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  {isExecuting ? 'Executing...' : 'Execute Deleverage →'}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Position details */}
              <div>
                <h3 className="text-xs font-bold text-verdant-text-muted uppercase tracking-wider mb-2">
                  Position
                </h3>
                <div className="bg-[#FAF9F6] border border-[#E5E0D8] rounded-xl p-4 space-y-2 text-sm">
                  {collateralPosition && (
                    <div className="flex justify-between">
                      <span className="text-verdant-text-muted">Collateral:</span>
                      <span className="font-mono text-verdant-text-primary font-semibold">
                        {formatToken(collateralPosition.amount)} {collateralPosition.asset} ({formatUsd(collateralPosition.amountUsd)})
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-verdant-text-muted">Protocol:</span>
                    <span className="font-sans text-verdant-text-primary capitalize font-medium">
                      {position.protocol === 'aave' ? 'Aave V3' : position.protocol === 'morpho' ? 'Morpho' : position.protocol} · {position.chain}
                    </span>
                  </div>
                </div>
              </div>

              {/* Settings */}
              <div>
                <h3 className="text-xs font-bold text-verdant-text-muted uppercase tracking-wider mb-2">
                  Leverage Settings
                </h3>
                
                {/* Warning Badge */}
                <div className="mb-4">
                  <Badge variant="warning">
                    Leverage increases liquidation risk
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-verdant-text-primary">Target Multiplier:</label>
                    <select
                      value={multiplier}
                      onChange={(e) => setMultiplier(parseFloat(e.target.value))}
                      className="bg-verdant-canvas text-verdant-text-primary text-xs px-3 py-1.5 rounded-lg border border-[#E5E0D8] focus:border-verdant-moss focus:outline-none font-mono"
                    >
                      <option value="1.5">1.5×</option>
                      <option value="2.0">2.0×</option>
                      <option value="2.5">2.5×</option>
                      <option value="3.0">3.0×</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-verdant-text-primary">Borrow Asset:</label>
                    <select
                      value={borrowAsset}
                      onChange={(e) => setBorrowAsset(e.target.value)}
                      className="bg-verdant-canvas text-verdant-text-primary text-xs px-3 py-1.5 rounded-lg border border-[#E5E0D8] focus:border-verdant-moss focus:outline-none font-mono"
                    >
                      <option value="USDC">USDC</option>
                      <option value="USDT">USDT</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Summary panel */}
              <div className="bg-verdant-surface-accent border border-[#D5E8E0] rounded-xl p-4 space-y-2 text-sm">
                <div className="text-xs font-bold text-verdant-moss uppercase tracking-wider mb-1">
                  After Leverage
                </div>
                <div className="flex justify-between">
                  <span className="text-verdant-text-muted">New Collateral:</span>
                  <span className="font-mono text-verdant-text-primary font-semibold">
                    ~{formatUsd(newCollateralUsd)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-verdant-text-muted">New Debt:</span>
                  <span className="font-mono text-verdant-loss font-semibold">
                    ~{formatUsd(newDebtUsd)} {borrowAsset}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-verdant-text-muted">Est. Health Factor:</span>
                  <span className={`font-mono ${getHealthFactorColor(estHealthFactor)}`}>
                    ~{estHealthFactor.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-[#D5E8E0] text-xs text-verdant-text-muted">
                  <span>Est. gas:</span>
                  <span className="font-mono">~$5.60</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={onClose}
                  disabled={isExecuting}
                  className="px-4 py-2 text-sm text-verdant-text-muted hover:text-verdant-loss transition-colors font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteLeverage}
                  disabled={isExecuting}
                  className="px-5 py-2.5 bg-verdant-moss hover:bg-verdant-moss-dark text-white rounded-lg transition-colors font-semibold text-sm disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  {isExecuting ? 'Executing...' : 'Execute Leverage →'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
