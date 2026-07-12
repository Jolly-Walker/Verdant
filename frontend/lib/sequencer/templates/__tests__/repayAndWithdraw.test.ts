import { describe, expect, it } from 'vitest';

import type { RepayAndWithdrawParams } from '@/types/sequencer';
import { buildRepayAndWithdrawPlan } from '../repayAndWithdraw';
import { expectStructurallyValidPlan, getStep, txParams } from './helpers';

const baseParams: RepayAndWithdrawParams = {
  borrowAsset: 'USDT',
  borrowAmount: '500000000', // 500 USDT (6 decimals)
  amountUsd: 500,
  collateralAsset: 'ETH',
  collateralAmount: '1500000000000000000', // 1.5 ETH
  protocol: 'aave',
  chain: 'arbitrum',
  walletAddress: '0x3333333333333333333333333333333333333333',
};

describe('buildRepayAndWithdrawPlan', () => {
  it('builds a structurally valid repay -> withdraw plan on one chain', () => {
    const plan = buildRepayAndWithdrawPlan(baseParams);
    expectStructurallyValidPlan(plan);
    expect(plan.steps.map((s) => s.id)).toEqual(['repay', 'withdraw']);
    expect(plan.steps.every((s) => s.chain === 'arbitrum')).toBe(true);
    expect(plan.steps.every((s) => s.pluginId === 'aave')).toBe(true);
  });

  it('does not swap borrow and collateral legs', () => {
    const plan = buildRepayAndWithdrawPlan(baseParams);

    const repay = txParams(getStep(plan, 'repay'));
    expect(repay.action).toBe('repay');
    expect(repay.asset).toBe('USDT');
    expect(repay.amount).toBe('500000000');
    expect(repay.userAddress).toBe(baseParams.walletAddress);

    const withdraw = txParams(getStep(plan, 'withdraw'));
    expect(withdraw.action).toBe('withdraw');
    expect(withdraw.asset).toBe('ETH');
    expect(withdraw.amount).toBe('1500000000000000000');
    expect(withdraw.userAddress).toBe(baseParams.walletAddress);
  });

  it('sets plan metadata from params', () => {
    const plan = buildRepayAndWithdrawPlan(baseParams);
    expect(plan.walletAddress).toBe(baseParams.walletAddress);
    expect(plan.positionSizeUsd).toBe(500);
    expect(plan.status).toBe('draft');
    expect(plan.totalCostUsd).toBe(0);
    expect(plan.description).toContain('USDT');
    expect(plan.description).toContain('ETH');
  });
});
