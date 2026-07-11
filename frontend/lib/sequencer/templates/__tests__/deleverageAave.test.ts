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
    // NB: totalDebtUsd IS divisible by cycles — a non-divisible USD debt hits
    // the float-dust spurious abort covered by the next test.
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

    const repaid = sumAmounts(repaySteps(plan));
    // Even split uses integer division: 3 x floor(1000001/3) = 999999.
    // The 2-unit remainder is never scheduled for repayment (dust shortfall —
    // current behavior; see final report).
    expect(repaid).toBe(999999n);
    expect(repaid).toBeLessThanOrEqual(totalDebt);

    const withdrawn = sumAmounts(withdrawSteps(plan));
    // Withdraw fractions are rounded at 1e-6 precision per cycle, so allow
    // cycles * (totalCollateral / 1e6) of rounding drift.
    const tolerance = (totalCollateral * BigInt(cycles)) / 1_000_000n;
    const drift =
      withdrawn > totalCollateral ? withdrawn - totalCollateral : totalCollateral - withdrawn;
    expect(drift).toBeLessThanOrEqual(tolerance);

    for (const step of withdrawSteps(plan)) {
      expect(BigInt(txParams(step).amount)).toBeGreaterThanOrEqual(0n);
    }
  });

  it('spuriously aborts a healthy position when totalDebtUsd is not divisible by cycles — current behavior', () => {
    // 1000 / 3 leaves ~5.7e-14 USD of float-dust debt in the final cycle; the
    // projected HF becomes a ratio of two dust values (~1.0) and trips the
    // 1.049 guard even though the position is comfortably healthy (HF 2.0).
    // Documents current behavior — flagged as a suspected bug.
    expect(() =>
      buildDeleverageAavePlan({
        ...baseParams,
        totalDebt: '1000000000',
        totalCollateral: '2000000000000000000',
        totalDebtUsd: 1000,
        totalCollateralUsd: 4000,
        amountUsd: 1000,
        cycles: 3,
      }),
    ).toThrow(/below the safe limit/);
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

  it('emits zero-amount repay steps when the atomic debt is smaller than the cycle count — current behavior', () => {
    const plan = buildDeleverageAavePlan({
      ...baseParams,
      totalDebt: '1', // 1 atomic unit of debt
      totalCollateral: '400000000',
      totalDebtUsd: 100,
      totalCollateralUsd: 400,
      amountUsd: 100,
      cycles: 2,
    });
    // floor(1/2) = 0: both repay steps carry amount '0' even though the USD
    // projections assume half the debt is retired each cycle.
    expect(txParams(getStep(plan, 'repay-0')).amount).toBe('0');
    expect(txParams(getStep(plan, 'repay-1')).amount).toBe('0');
    expect(sumAmounts(withdrawSteps(plan))).toBeLessThanOrEqual(400000000n);
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
