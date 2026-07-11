import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/server/rpc', () => ({
  getPublicClient: vi.fn(),
  fetchGasPrice: vi.fn(),
  getRpcUrl: vi.fn(),
}));

vi.mock('@/lib/data/prices', () => ({
  getEthPrice: vi.fn(),
}));

const { connectionCtor } = vi.hoisted(() => ({ connectionCtor: vi.fn() }));

vi.mock('@solana/web3.js', () => ({
  Connection: class MockConnection {
    rpcEndpoint: string;
    constructor(url: string) {
      connectionCtor(url);
      this.rpcEndpoint = url;
    }
  },
}));

import { SUPPORTED_TOKENS } from '@/constants/tokens';
import { getEthPrice } from '@/lib/data/prices';
import { fetchGasPrice, getPublicClient, getRpcUrl } from '@/lib/server/rpc';
import { ALL_CHAINS, type ChainId } from '@/types/shared';
import type { ChainPlugin } from '../../types/chain-plugin';
import { CHAIN_DISPLAY_MAP, CHAIN_REGISTRY, type ChainDisplayMetadata } from '../index';

const EVM_CHAINS = ['ethereum', 'arbitrum', 'base'] as const satisfies readonly ChainId[];

// Native currencies have no ERC-20/SPL address entry in SUPPORTED_TOKENS.
const NATIVE_SYMBOLS = new Set(['ETH', 'SOL']);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── CHAIN_REGISTRY completeness & consistency ────────────────────────────────

