import { PublicKey } from '@solana/web3.js';
import { isAddress } from 'viem';
import { describe, expect, it } from 'vitest';
import { SUPPORTED_TOKENS } from '../tokens';

// A wrong-but-well-formed address sends user funds into the void, and a
// truncated one throws at PublicKey construction — both shipped before
// (USDC/WETH/WBTC Solana mints). Structural checks catch truncation; the
// pinned mints below catch lookalike regressions.

describe('SUPPORTED_TOKENS address integrity', () => {
  const entries = Object.entries(SUPPORTED_TOKENS);

  it.each(entries)('%s EVM addresses are valid checksummed addresses', (_symbol, config) => {
    for (const chain of ['ethereum', 'arbitrum', 'base'] as const) {
      const address = config.addresses[chain];
      if (address !== undefined) {
        expect(isAddress(address), `${config.symbol} on ${chain}: ${address}`).toBe(true);
      }
    }
  });

  it.each(entries)('%s Solana address decodes as a valid public key', (_symbol, config) => {
    const address = config.addresses.solana;
    if (address !== undefined) {
      expect(() => new PublicKey(address), `${config.symbol} on solana: ${address}`).not.toThrow();
    }
  });

  // Canonical mints verified against Solscan/Circle/Wormhole (2026-07).
  it('pins the canonical Solana mints', () => {
    expect(SUPPORTED_TOKENS.USDC.addresses.solana).toBe(
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    );
    expect(SUPPORTED_TOKENS.USDT.addresses.solana).toBe(
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    );
    expect(SUPPORTED_TOKENS.WETH.addresses.solana).toBe(
      '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
    );
    expect(SUPPORTED_TOKENS.WBTC.addresses.solana).toBe(
      '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
    );
  });
});
