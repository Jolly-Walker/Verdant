import { describe, it, expect } from 'vitest'
import { decodeRevertReason } from '../errors'

describe('decodeRevertReason', () => {
  it('decodes "0x13be252b" as "Insufficient allowance"', () => {
    expect(decodeRevertReason('0x13be252b')).toContain('allowance')
  })
  it('returns "Unknown execution failure" for empty revert data (0x)', () => {
    expect(decodeRevertReason('0x')).toBe('Unknown execution failure')
  })
  it('returns generic error for unknown selector', () => {
    expect(decodeRevertReason('0xdeadbeef')).toContain('0xdeadbeef')
  })
})