describe('CHAIN_REGISTRY', () => {
  it('registers exactly the chains declared in ALL_CHAINS', () => {
    expect(Object.keys(CHAIN_REGISTRY).sort()).toEqual([...ALL_CHAINS].sort());
  });

  it.each(
    Object.entries(CHAIN_REGISTRY),
  )('%s plugin implements every ChainPlugin member with a valid shape', (key, plugin) => {
    expect(plugin.id).toBe(key);
    expect(plugin.displayName.length).toBeGreaterThan(0);
    expect(plugin.defillamaChain.length).toBeGreaterThan(0);
    expect(['evm', 'solana']).toContain(plugin.family);
    expect(plugin.explorerUrl).toMatch(/^https:\/\/[^/]+$/); // https, no trailing slash
    expect(plugin.nativeCurrency.symbol.length).toBeGreaterThan(0);
    expect(Number.isInteger(plugin.nativeCurrency.decimals)).toBe(true);
    expect(plugin.bridgeableTokens.length).toBeGreaterThan(0);
    expect(new Set(plugin.bridgeableTokens).size).toBe(plugin.bridgeableTokens.length);
    expect(typeof plugin.getRpcClient).toBe('function');
    expect(typeof plugin.estimateGasCostUsd).toBe('function');
  });

  it('gives every EVM chain a unique positive numeric EIP-155 chain id', () => {
    const ids = EVM_CHAINS.map((c) => CHAIN_REGISTRY[c].chainIdOrNetwork);
    for (const id of ids) {
      expect(typeof id).toBe('number');
      expect(Number.isInteger(id)).toBe(true);
      expect(id as number).toBeGreaterThan(0);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('pins the canonical chain ids and native-currency decimals', () => {
    expect(CHAIN_REGISTRY.ethereum.chainIdOrNetwork).toBe(1);
    expect(CHAIN_REGISTRY.arbitrum.chainIdOrNetwork).toBe(42161);
    expect(CHAIN_REGISTRY.base.chainIdOrNetwork).toBe(8453);
    expect(CHAIN_REGISTRY.solana.chainIdOrNetwork).toBe('solana-mainnet');

    for (const evm of EVM_CHAINS) {
      expect(CHAIN_REGISTRY[evm].family).toBe('evm');
      expect(CHAIN_REGISTRY[evm].nativeCurrency).toEqual({ symbol: 'ETH', decimals: 18 });
    }
    expect(CHAIN_REGISTRY.solana.family).toBe('solana');
    expect(CHAIN_REGISTRY.solana.nativeCurrency).toEqual({ symbol: 'SOL', decimals: 9 });
  });

  it('lists the native currency of each chain among its bridgeable tokens', () => {
    for (const chain of ALL_CHAINS) {
      const plugin = CHAIN_REGISTRY[chain];
      expect(plugin.bridgeableTokens).toContain(plugin.nativeCurrency.symbol);
    }
  });

  it('only lists non-native bridgeable tokens that have an address on that chain', () => {
    for (const chain of ALL_CHAINS) {
      for (const symbol of CHAIN_REGISTRY[chain].bridgeableTokens) {
        if (NATIVE_SYMBOLS.has(symbol)) continue;
        const config = SUPPORTED_TOKENS[symbol];
        expect(
          config,
          `${symbol} (bridgeable on ${chain}) missing from SUPPORTED_TOKENS`,
        ).toBeDefined();
        expect(
          config.addresses[chain],
          `${symbol} has no ${chain} address in SUPPORTED_TOKENS`,
        ).toBeTruthy();
      }
    }
  });

  it('returns undefined for an unknown chain lookup (current behavior: no throw)', () => {
    // Cast to a lookup-by-string map to probe how callers with unvalidated ids behave.
    const registry: Record<string, ChainPlugin | undefined> = CHAIN_REGISTRY;
    expect(registry.polygon).toBeUndefined();
    expect(registry['']).toBeUndefined();
  });
});

// ─── CHAIN_DISPLAY_MAP (metadata.ts) pure invariants ──────────────────────────

describe('CHAIN_DISPLAY_MAP', () => {
  it('covers exactly the chains declared in ALL_CHAINS', () => {
    expect(Object.keys(CHAIN_DISPLAY_MAP).sort()).toEqual([...ALL_CHAINS].sort());
  });

  it.each(
    Object.entries(CHAIN_DISPLAY_MAP),
  )('%s metadata is well-formed and self-consistent', (key, meta) => {
    expect(meta.id).toBe(key);
    expect(meta.displayName.length).toBeGreaterThan(0);
    expect(meta.explorerUrl).toMatch(/^https:\/\/[^/]+$/);
    expect(meta.coingeckoId.length).toBeGreaterThan(0);
    expect(meta.nativeCurrency.decimals).toBeGreaterThan(0);
  });

  it('agrees with the chain plugins on every overlapping field', () => {
    for (const chain of ALL_CHAINS) {
      const meta = CHAIN_DISPLAY_MAP[chain];
      const plugin = CHAIN_REGISTRY[chain];
      expect(meta.displayName).toBe(plugin.displayName);
      expect(meta.explorerUrl).toBe(plugin.explorerUrl);
      expect(meta.family).toBe(plugin.family);
      expect(meta.chainIdOrNetwork).toBe(plugin.chainIdOrNetwork);
      expect(meta.nativeCurrency).toEqual(plugin.nativeCurrency);
    }
  });

  it('maps every ETH-native chain to the ethereum coingecko id and solana to solana', () => {
    expect(CHAIN_DISPLAY_MAP.ethereum.coingeckoId).toBe('ethereum');
    expect(CHAIN_DISPLAY_MAP.arbitrum.coingeckoId).toBe('ethereum');
    expect(CHAIN_DISPLAY_MAP.base.coingeckoId).toBe('ethereum');
    expect(CHAIN_DISPLAY_MAP.solana.coingeckoId).toBe('solana');
  });

  it('returns undefined for an unknown chain lookup (current behavior: no throw)', () => {
    const map: Record<string, ChainDisplayMetadata | undefined> = CHAIN_DISPLAY_MAP;
    expect(map.optimism).toBeUndefined();
  });
});

// ─── EVM plugins: getRpcClient ────────────────────────────────────────────────

describe('EVM getRpcClient', () => {
  it.each(
    EVM_CHAINS,
  )('%s requests the server-side PublicClient for its own chain', async (chain) => {
    const sentinel = { readContract: vi.fn() };
    vi.mocked(getPublicClient).mockReturnValue(
      sentinel as unknown as ReturnType<typeof getPublicClient>,
    );

    const client = await CHAIN_REGISTRY[chain].getRpcClient();

    expect(getPublicClient).toHaveBeenCalledTimes(1);
    expect(getPublicClient).toHaveBeenCalledWith(chain);
    expect(client).toBe(sentinel);
  });

  it('propagates RPC-construction failures instead of swallowing them', async () => {
    vi.mocked(getPublicClient).mockImplementation(() => {
      throw new Error('Unsupported EVM chain: ethereum');
    });
    await expect(CHAIN_REGISTRY.ethereum.getRpcClient()).rejects.toThrow(/Unsupported EVM chain/);
  });
});

// ─── EVM plugins: estimateGasCostUsd ──────────────────────────────────────────

describe('EVM estimateGasCostUsd', () => {
  // cost = gasLimit * floor(gwei * 1e9) wei, converted to ETH, times ETH/USD.
  // Gas limits are hardcoded per chain: 250k (ethereum, base), 800k (arbitrum).
  const CASES: Array<{
    chain: (typeof EVM_CHAINS)[number];
    gwei: number;
    eth: number;
    usd: number;
  }> = [
    { chain: 'ethereum', gwei: 20, eth: 3000, usd: 15 }, // 250000 * 20 gwei = 0.005 ETH
    { chain: 'arbitrum', gwei: 0.1, eth: 2500, usd: 0.2 }, // 800000 * 0.1 gwei = 8e-5 ETH
    { chain: 'base', gwei: 0.05, eth: 2000, usd: 0.025 }, // 250000 * 0.05 gwei = 1.25e-5 ETH
  ];

  it.each(CASES)('$chain: $gwei gwei at $$eth/ETH costs $$usd', async ({
    chain,
    gwei,
    eth,
    usd,
  }) => {
    vi.mocked(fetchGasPrice).mockResolvedValue(gwei);
    vi.mocked(getEthPrice).mockResolvedValue(eth);

    const cost = await CHAIN_REGISTRY[chain].estimateGasCostUsd({});

    expect(fetchGasPrice).toHaveBeenCalledWith(chain);
    expect(getEthPrice).toHaveBeenCalledTimes(1);
    expect(cost).toBeCloseTo(usd, 10);
  });

  it('ignores the tx argument entirely (fixed per-chain gas limit)', async () => {
    vi.mocked(fetchGasPrice).mockResolvedValue(20);
    vi.mocked(getEthPrice).mockResolvedValue(3000);

    const withTx = await CHAIN_REGISTRY.ethereum.estimateGasCostUsd({ to: '0xabc', gas: 21000n });
    const withoutTx = await CHAIN_REGISTRY.ethereum.estimateGasCostUsd(undefined);
    expect(withTx).toBe(withoutTx);
  });

  it('truncates sub-wei gas prices to a zero cost (BigInt floor)', async () => {
    vi.mocked(fetchGasPrice).mockResolvedValue(0.4e-9); // 0.4 wei → floor → 0
    vi.mocked(getEthPrice).mockResolvedValue(3000);
    await expect(CHAIN_REGISTRY.ethereum.estimateGasCostUsd({})).resolves.toBe(0);
  });

  it('rejects when the ETH price lookup fails (no fail-soft fallback here)', async () => {
    vi.mocked(fetchGasPrice).mockResolvedValue(20);
    vi.mocked(getEthPrice).mockRejectedValue(new Error('price feed down'));
    await expect(CHAIN_REGISTRY.arbitrum.estimateGasCostUsd({})).rejects.toThrow('price feed down');
  });
});

// ─── Solana plugin ────────────────────────────────────────────────────────────

describe('solanaPlugin', () => {
  it('builds a Connection against the server-resolved solana RPC URL', async () => {
    vi.mocked(getRpcUrl).mockReturnValue('https://sol-rpc.example/v2/test-key');

    const client = await CHAIN_REGISTRY.solana.getRpcClient();

    expect(getRpcUrl).toHaveBeenCalledWith('solana');
    expect(connectionCtor).toHaveBeenCalledTimes(1);
    expect(connectionCtor).toHaveBeenCalledWith('https://sol-rpc.example/v2/test-key');
    expect((client as { rpcEndpoint: string }).rpcEndpoint).toBe(
      'https://sol-rpc.example/v2/test-key',
    );
  });

  it('estimates a flat negligible fee without touching RPC or price feeds', async () => {
    await expect(CHAIN_REGISTRY.solana.estimateGasCostUsd({ some: 'tx' })).resolves.toBe(0.001);
    expect(fetchGasPrice).not.toHaveBeenCalled();
    expect(getEthPrice).not.toHaveBeenCalled();
    expect(getPublicClient).not.toHaveBeenCalled();
  });
});
