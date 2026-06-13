import { describe, it, expect } from 'vitest';

import { buildBridgeAndDepositPlan } from '../templates/bridgeAndDeposit';
import { buildRepayAndWithdrawPlan } from '../templates/repayAndWithdraw';
import { buildCrossChainRebalancePlan } from '../templates/crossChainRebalance';
import { buildDeleverageAavePlan } from '../templates/deleverageAave';
import { buildExitPendlePlan } from '../templates/exitPendle';

describe('Sequencer Templates', () => {
  describe('bridgeAndDeposit', () => {
    it('creates a 2-step plan when chains are different', () => {
      const plan = buildBridgeAndDepositPlan({
        asset: 'USDC',
        amount: '100',
        amountUsd: 100,
        fromChain: 'ethereum',
        toChain: 'arbitrum',
        fromProtocol: 'wallet',
        toProtocol: 'aave',
        walletAddress: '0x123',
        slippagePercent: 0.5
      });

      expect(plan.steps.length).toBe(2);
      expect(plan.steps[0].id).toBe('bridge');
      expect(plan.steps[0].chain).toBe('ethereum');
      expect(plan.steps[0].dependsOn).toEqual([]);
      
      expect(plan.steps[1].id).toBe('deposit');
      expect(plan.steps[1].chain).toBe('arbitrum');
      expect(plan.steps[1].pluginId).toBe('aave');
      expect(plan.steps[1].dependsOn).toEqual(['bridge']);
    });

    it('creates a 1-step plan when chains are the same', () => {
      const plan = buildBridgeAndDepositPlan({
        asset: 'USDC',
        amount: '100',
        amountUsd: 100,
        fromChain: 'ethereum',
        toChain: 'ethereum',
        fromProtocol: 'wallet',
        toProtocol: 'aave',
        walletAddress: '0x123',
        slippagePercent: 0.5
      });

      expect(plan.steps.length).toBe(1);
      expect(plan.steps[0].id).toBe('deposit');
      expect(plan.steps[0].chain).toBe('ethereum');
      expect(plan.steps[0].dependsOn).toEqual([]);
    });
  });

  describe('repayAndWithdraw', () => {
    it('creates a 2-step plan chained properly', () => {
      const plan = buildRepayAndWithdrawPlan({
        borrowAsset: 'USDT',
        borrowAmount: '500',
        amountUsd: 500,
        collateralAsset: 'ETH',
        collateralAmount: '1.5',
        protocol: 'aave',
        chain: 'ethereum',
        walletAddress: '0x123'
      });

      expect(plan.steps.length).toBe(2);
      expect(plan.steps[0].id).toBe('repay');
      expect(plan.steps[0].pluginId).toBe('aave');
      expect(plan.steps[0].dependsOn).toEqual([]);

      expect(plan.steps[1].id).toBe('withdraw');
      expect(plan.steps[1].pluginId).toBe('aave');
      expect(plan.steps[1].dependsOn).toEqual(['repay']);
    });
  });

  describe('crossChainRebalance', () => {
    it('creates a 3-step plan chained properly', () => {
      const plan = buildCrossChainRebalancePlan({
        asset: 'USDC',
        amount: '1000',
        amountUsd: 1000,
        fromProtocol: 'aave',
        fromChain: 'ethereum',
        toProtocol: 'morpho',
        toChain: 'base',
        walletAddress: '0x123',
        slippagePercent: 0.5
      });

      expect(plan.steps.length).toBe(3);
      expect(plan.steps[0].id).toBe('withdraw');
      expect(plan.steps[0].dependsOn).toEqual([]);

      expect(plan.steps[1].id).toBe('bridge');
      expect(plan.steps[1].dependsOn).toEqual(['withdraw']);

      expect(plan.steps[2].id).toBe('deposit');
      expect(plan.steps[2].dependsOn).toEqual(['bridge']);
    });
  });

    describe('deleverageAave', () => {
    it('creates an N-cycle plan correctly dependent on previous cycles', () => {
      const plan = buildDeleverageAavePlan({
        borrowAsset: 'USDC',
        collateralAsset: 'ETH',
        totalDebt: '3000000000', // 3000 USDC (6 decimals)
        totalCollateral: '2500000000000000000', // 2.5 ETH (18 decimals)
        totalDebtUsd: 3000,
        totalCollateralUsd: 7500, // 2.5 ETH @ $3,000
        initialHealthFactor: 2.0,
        amountUsd: 3000,
        cycles: 3,
        protocol: 'aave',
        chain: 'ethereum',
        walletAddress: '0x123'
      });

      // 3 cycles * 2 steps per cycle = 6 steps
      expect(plan.steps.length).toBe(6);
      
      // Cycle 1
      expect(plan.steps[0].id).toBe('repay-0');
      expect(plan.steps[0].dependsOn).toEqual([]);
      expect(plan.steps[1].id).toBe('withdraw-0');
      expect(plan.steps[1].dependsOn).toEqual(['repay-0']);

      // Cycle 2
      expect(plan.steps[2].id).toBe('repay-1');
      expect(plan.steps[2].dependsOn).toEqual(['withdraw-0']);
      expect(plan.steps[3].id).toBe('withdraw-1');
      expect(plan.steps[3].dependsOn).toEqual(['repay-1']);

      // Cycle 3
      expect(plan.steps[4].id).toBe('repay-2');
      expect(plan.steps[4].dependsOn).toEqual(['withdraw-1']);
      expect(plan.steps[5].id).toBe('withdraw-2');
      expect(plan.steps[5].dependsOn).toEqual(['repay-2']);
    });

    it('throws error if health factor falls below 1.05', () => {
      expect(() => buildDeleverageAavePlan({
        borrowAsset: 'USDC',
        collateralAsset: 'ETH',
        totalDebt: '3000000000', // 3000 USDC (6 decimals)
        totalCollateral: '2500000000000000000', // 2.5 ETH (18 decimals)
        totalDebtUsd: 3000,
        totalCollateralUsd: 3100, // Very thin collateral margin
        initialHealthFactor: 1.01, // Low initial HF
        amountUsd: 3000,
        cycles: 30,
        protocol: 'aave',
        chain: 'ethereum',
        walletAddress: '0x123'
      })).toThrow(/limit of 1.05/);
    });
  });

  describe('exitPendle', () => {
    it('creates a 3-step plan when chains are different', () => {
      const plan = buildExitPendlePlan({
        ptAsset: 'PT-eETH',
        ptAddress: '0xabc',
        amount: '100',
        amountUsd: 100,
        underlyingAsset: 'ETH',
        fromChain: 'ethereum',
        toChain: 'arbitrum',
        toProtocol: 'aave',
        walletAddress: '0x123',
        slippagePercent: 0.5
      });

      expect(plan.steps.length).toBe(3);
      expect(plan.steps[0].id).toBe('redeem');
      expect(plan.steps[0].dependsOn).toEqual([]);

      expect(plan.steps[1].id).toBe('bridge');
      expect(plan.steps[1].dependsOn).toEqual(['redeem']);

      expect(plan.steps[2].id).toBe('deposit');
      expect(plan.steps[2].dependsOn).toEqual(['bridge']);
    });

    it('creates a 2-step plan when chains are the same', () => {
      const plan = buildExitPendlePlan({
        ptAsset: 'PT-eETH',
        ptAddress: '0xabc',
        amount: '100',
        amountUsd: 100,
        underlyingAsset: 'ETH',
        fromChain: 'ethereum',
        toChain: 'ethereum',
        toProtocol: 'aave',
        walletAddress: '0x123',
        slippagePercent: 0.5
      });

      expect(plan.steps.length).toBe(2);
      expect(plan.steps[0].id).toBe('redeem');
      expect(plan.steps[1].id).toBe('deposit');
      expect(plan.steps[1].dependsOn).toEqual(['redeem']);
    });

    it('falls back to the PT amount for downstream steps when no preview is given', () => {
      const plan = buildExitPendlePlan({
        ptAsset: 'PT-eETH',
        ptAddress: '0xabc',
        amount: '950000000000000000',
        amountUsd: 3000,
        underlyingAsset: 'WETH',
        fromChain: 'ethereum',
        toChain: 'arbitrum',
        toProtocol: 'aave',
        walletAddress: '0x123',
        slippagePercent: 0.5
      });
      // No redemptionOutput → downstream steps reuse the PT amount.
      const bridge = plan.steps.find(s => s.id === 'bridge');
      const deposit = plan.steps.find(s => s.id === 'deposit');
      expect((bridge!.buildParams as { amount: string }).amount).toBe('950000000000000000');
      expect((deposit!.buildParams as { amount: string }).amount).toBe('950000000000000000');
    });

    it('threads the previewed redemption output (with slippage floor) into downstream steps', () => {
      const plan = buildExitPendlePlan({
        ptAsset: 'PT-eETH',
        ptAddress: '0x35D1A6fD38F0839e3F9329C356391d4e0258B0A8',
        amount: '950000000000000000', // PT amount differs from underlying output
        amountUsd: 3000,
        underlyingAsset: 'WETH',
        fromChain: 'ethereum',
        toChain: 'arbitrum',
        toProtocol: 'aave',
        walletAddress: '0x123',
        slippagePercent: 0.5
      }, '1000000000000000000'); // 1 WETH previewed out from redeeming the PT

      // 1e18 * (10000 - 50) / 10000 = 0.995e18
      const expectedAmount = '995000000000000000';
      const bridge = plan.steps.find(s => s.id === 'bridge');
      const deposit = plan.steps.find(s => s.id === 'deposit');
      expect(bridge).toBeDefined();
      expect(deposit).toBeDefined();
      expect((bridge!.buildParams as { amount: string }).amount).toBe(expectedAmount);
      expect((deposit!.buildParams as { amount: string }).amount).toBe(expectedAmount);
      // The redeem step still uses the original PT amount.
      expect((plan.steps[0].buildParams as { amount: string }).amount).toBe('950000000000000000');
    });
  });
});
