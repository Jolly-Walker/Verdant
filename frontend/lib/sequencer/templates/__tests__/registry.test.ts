import { describe, expect, it } from 'vitest';

import {
  buildBridgeAndDepositPlan,
  buildCrossChainRebalancePlan,
  buildDeleverageAavePlan,
  buildExitPendlePlan,
  buildRepayAndWithdrawPlan,
  TEMPLATE_REGISTRY,
} from '../index';

const EXPECTED_TEMPLATE_IDS = [
  'bridgeAndDeposit',
  'crossChainRebalance',
  'deleverageAave',
  'exitPendle',
  'repayAndWithdraw',
];

describe('TEMPLATE_REGISTRY', () => {
  it('registers exactly the five non-custom templates', () => {
    expect(Object.keys(TEMPLATE_REGISTRY).sort()).toEqual(EXPECTED_TEMPLATE_IDS);
  });

  it('keeps each entry id consistent with its registry key', () => {
    for (const [key, entry] of Object.entries(TEMPLATE_REGISTRY)) {
      expect(entry.id).toBe(key);
    }
  });

  it('gives every template a display name, description, and de-duplicated requiredParams', () => {
    for (const entry of Object.values(TEMPLATE_REGISTRY)) {
      expect(entry.displayName.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
      expect(entry.requiredParams.length).toBeGreaterThan(0);
      expect(new Set(entry.requiredParams).size).toBe(entry.requiredParams.length);
      // Every plan is built for a wallet; no template can omit it.
      expect(entry.requiredParams).toContain('walletAddress');
    }
  });

  it('re-exports every plan builder through the barrel (client hooks import from here)', () => {
    expect(typeof buildBridgeAndDepositPlan).toBe('function');
    expect(typeof buildCrossChainRebalancePlan).toBe('function');
    expect(typeof buildDeleverageAavePlan).toBe('function');
    expect(typeof buildExitPendlePlan).toBe('function');
    expect(typeof buildRepayAndWithdrawPlan).toBe('function');
  });
});
