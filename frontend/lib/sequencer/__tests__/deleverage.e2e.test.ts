import { describe, it, expect } from 'vitest';
import { buildDeleverageAavePlan, computeOptimalCycles } from '../templates/deleverageAave';

describe('De-leverage E2E & Template Integration Tests', () => {
  it('correctly computes optimal cycles based on debt, collateral, and health factor target', () => {
    // 3000 USD debt, 7500 USD collateral, LT = 0.8
    // lf initial is 2.0. Target is 1.05.
    const lt = (2.0 * 3000) / 7500; // 0.8
    const optimal = computeOptimalCycles(3000, 7500, lt, 1.05);
    expect(optimal).toBeGreaterThan(0);
    expect(optimal).toBeLessThanOrEqual(20);
  });

  it('verifies generated plan steps have string-formatted integer amounts (Wei strings)', () => {
    const plan = buildDeleverageAavePlan({
      borrowAsset: 'USDC',
      collateralAsset: 'ETH',
      totalDebt: '3000000000', // 3000 USDC (6 decimals)
      totalCollateral: '2500000000000000000', // 2.5 ETH (18 decimals)
      totalDebtUsd: 3000,
      totalCollateralUsd: 7500,
      initialHealthFactor: 2.0,
      amountUsd: 3000,
      cycles: 3,
      protocol: 'aave',
      chain: 'ethereum',
      walletAddress: '0x123'
    });

    expect(plan.steps.length).toBe(6);
    
    // All step amounts must be integer strings (no decimals)
    plan.steps.forEach(step => {
      const amountStr = step.buildParams.amount;
      expect(amountStr).toMatch(/^\d+$/); // pure digits
      expect(Number.isInteger(Number(amountStr))).toBe(true);
    });
  });

  it('rejects plan creation if projected health factor drops below 1.05', () => {
    expect(() => {
      buildDeleverageAavePlan({
        borrowAsset: 'USDC',
        collateralAsset: 'ETH',
        totalDebt: '3000000000',
        totalCollateral: '2500000000000000000',
        totalDebtUsd: 3000,
        totalCollateralUsd: 3100, // Very low collateral
        initialHealthFactor: 1.01,
        amountUsd: 3000,
        cycles: 30,
        protocol: 'aave',
        chain: 'ethereum',
        walletAddress: '0x123'
      });
    }).toThrow(/limit of 1.05/);
  });

  it('defaults to computed optimal cycles when input cycles is omitted', () => {
    const plan = buildDeleverageAavePlan({
      borrowAsset: 'USDC',
      collateralAsset: 'ETH',
      totalDebt: '3000000000',
      totalCollateral: '2500000000000000000',
      totalDebtUsd: 3000,
      totalCollateralUsd: 7500,
      initialHealthFactor: 2.0,
      amountUsd: 3000,
      protocol: 'aave',
      chain: 'ethereum',
      walletAddress: '0x123'
    });

    // It should have calculated the optimal cycles and successfully generated the plan
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.steps.length % 2).toBe(0); // must be paired repay/withdraw
  });
});
