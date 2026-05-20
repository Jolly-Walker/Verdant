'use client'

import { useState } from 'react'
import { useWallet } from '@/hooks/useWallet'
import { useSequencer } from '@/hooks/useSequencer'
import { AssetSelector } from '@/components/execute/AssetSelector'
import { TemplateSelector } from '@/components/sequence/TemplateSelector'
import { CostPreview } from '@/components/execute/CostPreview'
import { SequencePlanView } from '@/components/sequence/SequencePlanView'
import { Card } from '@/components/ui/Card'
import { ProtocolId, ChainId } from '@/types/shared'

export default function ExecutePage() {
  const { evmAddress } = useWallet()
  const { plan, createPlan, reset } = useSequencer()
  const [selectedAsset, setSelectedAsset] = useState('USDC')
  const [amount, setAmount] = useState('1000')
  
  // These should ideally be selected by the user or derived from the template
  const [sourceProtocol, setSourceProtocol] = useState<ProtocolId>('aave')
  const [sourceChain, setSourceChain] = useState<ChainId>('ethereum')
  const [destProtocol, setDestProtocol] = useState<ProtocolId>('morpho')
  const [destChain, setDestChain] = useState<ChainId>('base')

  const handleCreatePlan = async (templateId: string) => {
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
        <SequencePlanView plan={plan} onBack={reset} />
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
            <h2 className="text-xl font-semibold text-white mb-4">1. Asset & Amount</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AssetSelector 
                selectedAsset={selectedAsset} 
                onSelect={setSelectedAsset} 
              />
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Amount</label>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-zinc-800 border-zinc-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="0.00"
                />
              </div>
            </div>
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
