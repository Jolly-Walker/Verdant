import { describe, expect, it } from 'vitest';
import { applySlippageFloor } from '../slippage';

describe('applySlippageFloor', () => {
  const amount = 1_000_000n;

  it('applies a normal slippage tolerance as a floor', () => {
    // 1% => 100 bps => amount * 9900 / 10000
    expect(applySlippageFloor(amount, 1)).toBe(990_000n);
    expect(applySlippageFloor(amount, 0.5)).toBe(995_000n);
  });

  it('treats a zero tolerance as no reduction', () => {
    expect(applySlippageFloor(amount, 0)).toBe(amount);
  });

  it('clamps a negative tolerance to 0 — never inflates above the input', () => {
    // bps < 0 would make the floor exceed `amount`, producing an unfillable deposit.
    expect(applySlippageFloor(amount, -50)).toBe(amount);
  });

  it('clamps a >100 tolerance to 100 — never produces a negative bigint', () => {
    // bps > 10000 would go negative and fail uint256 encoding downstream.
    expect(applySlippageFloor(amount, 200)).toBe(0n);
  });

  it('treats NaN/Infinity as 0 tolerance rather than throwing', () => {
    // BigInt(Math.round(NaN)) would throw a RangeError without the guard.
    expect(applySlippageFloor(amount, Number.NaN)).toBe(amount);
    expect(applySlippageFloor(amount, Number.POSITIVE_INFINITY)).toBe(amount);
  });
});
