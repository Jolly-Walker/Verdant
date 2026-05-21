'use client'

import { useState } from 'react'
import { useWallet } from '@/hooks/useWallet'
import { useSequencer } from '@/hooks/useSequencer'
import { TemplateSelector } from '@/components/sequence/TemplateSelector'
import { CostPreview } from '@/components/execute/CostPreview'
import { SequencePlanView } from '@/components/sequence/SequencePlanView'
import { Card } from '@/components/ui/Card'
import { ProtocolId, ChainId } from '@/types/shared'
import { TemplateId } from '@/types/sequencer'

export default function ExecutePage() {
  const { evmAddress } = useWallet()
  const { plan, currentStep, createPlan, simulateStep, executeStep, reset } = useSequencer()
  const [selectedAsset] = useState('USDC')
  const [amount] = useState('1')
  
  // These should ideally be selected by the user or derived from the template
  const sourceProtocol: ProtocolId = 'aave'
  const sourceChain: ChainId = 'ethereum'
  const destProtocol: ProtocolId = 'morpho'
  const destChain: ChainId = 'base'

  const handleCreatePlan = async (templateId: TemplateId) => {
    if (!evmAddress) return
    
    // For now, we use the default params for the template
    // In a real app, clicking a template might open a configuration form
    await createPlan(templateId, {
      asset: selectedAsset,
      amount,
      amountUsd: Number(amount), // Simplified for MVP
      fromChain: sourceChain,
      toChain: destChain,
      fromProtocol: sourceProtocol,
      toProtocol: destProtocol,
      walletAddress: evmAddress,
      slippagePercent: 0.005,
    })
  }

  if (plan) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <SequencePlanView
          plan={plan}
          currentStepId={currentStep?.id || null}
          onSimulate={simulateStep}
          onSign={executeStep}
          onEdit={reset}
        />
      </div>
    )
  }

  const previewInput = {
    asset: selectedAsset,
    amountUsd: Number(amount) || 0,
    sourceProtocol,
    sourceChain,
    destProtocol,
    destChain,
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <h1 className="text-3xl font-bold text-white mb-8">Execute Sequence</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 bg-zinc-900 border-zinc-800">
            <h2 className="text-xl font-semibold text-white mb-4">1. Select Asset & Amount</h2>
            <p className="text-zinc-500 text-sm">
              Asset: <span className="text-white font-medium">{selectedAsset}</span> — 
              Amount: <span className="text-white font-medium">{amount}</span>
            </p>
            <p className="text-zinc-600 text-xs mt-2">
              Use the dashboard sequence modal to configure asset and amount.
            </p>
          </Card>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">2. Select Action</h2>
            <TemplateSelector selectedTemplate={null} onSelect={handleCreatePlan} />
          </section>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-8">
            <CostPreview input={previewInput} />
          </div>
        </div>
      </div>
    </div>
  )
}
