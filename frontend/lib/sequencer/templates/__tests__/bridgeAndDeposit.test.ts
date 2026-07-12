import { describe, expect, it } from 'vitest';

import type { BridgeAndDepositParams } from '@/types/sequencer';
import { buildBridgeAndDepositPlan } from '../bridgeAndDeposit';
import { bridgeParams, expectStructurallyValidPlan, getStep, txParams } from './helpers';

const baseParams: BridgeAndDepositParams = {
  asset: 'USDC',
  amount: '250000000', // 250 USDC (6 decimals)
  amountUsd: 250,
  fromChain: 'ethereum',
  toChain: 'arbitrum',
  fromProtocol: 'wallet',
  toProtocol: 'aave',
  walletAddress: '0x1111111111111111111111111111111111111111',
  slippagePercent: 0.5,
};

describe('buildBridgeAndDepositPlan', () => {
  it('builds a structurally valid plan that passes engine validation (cross-chain)', () => {
    const plan = buildBridgeAndDepositPlan(baseParams);
    expectStructurallyValidPlan(plan);
    expect(plan.steps.map((s) => s.id)).toEqual(['bridge', 'deposit']);
  });

  it('builds a structurally valid single-step plan when chains match', () => {
    const plan = buildBridgeAndDepositPlan({ ...baseParams, toChain: 'ethereum' });
    expectStructurallyValidPlan(plan);
    expect(plan.steps.map((s) => s.id)).toEqual(['deposit']);
    expect(plan.steps.some((s) => s.id === 'bridge')).toBe(false);
  });

  it('threads chain/asset/amount/wallet parameters into the right steps', () => {
    const plan = buildBridgeAndDepositPlan(baseParams);

    const bridge = bridgeParams(getStep(plan, 'bridge'));
    expect(bridge.fromChain).toBe('ethereum');
    expect(bridge.toChain).toBe('arbitrum');
    expect(bridge.token).toBe('USDC');
    expect(bridge.amount).toBe('250000000');
    expect(bridge.recipientAddress).toBe(baseParams.walletAddress);
    expect(bridge.slippagePercent).toBe(0.5);

    const deposit = txParams(getStep(plan, 'deposit'));
    expect(deposit.action).toBe('supply');
    expect(deposit.protocol).toBe('aave');
    expect(deposit.chain).toBe('arbitrum');
    expect(deposit.asset).toBe('USDC');
    expect(deposit.userAddress).toBe(baseParams.walletAddress);

    // Current behavior: the destination deposit is sized off the FULL input
    // amount, with no slippage/fee haircut on the bridged output (contrast
    // buildExitPendlePlan, which floors downstream amounts).
    expect(deposit.amount).toBe('250000000');
  });

  it('sets plan metadata from params', () => {
    const plan = buildBridgeAndDepositPlan(baseParams);
    expect(plan.walletAddress).toBe(baseParams.walletAddress);
    expect(plan.positionSizeUsd).toBe(250);
    expect(plan.status).toBe('draft');
    expect(plan.totalCostUsd).toBe(0);
    expect(plan.description).toContain('USDC');
  });

  it('defaults the bridge plugin to across and honors preferredBridgeId', () => {
    const defaulted = buildBridgeAndDepositPlan(baseParams);
    expect(getStep(defaulted, 'bridge').pluginId).toBe('across');

    const preferred = buildBridgeAndDepositPlan({
      ...baseParams,
      preferredBridgeId: 'nearIntents',
    });
    expect(getStep(preferred, 'bridge').pluginId).toBe('nearIntents');
    // Preference only changes the executing plugin, not the route params.
    expect(bridgeParams(getStep(preferred, 'bridge')).amount).toBe('250000000');
  });

  it('builds (does not throw) for a zero amount — current behavior', () => {
    const plan = buildBridgeAndDepositPlan({ ...baseParams, amount: '0', amountUsd: 0 });
    expectStructurallyValidPlan(plan);
    expect(bridgeParams(getStep(plan, 'bridge')).amount).toBe('0');
    expect(txParams(getStep(plan, 'deposit')).amount).toBe('0');
  });
});
