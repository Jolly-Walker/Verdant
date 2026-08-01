import { describe, expect, it } from 'vitest';
import {
  formatCompactUsd,
  formatPercent,
  formatToken,
  formatUsd,
  truncateAddress,
} from '../formatting';

describe('formatUsd', () => {
  it('formats positive values with two decimals and thousands separators', () => {
    expect(formatUsd(1234.5)).toBe('$1,234.50');
    expect(formatUsd(0.01)).toBe('$0.01');
    expect(formatUsd(99.999)).toBe('$100.00');
  });

  it('formats negative values with the sign outside the currency symbol', () => {
    expect(formatUsd(-1234.5)).toBe('-$1,234.50');
    expect(formatUsd(-0.01)).toBe('-$0.01');
  });

  it('formats zero as plain dollars', () => {
    expect(formatUsd(0)).toBe('$0.00');
  });

  it('keeps four decimals for sub-cent positives instead of collapsing to $0.00', () => {
    expect(formatUsd(0.003)).toBe('$0.0030');
    expect(formatUsd(0.009999)).toBe('$0.0100');
    expect(formatUsd(0.00001)).toBe('$0.0000');
  });

  it('puts the minus before the dollar sign for sub-cent negatives', () => {
    // Regression: the small-value branch used to interpolate raw, yielding "$-0.0050".
    expect(formatUsd(-0.005)).toBe('-$0.0050');
    expect(formatUsd(-0.0001)).toBe('-$0.0001');
  });

  it('formats large values', () => {
    expect(formatUsd(1_234_567.891)).toBe('$1,234,567.89');
    expect(formatUsd(10_000_000)).toBe('$10,000,000.00');
  });
});

describe('formatToken', () => {
  it('defaults to at most four decimals and trims trailing zeros', () => {
    expect(formatToken(1234.5678)).toBe('1,234.5678');
    expect(formatToken(5)).toBe('5');
    expect(formatToken(14.5)).toBe('14.5');
  });

  it('rounds beyond the decimal cap', () => {
    expect(formatToken(1234.56789)).toBe('1,234.5679');
    expect(formatToken(0.000001)).toBe('0');
  });

  it('honours a custom precision', () => {
    expect(formatToken(0.000001, 6)).toBe('0.000001');
    expect(formatToken(1.23456789, 8)).toBe('1.23456789');
    expect(formatToken(1.9, 0)).toBe('2');
  });

  it('formats negatives and zero', () => {
    expect(formatToken(-42.5)).toBe('-42.5');
    expect(formatToken(0)).toBe('0');
  });
});

describe('formatPercent', () => {
  it('converts a decimal fraction to a two-decimal percentage', () => {
    expect(formatPercent(0.065)).toBe('6.50%');
    expect(formatPercent(0.1234)).toBe('12.34%');
    expect(formatPercent(1.5)).toBe('150.00%');
  });

  it('handles zero and negatives', () => {
    expect(formatPercent(0)).toBe('0.00%');
    expect(formatPercent(-0.05)).toBe('-5.00%');
  });
});

describe('truncateAddress', () => {
  it('truncates a full EVM address to head and tail', () => {
    expect(truncateAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x1234...5678');
  });

  it('truncates long non-EVM addresses too', () => {
    expect(truncateAddress('vines1vzrYbzRwuAfsG9ogCc5PsTdi7nLBYv5dg7S')).toBe('vines1...dg7S');
  });

  it('returns short strings unchanged', () => {
    expect(truncateAddress('0x123')).toBe('0x123');
    expect(truncateAddress('123456789')).toBe('123456789'); // exactly one below the cutoff
    expect(truncateAddress('')).toBe('');
  });

  it('truncates at exactly the cutoff length', () => {
    expect(truncateAddress('1234567890')).toBe('123456...7890');
  });
});

describe('formatCompactUsd', () => {
  it('abbreviates billions, millions, and thousands', () => {
    expect(formatCompactUsd(2_500_000_000)).toBe('$2.50B');
    expect(formatCompactUsd(1_500_000)).toBe('$1.50M');
    expect(formatCompactUsd(12_345)).toBe('$12.35K');
  });

  it('uses the inclusive lower bound of each tier', () => {
    expect(formatCompactUsd(1_000_000_000)).toBe('$1.00B');
    expect(formatCompactUsd(999_999_999)).toBe('$1000.00M');
    expect(formatCompactUsd(1_000_000)).toBe('$1.00M');
    expect(formatCompactUsd(999_999)).toBe('$1000.00K');
    expect(formatCompactUsd(1_000)).toBe('$1.00K');
    expect(formatCompactUsd(999.99)).toBe('$999.99');
  });

  it('falls through to formatUsd below $1K', () => {
    expect(formatCompactUsd(0)).toBe('$0.00');
    expect(formatCompactUsd(42.5)).toBe('$42.50');
    expect(formatCompactUsd(0.003)).toBe('$0.0030');
  });

  it('does not abbreviate negatives — every tier check is a bare >= comparison', () => {
    // Documents current behaviour, not desired behaviour: large losses render in full.
    expect(formatCompactUsd(-1_500_000)).toBe('-$1,500,000.00');
    expect(formatCompactUsd(-2_500)).toBe('-$2,500.00');
  });
});
