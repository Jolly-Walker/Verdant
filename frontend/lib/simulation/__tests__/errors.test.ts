import { describe, it, expect } from 'vitest'
import { decodeRevertReason } from '../errors'

describe('decodeRevertReason', () => {
  it('decodes "0x13be252b" as "Insufficient allowance"', () => {
    expect(decodeRevertReason('0x13be252b')).toContain('allowance')
  })
  it('returns generic error for unknown selector', () => {
    expect(decodeRevertReason('0xdeadbeef')).toContain('0xdeadbeef')
  })
})
