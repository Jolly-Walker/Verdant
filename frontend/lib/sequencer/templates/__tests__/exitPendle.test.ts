import { describe, expect, it } from 'vitest';

import type { ExitPendleParams } from '@/types/sequencer';
import { buildExitPendlePlan } from '../exitPendle';
import { bridgeParams, expectStructurallyValidPlan, getStep, txParams } from './helpers';

const baseParams: ExitPendleParams = {
  ptAsset: 'PT-eETH',
  ptAddress: '0x35D1A6fD38F0839e3F9329C356391d4e0258B0A8',
  amount: '950000000000000000', // 0.95 PT
  amountUsd: 3000,
  underlyingAsset: 'WETH',
  fromChain: 'ethereum',
  toChain: 'arbitrum',
  toProtocol: 'aave',
  walletAddress: '0x5555555555555555555555555555555555555555',
  slippagePercent: 0.5,
};

const PREVIEW = '1000000000000000000'; // 1 WETH previewed out of the redemption

describe('buildExitPendlePlan', () => {
  it('builds structurally valid plans for both same-chain and cross-chain exits', () => {
    const crossChain = buildExitPendlePlan(baseParams, PREVIEW);
    expectStructurallyValidPlan(crossChain);
    expect(crossChain.steps.map((s) => s.id)).toEqual(['redeem', 'bridge', 'deposit']);

    const sameChain = buildExitPendlePlan({ ...baseParams, toChain: 'ethereum' }, PREVIEW);
    expectStructurallyValidPlan(sameChain);
    expect(sameChain.steps.map((s) => s.id)).toEqual(['redeem', 'deposit']);
  });

  it('parameterizes the redeem step with the PT asset and Pendle-specific extraParams', () => {
    const plan = buildExitPendlePlan(baseParams, PREVIEW);
    const redeem = getStep(plan, 'redeem');
    expect(redeem.pluginId).toBe('pendle');
    expect(redeem.chain).toBe('ethereum');

    const p = txParams(redeem);
    expect(p.action).toBe('withdraw');
    expect(p.protocol).toBe('pendle');
    expect(p.asset).toBe('PT-eETH');
    expect(p.amount).toBe(baseParams.amount); // the PT amount, not the preview
    expect(p.userAddress).toBe(baseParams.walletAddress);
    expect(p.extraParams).toMatchObject({
      ptAddress: baseParams.ptAddress,
      underlyingAsset: 'WETH',
      slippagePercent: 0.5,
      isWei: true,
    });
  });

  it('routes the UNDERLYING asset (not the PT) through bridge and deposit', () => {
    const plan = buildExitPendlePlan(baseParams, PREVIEW);

    const bridge = bridgeParams(getStep(plan, 'bridge'));
    expect(bridge.token).toBe('WETH');
    expect(bridge.fromChain).toBe('ethereum');
    expect(bridge.toChain).toBe('arbitrum');
    expect(bridge.recipientAddress).toBe(baseParams.walletAddress);

    const deposit = txParams(getStep(plan, 'deposit'));
    expect(deposit.asset).toBe('WETH');
    expect(deposit.action).toBe('supply');
    expect(deposit.protocol).toBe('aave');
    expect(deposit.chain).toBe('arbitrum');
  });

  it('passes the preview through untouched at zero slippage', () => {
    const plan = buildExitPendlePlan({ ...baseParams, slippagePercent: 0 }, PREVIEW);
    expect(bridgeParams(getStep(plan, 'bridge')).amount).toBe(PREVIEW);
    expect(txParams(getStep(plan, 'deposit')).amount).toBe(PREVIEW);
  });

  it('floors (never rounds up) the slippage-buffered downstream amount', () => {
    // 999 * (10000 - 10) / 10000 = 998.001 -> floors to 998
    const plan = buildExitPendlePlan({ ...baseParams, slippagePercent: 0.1 }, '999');
    expect(bridgeParams(getStep(plan, 'bridge')).amount).toBe('998');
    expect(txParams(getStep(plan, 'deposit')).amount).toBe('998');
  });

  it('applies the slippage floor to the same-chain deposit too', () => {
    const plan = buildExitPendlePlan({ ...baseParams, toChain: 'ethereum' }, PREVIEW);
    // 1e18 * (10000 - 50) / 10000
    expect(txParams(getStep(plan, 'deposit')).amount).toBe('995000000000000000');
  });

  it('defaults the bridge plugin to across and honors preferredBridgeId', () => {
    expect(getStep(buildExitPendlePlan(baseParams, PREVIEW), 'bridge').pluginId).toBe('across');
    const preferred = buildExitPendlePlan(
      { ...baseParams, preferredBridgeId: 'nearIntents' },
      PREVIEW,
    );
    expect(getStep(preferred, 'bridge').pluginId).toBe('nearIntents');
  });

  it('builds a zero-sized downstream leg for a zero-output preview — current behavior', () => {
    const plan = buildExitPendlePlan(baseParams, '0');
    expectStructurallyValidPlan(plan);
    expect(bridgeParams(getStep(plan, 'bridge')).amount).toBe('0');
    expect(txParams(getStep(plan, 'deposit')).amount).toBe('0');
  });
});
