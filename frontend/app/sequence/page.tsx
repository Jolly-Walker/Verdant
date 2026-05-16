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
  const [borrowAsset, setBorrowAsset] = useState('USDC');
  const [collateralAsset, setCollateralAsset] = useState('ETH');
  const [amount, setAmount] = useState('100');
  const [cycles, setCycles] = useState(2);
  const [fromChain, setFromChain] = useState<ChainId>('ethereum');
  const [toChain, setToChain] = useState<ChainId>('arbitrum');
  const [toProtocol, setToProtocol] = useState<ProtocolId>('aave');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedTemplate) return;
    setIsSubmitting(true);
    
    try {
      let params: TemplateParams = {};
      if (selectedTemplate === 'bridgeAndDeposit') {
        params = {
          asset,
          amount,
          fromChain,
          toChain,
          fromProtocol: 'wallet',
          toProtocol
        };
      } else if (selectedTemplate === 'repayAndWithdraw') {
        params = {
          borrowAsset,
          borrowAmount: amount,
          collateralAsset,
          collateralAmount: '1',
          protocol: toProtocol,
          chain: fromChain
        };
      } else if (selectedTemplate === 'crossChainRebalance') {
        params = {
          asset,
          amount,
          fromProtocol: 'aave',
          fromChain,
          toProtocol,
          toChain
        };
      } else if (selectedTemplate === 'deleverageAave') {
        params = {
          borrowAsset,
          collateralAsset,
          totalDebt: amount,
          totalCollateral: '1',
          initialHealthFactor: 2.5,
          cycles,
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
        <div className="bg-gray-50 rounded-xl p-8 max-w-xl mx-auto">
          <h2 className="font-bold text-xl mb-6">Configure Parameters</h2>
          
          <div className="space-y-4">
            {(selectedTemplate === 'repayAndWithdraw' || selectedTemplate === 'deleverageAave') ? (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Borrow Asset (to repay)</label>
                  <select className="w-full border rounded p-2" value={borrowAsset} onChange={e => setBorrowAsset(e.target.value)}>
                    <option value="USDC">USDC</option>
                    <option value="USDT">USDT</option>
                    <option value="DAI">DAI</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Collateral Asset (to withdraw)</label>
                  <select className="w-full border rounded p-2" value={collateralAsset} onChange={e => setCollateralAsset(e.target.value)}>
                    <option value="ETH">ETH</option>
                    <option value="wstETH">wstETH</option>
                    <option value="WBTC">WBTC</option>
                  </select>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-1">Asset</label>
                <select className="w-full border rounded p-2" value={asset} onChange={e => setAsset(e.target.value)}>
                  <option value="USDC">USDC</option>
                  <option value="ETH">ETH</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">
                {selectedTemplate === 'deleverageAave' ? 'Total Debt Amount' : 'Amount'}
              </label>
              <input type="number" className="w-full border rounded p-2" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            {selectedTemplate === 'deleverageAave' && (
              <div>
                <label className="block text-sm font-medium mb-1">Unwind Cycles</label>
                <input type="number" min="1" max="10" className="w-full border rounded p-2" value={cycles} onChange={e => setCycles(parseInt(e.target.value) || 1)} />
                <p className="text-xs text-gray-500 mt-1">Higher cycles are safer but cost more gas.</p>
              </div>
            )}
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
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="mt-8 w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Creating Plan...' : 'Create Sequence Plan'}
          </button>
        </div>
      )}
    </div>
  );
}
