"use client";

import { useState } from 'react';
import { useSequencer } from '@/hooks/useSequencer';
import { useRouter } from 'next/navigation';
import { TEMPLATE_REGISTRY, TemplateId } from '@/lib/sequencer/templates';
import { TemplateParams } from '@/lib/plugins/types/sequencer';
import { ChainId, ProtocolId } from '@/lib/plugins/types/shared';

export default function SequenceTemplateSelector() {
  const router = useRouter();
  const { createPlan } = useSequencer();
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId | null>(null);
  
  const [asset, setAsset] = useState('USDC');
  const [amount, setAmount] = useState('100');
  const [fromChain, setFromChain] = useState<ChainId>('ethereum');
  const [toChain, setToChain] = useState<ChainId>('arbitrum');
  const [toProtocol, setToProtocol] = useState<ProtocolId>('aave');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    setIsSubmitting(true);
    
    try {
      let params: TemplateParams = {};
      if (selectedTemplate === 'bridgeAndDeposit') {
        params = {
          asset,
          amount,
          amountUsd: Number(amount),
          fromChain,
          toChain,
          fromProtocol: 'wallet',
          toProtocol
        };
      } else if (selectedTemplate === 'repayAndWithdraw') {
        params = {
          borrowAsset: 'USDT',
          borrowAmount: amount,
          amountUsd: Number(amount),
          collateralAsset: 'ETH',
          collateralAmount: '1',
          protocol: toProtocol,
          chain: fromChain
        };
      } else if (selectedTemplate === 'crossChainRebalance') {
        params = {
          asset,
          amount,
          amountUsd: Number(amount),
          fromProtocol: 'aave',
          fromChain,
          toProtocol,
          toChain
        };
      } else if (selectedTemplate === 'deleverageAave') {
        params = {
          borrowAsset: 'USDC',
          collateralAsset: 'ETH',
          totalDebt: amount,
          totalCollateral: '1',
          initialHealthFactor: 2.0,
          amountUsd: Number(amount),
          cycles: 2,
          protocol: 'aave',
          chain: fromChain
        };
      }

      const plan = await createPlan(selectedTemplate, params);
      if (plan) {
        router.push(`/sequence/${plan.id}`);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to create plan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-8">Choose a Sequence</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {Object.values(TEMPLATE_REGISTRY).map(template => (
          <div 
            key={template.id} 
            className={`border rounded-xl p-6 cursor-pointer hover:border-blue-500 transition-colors ${selectedTemplate === template.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}
            onClick={() => setSelectedTemplate(template.id)}
          >
            <h3 className="font-semibold text-lg mb-2">{template.displayName}</h3>
            <p className="text-gray-600 text-sm">{template.description}</p>
          </div>
        ))}
      </div>

      {selectedTemplate && (
        <form onSubmit={handleSubmit} className="bg-gray-50 rounded-xl p-8 max-w-xl mx-auto">
          <h2 className="font-bold text-xl mb-6">Configure Parameters</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Asset</label>
              <select className="w-full border rounded p-2" value={asset} onChange={e => setAsset(e.target.value)}>
                <option value="USDC">USDC</option>
                <option value="ETH">ETH</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Amount</label>
              <input type="number" className="w-full border rounded p-2" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">From Chain</label>
              <select className="w-full border rounded p-2" value={fromChain} onChange={e => setFromChain(e.target.value as ChainId)}>
                <option value="ethereum">Ethereum</option>
                <option value="arbitrum">Arbitrum</option>
                <option value="base">Base</option>
              </select>
            </div>
            {(selectedTemplate === 'bridgeAndDeposit' || selectedTemplate === 'crossChainRebalance') && (
              <div>
                <label className="block text-sm font-medium mb-1">To Chain</label>
                <select className="w-full border rounded p-2" value={toChain} onChange={e => setToChain(e.target.value as ChainId)}>
                  <option value="ethereum">Ethereum</option>
                  <option value="arbitrum">Arbitrum</option>
                  <option value="base">Base</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Destination Protocol</label>
              <select className="w-full border rounded p-2" value={toProtocol} onChange={e => setToProtocol(e.target.value as ProtocolId)}>
                <option value="aave">Aave V3</option>
                <option value="morpho">Morpho</option>
                <option value="euler">Euler</option>
              </select>
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="mt-8 w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Creating Plan...' : 'Create Sequence Plan'}
          </button>
        </form>
      )}
    </div>
  );
}
