import { describe, expect, it } from 'vitest';
import { decodeRevertReason } from '../errors';

describe('decodeRevertReason', () => {
  it('decodes "0x13be252b" as "Insufficient allowance"', () => {
    expect(decodeRevertReason('0x13be252b')).toContain('allowance');
  });
  it('returns "Unknown execution failure" for empty revert data (0x)', () => {
    expect(decodeRevertReason('0x')).toBe('Unknown execution failure');
  });
  it('returns generic error for unknown selector', () => {
    expect(decodeRevertReason('0xdeadbeef')).toContain('0xdeadbeef');
  });

  it('maps a plain-text health-factor revert to the HF classification', () => {
    expect(decodeRevertReason('execution reverted: HF too low')).toBe(
      'Health factor too low after this action',
    );
    expect(decodeRevertReason('Aave: health factor below threshold')).toBe(
      'Health factor too low after this action',
    );
  });

  it('returns an unrecognized plain-text revert as-is (not a mangled selector)', () => {
    expect(decodeRevertReason('execution reverted: insufficient balance')).toBe(
      'execution reverted: insufficient balance',
    );
  });
});
