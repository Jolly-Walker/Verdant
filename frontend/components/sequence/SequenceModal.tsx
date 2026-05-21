'use client';

import React, { useEffect, useState } from 'react';
import { useSequencer } from '@/hooks/useSequencer';
import { useRouter } from 'next/navigation';
import { TemplateParams, TemplateId } from '@/types/sequencer';
import { ChainId, ProtocolId } from '@/types/shared';
import { TemplateSelector } from '@/components/sequence/TemplateSelector';
import { SUPPORTED_TOKENS } from '@/constants/tokens';
import { computeOptimalCycles } from '@/lib/sequencer/templates/deleverageAave';

interface SequenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-select a template on open */
  initialTemplate?: TemplateId;
  /** Pre-fill params from a position card */
  initialParams?: Partial<Record<string, string>>;
}

export function SequenceModal({
  isOpen,
  onClose,
  initialTemplate,
  initialParams,
}: SequenceModalProps) {
  const router = useRouter();
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

  // Reset/hydrate parameters on open/change
  useEffect(() => {
    if (!isOpen) return;

    // Reset default parameters first
    setAsset('USDC');
    setBorrowAsset('USDC');
    setCollateralAsset('ETH');
    setAmount('100');
    setCollateralAmount('1');
    setHealthFactor(2.5);
    setCycles(2);
    setFromChain('ethereum');
    setToChain('arbitrum');
    setFromProtocol('aave');
    setToProtocol('aave');
    setPtAddress('');

    if (initialTemplate) setSelectedTemplate(initialTemplate);
    else setSelectedTemplate(null);

    if (initialParams) {
      const {
        asset: assetParam,
        amount: amountParam,
        ptAddress: ptAddressParam,
        chain: chainParam,
        protocol: protocolParam,
        borrowAsset: borrowAssetParam,
        collateralAsset: collateralAssetParam,
        collateralAmount: collateralAmountParam,
        healthFactor: healthFactorParam,
        cycles: cyclesParam,
        totalDebtUsd: debtUsdParam,
        totalCollateralUsd: collUsdParam,
      } = initialParams;

      if (assetParam) setAsset(assetParam);
      if (amountParam) setAmount(amountParam);
      if (ptAddressParam) setPtAddress(ptAddressParam);
      if (chainParam) {
        setFromChain(chainParam as ChainId);
        setToChain(chainParam as ChainId); // default to same chain unless overridden
      }
      if (protocolParam) setFromProtocol(protocolParam as ProtocolId);
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
      } else if (initialTemplate === 'deleverageAave' || initialTemplate === undefined) {
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
    }
  }, [isOpen, initialTemplate, initialParams]);

  if (!isOpen) return null;

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
          toProtocol,
        };
      } else if (selectedTemplate === 'repayAndWithdraw') {
        params = {
          borrowAsset,
          borrowAmount: amount,
          collateralAsset,
          collateralAmount,
          protocol: fromProtocol,
          chain: fromChain,
        };
      } else if (selectedTemplate === 'crossChainRebalance') {
        params = {
          asset,
          amount,
          fromProtocol,
          fromChain,
          toProtocol,
          toChain,
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
          chain: fromChain,
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
          toProtocol,
        };
      }

      const plan = await createPlan(selectedTemplate, params);
      if (plan) {
        router.push(`/sequence/${plan.id}`);
        onClose();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to create plan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {/* Backdrop click listener to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] z-10 overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <h2 className="text-xl font-bold">Choose a Sequence</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-lg hover:bg-zinc-800"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <TemplateSelector
            selectedTemplate={selectedTemplate}
            onSelect={setSelectedTemplate}
            filter={['exitPendle']}
          />

          {selectedTemplate === 'exitPendle' && !ptAddress ? (
            <div className="bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-8 text-center">
              <p className="text-red-400">Please use the Exit button from your Pendle position.</p>
            </div>
          ) : selectedTemplate && (
            <div className="bg-zinc-950/40 border border-zinc-800/50 rounded-xl p-6 space-y-4">
              <h3 className="font-bold text-lg mb-4 text-zinc-200">Configure Parameters</h3>

              <div className="space-y-4">
                {(selectedTemplate === 'repayAndWithdraw' || selectedTemplate === 'deleverageAave') ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-zinc-400">Borrow Asset (to repay)</label>
                      <select
                        className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-100"
                        value={borrowAsset}
                        onChange={(e) => setBorrowAsset(e.target.value)}
                      >
                        <option value="USDC">USDC</option>
                        <option value="USDT">USDT</option>
                        <option value="DAI">DAI</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-zinc-400">Collateral Asset (to withdraw)</label>
                      <select
                        className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-100"
                        value={collateralAsset}
                        onChange={(e) => setCollateralAsset(e.target.value)}
                      >
                        <option value="ETH">ETH</option>
                        <option value="wstETH">wstETH</option>
                        <option value="WBTC">WBTC</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-sm font-medium mb-1 text-zinc-400">Asset</label>
                    <select
                      className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-100"
                      value={asset}
                      onChange={(e) => setAsset(e.target.value)}
                    >
                      <option value="USDC">USDC</option>
                      <option value="ETH">ETH</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1 text-zinc-400">
                    {selectedTemplate === 'deleverageAave' ? 'Total Debt Amount' : 'Amount'}
                  </label>
                  <input
                    type="number"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-100"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                {selectedTemplate === 'deleverageAave' && (
                  <div>
                    <label className="block text-sm font-medium mb-1 text-zinc-400">Unwind Cycles</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-100"
                      value={cycles}
                      onChange={(e) => setCycles(parseInt(e.target.value) || 1)}
                    />
                    <p className="text-xs text-zinc-500 mt-1">Higher cycles are safer but cost more gas.</p>
                  </div>
                )}
                {(selectedTemplate === 'repayAndWithdraw' || selectedTemplate === 'deleverageAave') && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-zinc-400">Total Collateral Amount</label>
                      <input
                        type="number"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-100"
                        value={collateralAmount}
                        onChange={(e) => setCollateralAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-zinc-400">Current Health Factor</label>
                      <input
                        type="number"
                        step="0.1"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-100"
                        value={healthFactor}
                        onChange={(e) => setHealthFactor(parseFloat(e.target.value) || 2.5)}
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1 text-zinc-400">From Chain</label>
                  <select
                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-100"
                    value={fromChain}
                    onChange={(e) => setFromChain(e.target.value as ChainId)}
                  >
                    <option value="ethereum">Ethereum</option>
                    <option value="arbitrum">Arbitrum</option>
                    <option value="base">Base</option>
                  </select>
                </div>
                {(selectedTemplate === 'crossChainRebalance' || selectedTemplate === 'repayAndWithdraw' || selectedTemplate === 'deleverageAave') && (
                  <div>
                    <label className="block text-sm font-medium mb-1 text-zinc-400">From Protocol</label>
                    <select
                      className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-100"
                      value={fromProtocol}
                      onChange={(e) => setFromProtocol(e.target.value as ProtocolId)}
                    >
                      <option value="aave">Aave V3</option>
                      <option value="morpho">Morpho</option>
                      <option value="euler">Euler</option>
                    </select>
                  </div>
                )}
                {(selectedTemplate === 'bridgeAndDeposit' || selectedTemplate === 'crossChainRebalance' || selectedTemplate === 'exitPendle') && (
                  <div>
                    <label className="block text-sm font-medium mb-1 text-zinc-400">To Chain</label>
                    <select
                      className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-100"
                      value={toChain}
                      onChange={(e) => setToChain(e.target.value as ChainId)}
                    >
                      <option value="ethereum">Ethereum</option>
                      <option value="arbitrum">Arbitrum</option>
                      <option value="base">Base</option>
                    </select>
                  </div>
                )}
                {selectedTemplate !== 'repayAndWithdraw' && selectedTemplate !== 'deleverageAave' && selectedTemplate !== 'exitPendle' && (
                  <div>
                    <label className="block text-sm font-medium mb-1 text-zinc-400">Destination Protocol</label>
                    <select
                      className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-100"
                      value={toProtocol}
                      onChange={(e) => setToProtocol(e.target.value as ProtocolId)}
                    >
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
                className="mt-8 w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Creating Plan...' : 'Create Sequence Plan'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
