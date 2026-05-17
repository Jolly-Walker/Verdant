import { describe, it, expect } from 'vitest';
import { isValidAddress } from '../chains';

describe('isValidAddress', () => {
  it('identifies valid EVM addresses', () => {
    expect(isValidAddress('0x8ab71ad4037a06002fdcfbef051f2fa9799df240')).toBe(true);
    expect(isValidAddress('0x1234567890123456789012345678901234567890')).toBe(true);
  });

  it('identifies valid Solana addresses', () => {
    expect(isValidAddress('vines1vzrYbzRwuAfsG9ogCc5PsTdi7nLBYv5dg7S')).toBe(true);
    expect(isValidAddress('8B9u43T5Yp5QZ5b5D5q5P5p5z5w5x5y5z5A5B5C5D5E')).toBe(true);
  });

  it('fails on invalid formats', () => {
    expect(isValidAddress('0x123')).toBe(false); // too short EVM
    expect(isValidAddress('not-an-address')).toBe(false);
    expect(isValidAddress('0xG123...')).toBe(false); // invalid hex
  });

  it('validates specific chain formats', () => {
    expect(isValidAddress('0x8ab71ad4037a06002fdcfbef051f2fa9799df240', 'ethereum')).toBe(true);
    expect(isValidAddress('0x8ab71ad4037a06002fdcfbef051f2fa9799df240', 'solana')).toBe(false);
    expect(isValidAddress('vines1vzrYbzRwuAfsG9ogCc5PsTdi7nLBYv5dg7S', 'solana')).toBe(true);
    expect(isValidAddress('vines1vzrYbzRwuAfsG9ogCc5PsTdi7nLBYv5dg7S', 'arbitrum')).toBe(false);
  });
});
