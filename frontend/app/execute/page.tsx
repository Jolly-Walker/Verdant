'use client'

import { useState } from 'react'
import { useWallet } from '@/hooks/useWallet'
import { useSequencer } from '@/hooks/useSequencer'
import { AssetSelector } from '@/components/execute/AssetSelector'
import { TemplateSelector } from '@/components/sequence/TemplateSelector'
import { CostPreview } from '@/components/execute/CostPreview'
import { SequencePlanView } from '@/components/sequence/SequencePlanView'
import { Card } from '@/components/ui/Card'

export default function ExecutePage() {
  const { evmAddress } = useWallet()
  const { plan, createPlan, reset } = useSequencer()
  const [selectedAsset, setSelectedAsset] = useState('USDC')
  const [amount, setAmount] = useState('1000')

  const handleCreatePlan = async (templateId: string, params: Record<string, unknown>) => {
    if (!evmAddress) return
    await createPlan(templateId, {
      ...params,
      asset: selectedAsset,
      amount,
      walletAddress: evmAddress,
    })
  }

  if (plan) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <SequencePlanView plan={plan} onBack={reset} />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold text-white mb-8">Execute Sequence</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card className="p-6 bg-zinc-900 border-zinc-800">
            <h2 className="text-xl font-semibold text-white mb-4">1. Select Asset & Amount</h2>
            <div className="space-y-4">
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

          <TemplateSelector onSelect={handleCreatePlan} />
        </div>

        <div>
          <CostPreview 
            asset={selectedAsset}
            amount={amount}
          />
        </div>
      </div>
    </div>
  )
}
