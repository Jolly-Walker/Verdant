"use client";

import { useEffect, useState } from 'react';
import { useSequencer } from '@/hooks/useSequencer';
import { useRouter, useSearchParams } from 'next/navigation';
import { TemplateParams, TemplateId } from '@/types/sequencer';
import { ChainId, ProtocolId } from '@/types/shared';
import { TemplateSelector } from '@/components/sequence/TemplateSelector';
import { SUPPORTED_TOKENS } from '@/constants/tokens';
import { computeOptimalCycles } from '@/lib/sequencer/templates/deleverageAave';

export default function SequenceTemplateSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { createPlan } = useSequencer();
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId | null>(null);
  
  const [asset, setAsset] = useState('USDC');
  const [borrowAsset, setBorrowAsset] = useState('USDC');
  const [collateralAsset, setCollateralAsset] = useState('ETH');
  const [amount, setAmount] = useState('100');
  const [collateralAmount, setCollateralAmount] = useState('1');
  const [healthFactor, setHealthFactor] = useState(2.5);
  const [cycles, setCycles] = useState(2);
  const [fromChain, setFromChain] = useState<ChainId>('ethereum');
  const [toChain, setToChain] = useState<ChainId>('arbitrum');
  const [fromProtocol, setFromProtocol] = useState<ProtocolId>('aave');
  const [toProtocol, setToProtocol] = useState<ProtocolId>('aave');
  
  const [ptAddress, setPtAddress] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const template = searchParams.get('template') as TemplateId;
    const assetParam = searchParams.get('asset');
    const amountParam = searchParams.get('amount');
    const ptAddressParam = searchParams.get('ptAddress');
    const chainParam = searchParams.get('chain') as ChainId;
    const protocolParam = searchParams.get('protocol') as ProtocolId;
    const borrowAssetParam = searchParams.get('borrowAsset');
    const collateralAssetParam = searchParams.get('collateralAsset');
    const collateralAmountParam = searchParams.get('collateralAmount');
    const healthFactorParam = searchParams.get('healthFactor');
    const cyclesParam = searchParams.get('cycles');

    if (template) setSelectedTemplate(template);
    if (assetParam) setAsset(assetParam);
    if (amountParam) setAmount(amountParam);
    if (ptAddressParam) setPtAddress(ptAddressParam);
    if (chainParam) setFromChain(chainParam);
    if (protocolParam) setFromProtocol(protocolParam);
    if (borrowAssetParam) setBorrowAsset(borrowAssetParam);
    if (collateralAssetParam) setCollateralAsset(collateralAssetParam);
    if (collateralAmountParam) setCollateralAmount(collateralAmountParam);
    
    let hfVal = 2.5;
    if (healthFactorParam) {
      hfVal = parseFloat(healthFactorParam) || 2.5;
      setHealthFactor(hfVal);
    }
    
    if (cyclesParam) {
      setCycles(parseInt(cyclesParam) || 2);
    } else if (template === 'deleverageAave') {
      const debtUsdParam = searchParams.get('totalDebtUsd');
      const collUsdParam = searchParams.get('totalCollateralUsd');
      if (debtUsdParam && collUsdParam) {
        const debtUsd = parseFloat(debtUsdParam);
        const collUsd = parseFloat(collUsdParam);
        if (debtUsd > 0 && collUsd > 0) {
          const lt = (hfVal * debtUsd) / collUsd;
          const optCycles = computeOptimalCycles(debtUsd, collUsd, lt);
          setCycles(optCycles);
        }
      }
    }
  }, [searchParams]);

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
          collateralAmount,
          protocol: fromProtocol,
          chain: fromChain
        };
      } else if (selectedTemplate === 'crossChainRebalance') {
        params = {
          asset,
          amount,
          fromProtocol,
          fromChain,
          toProtocol,
          toChain
        };
      } else if (selectedTemplate === 'deleverageAave') {
        params = {
          borrowAsset,
          collateralAsset,
          totalDebt: amount,
          totalCollateral: collateralAmount,
          initialHealthFactor: healthFactor,
          cycles,
          protocol: fromProtocol,
          chain: fromChain
        };
      } else if (selectedTemplate === 'exitPendle') {
        const ptAsset = asset === 'ETH' ? 'PT-eETH' : 'PT-USDC';
        const dynamicPtAddress = SUPPORTED_TOKENS[ptAsset]?.addresses[fromChain] || '';
        
        params = {
          ptAsset,
          ptAddress: ptAddress || dynamicPtAddress, 
          amount,
          underlyingAsset: asset,
          fromChain,
          toChain,
          toProtocol
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
    <div className="max-w-4xl mx-auto py-12 px-4 text-verdant-text-primary">
      <h1 className="text-3xl font-bold mb-8 text-verdant-text-primary">Choose a Sequence</h1>
      
      <TemplateSelector 
        selectedTemplate={selectedTemplate} 
        onSelect={setSelectedTemplate} 
        filter={['exitPendle']}
      />

      {selectedTemplate === 'exitPendle' && !ptAddress ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 max-w-xl mx-auto text-center mt-8">
          <p className="text-verdant-loss font-semibold">Please use the Exit button from your Pendle position.</p>
        </div>
      ) : selectedTemplate && (
        <div className="bg-verdant-surface border border-[#E5E0D8] shadow-organic rounded-xl p-8 max-w-xl mx-auto mt-8">
          <h2 className="font-bold text-xl mb-6 text-verdant-text-primary">Configure Parameters</h2>
          
          <div className="space-y-4">
            {(selectedTemplate === 'repayAndWithdraw' || selectedTemplate === 'deleverageAave') ? (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1 text-verdant-text-muted">Borrow Asset (to repay)</label>
                  <select className="w-full bg-verdant-surface border border-[#E5E0D8] rounded-md p-2 text-verdant-text-primary focus:outline-none focus:border-verdant-moss transition-colors" value={borrowAsset} onChange={e => setBorrowAsset(e.target.value)}>
                    <option value="USDC">USDC</option>
                    <option value="USDT">USDT</option>
                    <option value="DAI">DAI</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-verdant-text-muted">Collateral Asset (to withdraw)</label>
                  <select className="w-full bg-verdant-surface border border-[#E5E0D8] rounded-md p-2 text-verdant-text-primary focus:outline-none focus:border-verdant-moss transition-colors" value={collateralAsset} onChange={e => setCollateralAsset(e.target.value)}>
                    <option value="ETH">ETH</option>
                    <option value="wstETH">wstETH</option>
                    <option value="WBTC">WBTC</option>
                  </select>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-1 text-verdant-text-muted">Asset</label>
                <select className="w-full bg-verdant-surface border border-[#E5E0D8] rounded-md p-2 text-verdant-text-primary focus:outline-none focus:border-verdant-moss transition-colors" value={asset} onChange={e => setAsset(e.target.value)}>
                  <option value="USDC">USDC</option>
                  <option value="ETH">ETH</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1 text-verdant-text-muted">
                {selectedTemplate === 'deleverageAave' ? 'Total Debt Amount' : 'Amount'}
              </label>
              <input type="number" className="w-full bg-verdant-surface border border-[#E5E0D8] rounded-md p-2 text-verdant-text-primary focus:outline-none focus:border-verdant-moss transition-colors font-mono" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            {selectedTemplate === 'deleverageAave' && (
              <div>
                <label className="block text-sm font-medium mb-1 text-verdant-text-muted">Unwind Cycles</label>
                <input type="number" min="1" max="10" className="w-full bg-verdant-surface border border-[#E5E0D8] rounded-md p-2 text-verdant-text-primary focus:outline-none focus:border-verdant-moss transition-colors font-mono" value={cycles} onChange={e => setCycles(parseInt(e.target.value) || 1)} />
                <p className="text-xs text-verdant-text-muted mt-1">Higher cycles are safer but cost more gas.</p>
              </div>
            )}
            {(selectedTemplate === 'repayAndWithdraw' || selectedTemplate === 'deleverageAave') && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1 text-verdant-text-muted">Total Collateral Amount</label>
                  <input type="number" className="w-full bg-verdant-surface border border-[#E5E0D8] rounded-md p-2 text-verdant-text-primary focus:outline-none focus:border-verdant-moss transition-colors font-mono" value={collateralAmount} onChange={e => setCollateralAmount(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-verdant-text-muted">Current Health Factor</label>
                  <input type="number" step="0.1" className="w-full bg-verdant-surface border border-[#E5E0D8] rounded-md p-2 text-verdant-text-primary focus:outline-none focus:border-verdant-moss transition-colors font-mono" value={healthFactor} onChange={e => setHealthFactor(parseFloat(e.target.value) || 2.5)} />
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium mb-1 text-verdant-text-muted">From Chain</label>
              <select className="w-full bg-verdant-surface border border-[#E5E0D8] rounded-md p-2 text-verdant-text-primary focus:outline-none focus:border-verdant-moss transition-colors" value={fromChain} onChange={e => setFromChain(e.target.value as ChainId)}>
                <option value="ethereum">Ethereum</option>
                <option value="arbitrum">Arbitrum</option>
                <option value="base">Base</option>
              </select>
            </div>
            {(selectedTemplate === 'crossChainRebalance' || selectedTemplate === 'repayAndWithdraw' || selectedTemplate === 'deleverageAave') && (
              <div>
                <label className="block text-sm font-medium mb-1 text-verdant-text-muted">From Protocol</label>
                <select className="w-full bg-verdant-surface border border-[#E5E0D8] rounded-md p-2 text-verdant-text-primary focus:outline-none focus:border-verdant-moss transition-colors" value={fromProtocol} onChange={e => setFromProtocol(e.target.value as ProtocolId)}>
                  <option value="aave">Aave V3</option>
                  <option value="morpho">Morpho</option>
                  <option value="euler">Euler</option>
                </select>
              </div>
            )}
            {(selectedTemplate === 'bridgeAndDeposit' || selectedTemplate === 'crossChainRebalance' || selectedTemplate === 'exitPendle') && (
              <div>
                <label className="block text-sm font-medium mb-1 text-verdant-text-muted">To Chain</label>
                <select className="w-full bg-verdant-surface border border-[#E5E0D8] rounded-md p-2 text-verdant-text-primary focus:outline-none focus:border-verdant-moss transition-colors" value={toChain} onChange={e => setToChain(e.target.value as ChainId)}>
                  <option value="ethereum">Ethereum</option>
                  <option value="arbitrum">Arbitrum</option>
                  <option value="base">Base</option>
                </select>
              </div>
            )}
            {selectedTemplate !== 'repayAndWithdraw' && selectedTemplate !== 'deleverageAave' && selectedTemplate !== 'exitPendle' && (
              <div>
                <label className="block text-sm font-medium mb-1 text-verdant-text-muted">Destination Protocol</label>
                <select className="w-full bg-verdant-surface border border-[#E5E0D8] rounded-md p-2 text-verdant-text-primary focus:outline-none focus:border-verdant-moss transition-colors" value={toProtocol} onChange={e => setToProtocol(e.target.value as ProtocolId)}>
                  <option value="aave">Aave V3</option>
                  <option value="morpho">Morpho</option>
                  <option value="euler">Euler</option>
                </select>
              </div>
            )}
          </div>
          
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="mt-8 w-full bg-verdant-moss text-white font-bold py-3 rounded-lg hover:bg-verdant-moss-dark disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Creating Plan...' : 'Create Sequence Plan'}
          </button>
        </div>
      )}
    </div>
  );
}
