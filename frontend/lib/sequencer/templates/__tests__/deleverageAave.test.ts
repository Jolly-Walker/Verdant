import { describe, expect, it } from 'vitest';

import type { DeleverageAaveParams } from '@/types/sequencer';
import { buildDeleverageAavePlan, computeOptimalCycles } from '../deleverageAave';
import { expectStructurallyValidPlan, getStep, txParams } from './helpers';

const baseParams: DeleverageAaveParams = {
  borrowAsset: 'USDC',
  collateralAsset: 'ETH',
  totalDebt: '3000000000', // 3000 USDC (6 decimals)
  totalCollateral: '2500000000000000000', // 2.5 ETH (18 decimals)
  totalDebtUsd: 3000,
  totalCollateralUsd: 7500,
  initialHealthFactor: 2.0,
  amountUsd: 3000,
  cycles: 2,
  protocol: 'aave',
  chain: 'ethereum',
  walletAddress: '0x4444444444444444444444444444444444444444',
};

function repaySteps(plan: ReturnType<typeof buildDeleverageAavePlan>) {
  return plan.steps.filter((s) => s.id.startsWith('repay-'));
}

function withdrawSteps(plan: ReturnType<typeof buildDeleverageAavePlan>) {
  return plan.steps.filter((s) => s.id.startsWith('withdraw-'));
}

function sumAmounts(steps: ReturnType<typeof repaySteps>): bigint {
  return steps.reduce((acc, s) => acc + BigInt(txParams(s).amount), 0n);
}

