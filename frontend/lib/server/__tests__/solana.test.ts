import { describe, it, expect, vi } from 'vitest'

// Mock server-only before other imports
vi.mock('server-only', () => ({}))

import { getSolanaConnection } from '../solana'
import { Connection } from '@solana/web3.js'

describe('getSolanaConnection', () => {
  it('returns a Solana Connection object', () => {
    const connection = getSolanaConnection()
    expect(connection).toBeInstanceOf(Connection)
  })
})
