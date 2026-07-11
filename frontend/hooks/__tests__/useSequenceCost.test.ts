import { describe, expect, it } from 'vitest';
import type { StepCost } from '@/types/quote';
import { computeQuoteStaleness, STALE_EXPIRE_MS, STALE_WARN_MS } from '../useSequenceCost';

describe('computeQuoteStaleness', () => {
  const future = () => new Date(Date.now() + 5 * 60_000).toISOString();

  it('pairs cost entries to plan steps by id, not array index', () => {
    const steps = [{ id: 'a' }, { id: 'b' }];
    // Cost steps returned in REVERSE order; only the bridge step ('b') carries a
    // quote. Index pairing would wrongly attribute 'b's quote to step 'a'.
    const costSteps: StepCost[] = [
      {
        stepId: 'b',
        stepLabel: 'Bridge',
        chain: 'ethereum',
        gasCostUsd: 1,
        quoteExpiresAt: future(),
      },
      { stepId: 'a', stepLabel: 'Withdraw', chain: 'ethereum', gasCostUsd: 1 },
    ];
    const now = 1_000_000_000_000;
    const fetchedAt = now - (STALE_EXPIRE_MS + 1_000); // expired by age

    const { stale, expired } = computeQuoteStaleness(steps, costSteps, fetchedAt, now);

    expect(expired.has('b')).toBe(true);
    expect(expired.has('a')).toBe(false);
    expect(stale.has('a')).toBe(false);
  });

  it('treats an unverifiable (NaN) quote age as expired — never executable', () => {
    const steps = [{ id: 'b' }];
    const costSteps: StepCost[] = [
      {
        stepId: 'b',
        stepLabel: 'Bridge',
        chain: 'ethereum',
        gasCostUsd: 1,
        quoteExpiresAt: future(),
      },
    ];

    const { expired } = computeQuoteStaleness(steps, costSteps, Number.NaN, 1_000_000_000_000);

    expect(expired.has('b')).toBe(true);
  });

  it('flags a quote as stale (warn) but not expired between 30s and 60s', () => {
    const steps = [{ id: 'b' }];
    const costSteps: StepCost[] = [
      {
        stepId: 'b',
        stepLabel: 'Bridge',
        chain: 'ethereum',
        gasCostUsd: 1,
        quoteExpiresAt: future(),
      },
    ];
    const now = 1_000_000_000_000;
    const fetchedAt = now - (STALE_WARN_MS + 1_000); // 31s old

    const { stale, expired } = computeQuoteStaleness(steps, costSteps, fetchedAt, now);

    expect(stale.has('b')).toBe(true);
    expect(expired.has('b')).toBe(false);
  });

  it('ignores steps without a quote and respects the quote-specific expiry', () => {
    const steps = [{ id: 'a' }, { id: 'b' }];
    const costSteps: StepCost[] = [
      { stepId: 'a', stepLabel: 'Withdraw', chain: 'ethereum', gasCostUsd: 1 },
      {
        stepId: 'b',
        stepLabel: 'Bridge',
        chain: 'ethereum',
        gasCostUsd: 1,
        quoteExpiresAt: new Date(900_000_000_000).toISOString(), // already past
      },
    ];
    const now = 1_000_000_000_000;
    const fetchedAt = now - 1_000; // fresh by age, but the quote's own expiry passed

    const { stale, expired } = computeQuoteStaleness(steps, costSteps, fetchedAt, now);

    expect(expired.has('b')).toBe(true);
    expect(stale.has('a')).toBe(false);
    expect(expired.has('a')).toBe(false);
  });
});
