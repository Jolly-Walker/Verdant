import { describe, it, expect } from 'vitest';
import { buildDeleverageAavePlan, computeOptimalCycles } from '../templates/deleverageAave';

describe('deleverageAave template', () => {
  describe('BigInt precision', () => {
    it('handles amounts greater than Number.MAX_SAFE_INTEGER correctly', () => {
      // 2^53 - 1 = 9007199254740991
      const largeAmount = '10000000000000000001'; 
      const plan = buildDeleverageAavePlan({
        borrowAsset: 'USDC',
        collateralAsset: 'ETH',
        totalDebt: largeAmount,
        totalCollateral: largeAmount,
        totalDebtUsd: 10000,
        totalCollateralUsd: 20000,
        initialHealthFactor: 2.0,
        amountUsd: 10000,
        cycles: 1,
        protocol: 'aave',
        chain: 'ethereum',
        walletAddress: '0x123'
      });

      expect(plan.steps[0].buildParams.amount).toBe(largeAmount);
      expect(plan.steps[1].buildParams.amount).toBe(largeAmount);
    });
  });

  describe('computeOptimalCycles', () => {
    it('returns 1 cycle for a safe position', () => {
      const totalDebtUsd = 1000;
      const totalCollateralUsd = 4000;
      const initialHF = 3.2;
      const lt = (initialHF * totalDebtUsd) / totalCollateralUsd;
      const cycles = computeOptimalCycles(totalDebtUsd, totalCollateralUsd, lt);
      expect(cycles).toBe(1);
    });

    it('returns 1 cycle for a low HF position', () => {
      const totalDebtUsd = 3000;
      const totalCollateralUsd = 3100;
      const initialHF = 1.03;
      const lt = (initialHF * totalDebtUsd) / totalCollateralUsd;
      // In this model, 1 cycle is always feasible if you can repay everything.
      // Larger cycle counts actually make it harder to reach the target HF in the first step.
      const cycles = computeOptimalCycles(totalDebtUsd, totalCollateralUsd, lt);
      expect(cycles).toBe(1);
    });

    it('returns 1 cycle for an already-healthy position', () => {
      const totalDebtUsd = 1000;
      const totalCollateralUsd = 2000;
      const initialHF = 1.8; // Already > 1.05
      const lt = (initialHF * totalDebtUsd) / totalCollateralUsd;
      const cycles = computeOptimalCycles(totalDebtUsd, totalCollateralUsd, lt);
      expect(cycles).toBe(1);
    });
  });
});