describe('buildDeleverageAavePlan', () => {
  it('builds a structurally valid plan with correctly parameterized repay/withdraw legs', () => {
    const plan = buildDeleverageAavePlan(baseParams);
    expectStructurallyValidPlan(plan);
    expect(plan.steps).toHaveLength(4); // 2 cycles x 2 steps

    for (const step of repaySteps(plan)) {
      const p = txParams(step);
      expect(p.action).toBe('repay');
      expect(p.asset).toBe('USDC');
      expect(p.chain).toBe('ethereum');
      expect(p.protocol).toBe('aave');
      expect(p.userAddress).toBe(baseParams.walletAddress);
      expect(p.extraParams).toMatchObject({ isWei: true });
    }
    for (const step of withdrawSteps(plan)) {
      const p = txParams(step);
      expect(p.action).toBe('withdraw');
      expect(p.asset).toBe('ETH');
      expect(p.chain).toBe('ethereum');
      expect(p.protocol).toBe('aave');
      expect(p.userAddress).toBe(baseParams.walletAddress);
      expect(p.extraParams).toMatchObject({ isWei: true });
    }
  });

  it('unwinds the whole position in a single cycle: repay all debt, withdraw all collateral', () => {
    const plan = buildDeleverageAavePlan({ ...baseParams, cycles: 1 });
    expect(plan.steps).toHaveLength(2);
    expect(txParams(getStep(plan, 'repay-0')).amount).toBe(baseParams.totalDebt);
    expect(txParams(getStep(plan, 'withdraw-0')).amount).toBe(baseParams.totalCollateral);
    // With zero debt left, both projections are unbounded.
    expect(getStep(plan, 'repay-0').projectedHealthFactor).toBe(Infinity);
    expect(getStep(plan, 'withdraw-0').projectedHealthFactor).toBe(Infinity);
  });

  it('conserves totals across cycles: repays never exceed debt, withdrawals track collateral', () => {
    const totalDebt = 1000001n; // atomic units deliberately not divisible by cycles
    const totalCollateral = 2000000000000000000n;
    const cycles = 3;
    const plan = buildDeleverageAavePlan({
      ...baseParams,
      totalDebt: totalDebt.toString(),
      totalCollateral: totalCollateral.toString(),
      totalDebtUsd: 900,
      totalCollateralUsd: 4000,
      amountUsd: 900,
      cycles,
    });
    expectStructurallyValidPlan(plan);
    expect(plan.steps).toHaveLength(cycles * 2);

    // The integer-division remainder is folded into the final repay, and the
    // final withdrawal takes exactly what's left, so both legs conserve.
    expect(sumAmounts(repaySteps(plan))).toBe(totalDebt);
    expect(sumAmounts(withdrawSteps(plan))).toBe(totalCollateral);

    for (const step of withdrawSteps(plan)) {
      expect(BigInt(txParams(step).amount)).toBeGreaterThanOrEqual(0n);
    }
  });

  it('handles totalDebtUsd not divisible by cycles without a spurious abort', () => {
    // Cumulative float subtraction used to leave ~5.7e-14 USD of dust debt in
    // the final cycle, turning the projected HF into a dust/dust ratio (~1.0)
    // that tripped the 1.049 guard on a comfortably healthy position (HF 2.0).
    // Closed-form per-cycle debt makes the final cycle exactly zero.
    const plan = buildDeleverageAavePlan({
      ...baseParams,
      totalDebt: '1000000000',
      totalCollateral: '2000000000000000000',
      totalDebtUsd: 1000,
      totalCollateralUsd: 4000,
      amountUsd: 1000,
      cycles: 3,
    });
    expectStructurallyValidPlan(plan);
    expect(plan.steps).toHaveLength(6);
    expect(sumAmounts(repaySteps(plan))).toBe(1000000000n);
    expect(sumAmounts(withdrawSteps(plan))).toBe(2000000000000000000n);
    for (const step of plan.steps) {
      expect(step.projectedHealthFactor as number).toBeGreaterThanOrEqual(1.049);
    }
  });

  it('keeps every projected health factor at or above the 1.05 safety target', () => {
    const plan = buildDeleverageAavePlan({
      ...baseParams,
      totalDebt: '1000000000',
      totalCollateral: '1000000000000000000',
      totalDebtUsd: 1000,
      totalCollateralUsd: 3000,
      initialHealthFactor: 1.5,
      amountUsd: 1000,
      cycles: 4,
    });
    expectStructurallyValidPlan(plan);
    expect(plan.steps).toHaveLength(8);
    for (const step of plan.steps) {
      expect(step.projectedHealthFactor).toBeDefined();
      // 1.049 is the template's own float-tolerant floor for the 1.05 target.
      expect(step.projectedHealthFactor as number).toBeGreaterThanOrEqual(1.049);
    }
  });

  it('accepts a position at the health-factor boundary when fully unwound in one cycle', () => {
    // Even HF = 1.0 is fine with a single cycle: all debt is repaid before any
    // collateral moves, so the withdrawal can never breach the target.
    const plan = buildDeleverageAavePlan({
      ...baseParams,
      totalDebt: '1000000000',
      totalCollateral: '1000000000000000000',
      totalDebtUsd: 1000,
      totalCollateralUsd: 1000,
      initialHealthFactor: 1.0,
      amountUsd: 1000,
      cycles: 1,
    });
    expectStructurallyValidPlan(plan);
    expect(txParams(getStep(plan, 'withdraw-0')).amount).toBe('1000000000000000000');
  });

  it('clamps the cycle count when the atomic debt has fewer units than cycles', () => {
    // floor(1/2) would emit zero-amount repay steps, so the plan collapses to
    // a single cycle that repays the whole (1-unit) debt and withdraws all
    // collateral.
    const plan = buildDeleverageAavePlan({
      ...baseParams,
      totalDebt: '1', // 1 atomic unit of debt
      totalCollateral: '400000000',
      totalDebtUsd: 100,
      totalCollateralUsd: 400,
      amountUsd: 100,
      cycles: 2,
    });
    expectStructurallyValidPlan(plan);
    expect(plan.steps).toHaveLength(2);
    expect(txParams(getStep(plan, 'repay-0')).amount).toBe('1');
    expect(txParams(getStep(plan, 'withdraw-0')).amount).toBe('400000000');
  });

  it('throws when USD debt or collateral is zero', () => {
    expect(() => buildDeleverageAavePlan({ ...baseParams, totalDebtUsd: 0 })).toThrow(
      /debt must be greater than zero/i,
    );
    expect(() => buildDeleverageAavePlan({ ...baseParams, totalCollateralUsd: 0 })).toThrow(
      /collateral must be greater than zero/i,
    );
  });

  it('falls back to computeOptimalCycles when cycles is omitted or zero', () => {
    const omitted = buildDeleverageAavePlan({ ...baseParams, cycles: undefined });
    expect(omitted.steps).toHaveLength(2); // optimal cycle count is 1 in this model

    const zero = buildDeleverageAavePlan({ ...baseParams, cycles: 0 });
    expect(zero.steps).toHaveLength(2);
  });
});

describe('computeOptimalCycles', () => {
  it('returns 1 for every position, including razor-thin ones (single full repay is always feasible)', () => {
    // i = 1 repays the entire debt before any withdrawal, so the feasibility
    // check can never fail and the "optimal cycles" floor is effectively a
    // constant 1 — it never forces a plan to use more cycles.
    const cases: Array<[number, number, number]> = [
      [1000, 4000, 0.8], // comfortably healthy
      [3000, 3100, (1.01 * 3000) / 3100], // same thin position whose 30-cycle plan throws
      [10000, 10100, 1.0], // near-liquidation
      [1, 1000000, 0.5], // dust debt
    ];
    for (const [debtUsd, collateralUsd, lt] of cases) {
      expect(computeOptimalCycles(debtUsd, collateralUsd, lt)).toBe(1);
    }
  });
});
