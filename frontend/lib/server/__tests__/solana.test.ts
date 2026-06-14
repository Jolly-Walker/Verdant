import { describe, expect, it, vi } from 'vitest';

// Mock server-only before other imports
vi.mock('server-only', () => ({}));

import { Connection } from '@solana/web3.js';
import { getSolanaConnection } from '../solana';

describe('getSolanaConnection', () => {
  it('returns a Solana Connection object', () => {
    const connection = getSolanaConnection();
    expect(connection).toBeInstanceOf(Connection);
  });
});
