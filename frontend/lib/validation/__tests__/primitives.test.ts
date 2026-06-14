import { afterEach, describe, expect, it } from 'vitest';
import { DEMO_WALLET_ADDRESS } from '@/lib/demo/wallet';
import { evmAddressSchema, slippagePercentSchema } from '../primitives';

describe('evmAddressSchema', () => {
  const realAddr = '0x1234567890123456789012345678901234567890';

  it('accepts a well-formed EVM address', () => {
    expect(evmAddressSchema.safeParse(realAddr).success).toBe(true);
  });

  it('rejects a malformed address', () => {
    expect(evmAddressSchema.safeParse('0xnothex').success).toBe(false);
  });

  describe('demo sentinel gating (must agree with isValidAddress)', () => {
    const original = process.env.NEXT_PUBLIC_DEMO_MODE;
    afterEach(() => {
      process.env.NEXT_PUBLIC_DEMO_MODE = original;
    });

    it('rejects the demo sentinel when NOT in demo mode (production)', () => {
      delete process.env.NEXT_PUBLIC_DEMO_MODE;
      expect(evmAddressSchema.safeParse(DEMO_WALLET_ADDRESS).success).toBe(false);
    });

    it('accepts the demo sentinel only in demo mode', () => {
      process.env.NEXT_PUBLIC_DEMO_MODE = 'true';
      expect(evmAddressSchema.safeParse(DEMO_WALLET_ADDRESS).success).toBe(true);
    });
  });
});

describe('slippagePercentSchema', () => {
  it('accepts an in-range tolerance', () => {
    expect(slippagePercentSchema.safeParse(0).success).toBe(true);
    expect(slippagePercentSchema.safeParse(0.5).success).toBe(true);
    expect(slippagePercentSchema.safeParse(50).success).toBe(true);
  });

  it('rejects NaN, negatives, and out-of-range values', () => {
    expect(slippagePercentSchema.safeParse(Number.NaN).success).toBe(false);
    expect(slippagePercentSchema.safeParse(-5).success).toBe(false);
    expect(slippagePercentSchema.safeParse(200).success).toBe(false);
  });
});
