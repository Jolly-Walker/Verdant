import { describe, expect, it } from 'vitest';

import type { CrossChainRebalanceParams } from '@/types/sequencer';
import { buildCrossChainRebalancePlan } from '../crossChainRebalance';
import { bridgeParams, expectStructurallyValidPlan, getStep, txParams } from './helpers';

const baseParams: CrossChainRebalanceParams = {
  asset: 'USDC',
  amount: '1000000000', // 1000 USDC (6 decimals)
  amountUsd: 1000,
  fromProtocol: 'aave',
  fromChain: 'ethereum',
  toProtocol: 'morpho',
  toChain: 'base',
  walletAddress: '0x2222222222222222222222222222222222222222',
  slippagePercent: 0.3,
};

describe('buildCrossChainRebalancePlan', () => {
  it('builds a structurally valid withdraw -> bridge -> deposit plan', () => {
    const plan = buildCrossChainRebalancePlan(baseParams);
    expectStructurallyValidPlan(plan);
    expect(plan.steps.map((s) => s.id)).toEqual(['withdraw', 'bridge', 'deposit']);
  });

  it('places withdraw and bridge on the source chain and deposit on the destination', () => {
    const plan = buildCrossChainRebalancePlan(baseParams);
    expect(getStep(plan, 'withdraw').chain).toBe('ethereum');
    expect(getStep(plan, 'bridge').chain).toBe('ethereum');
    expect(getStep(plan, 'deposit').chain).toBe('base');
  });

  it('threads protocol/asset/amount/wallet parameters into each step', () => {
    const plan = buildCrossChainRebalancePlan(baseParams);

    const withdraw = txParams(getStep(plan, 'withdraw'));
    expect(withdraw.action).toBe('withdraw');
    expect(withdraw.protocol).toBe('aave');
    expect(withdraw.chain).toBe('ethereum');
    expect(withdraw.asset).toBe('USDC');
    expect(withdraw.amount).toBe('1000000000');
    expect(withdraw.userAddress).toBe(baseParams.walletAddress);

    const bridge = bridgeParams(getStep(plan, 'bridge'));
    expect(bridge.fromChain).toBe('ethereum');
    expect(bridge.toChain).toBe('base');
    expect(bridge.token).toBe('USDC');
    expect(bridge.amount).toBe('1000000000');
    expect(bridge.recipientAddress).toBe(baseParams.walletAddress);
    expect(bridge.slippagePercent).toBe(0.3);

    const deposit = txParams(getStep(plan, 'deposit'));
    expect(deposit.action).toBe('supply');
    expect(deposit.protocol).toBe('morpho');
    expect(deposit.chain).toBe('base');
    expect(deposit.asset).toBe('USDC');
    // Current behavior: deposit is sized off the full input amount — no
    // haircut for bridge fees/slippage on the received amount.
    expect(deposit.amount).toBe('1000000000');
    expect(deposit.userAddress).toBe(baseParams.walletAddress);
  });

  it('defaults the bridge plugin to across and honors preferredBridgeId', () => {
    expect(getStep(buildCrossChainRebalancePlan(baseParams), 'bridge').pluginId).toBe('across');
    const preferred = buildCrossChainRebalancePlan({
      ...baseParams,
      preferredBridgeId: 'layerzero',
    });
    expect(getStep(preferred, 'bridge').pluginId).toBe('layerzero');
  });

  it('sets plan metadata from params', () => {
    const plan = buildCrossChainRebalancePlan(baseParams);
    expect(plan.walletAddress).toBe(baseParams.walletAddress);
    expect(plan.positionSizeUsd).toBe(1000);
    expect(plan.status).toBe('draft');
    expect(plan.totalCostUsd).toBe(0);
  });

  it('still emits a same-chain bridge step when fromChain === toChain — current behavior', () => {
    // Unlike buildBridgeAndDepositPlan, this template does not collapse the
    // bridge step for same-chain rebalances.
    const plan = buildCrossChainRebalancePlan({ ...baseParams, toChain: 'ethereum' });
    expectStructurallyValidPlan(plan);
    expect(plan.steps.map((s) => s.id)).toEqual(['withdraw', 'bridge', 'deposit']);
    const bridge = bridgeParams(getStep(plan, 'bridge'));
    expect(bridge.fromChain).toBe('ethereum');
    expect(bridge.toChain).toBe('ethereum');
  });
});
