import { decodeFunctionData } from 'viem';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { BRIDGE_QUOTE_TTL_MS } from '@/constants/bridges';
import { fetchTokenPrices } from '@/lib/data/prices';
import type { BridgeQuote, BridgeQuoteParams } from '@/types/shared';
import { acrossBridgePlugin } from '../across';

vi.mock('@/lib/data/prices', () => ({
  fetchTokenPrices: vi.fn(),
}));

describe('acrossBridgePlugin', () => {
  const mockNow = 1700000000000;
  const mockQuoteParams: BridgeQuoteParams = {
    fromChain: 'ethereum',
    toChain: 'arbitrum',
    token: 'USDC',
    amount: '100000000', // 100 USDC (6 decimals)
    recipientAddress: '0x1234567890123456789012345678901234567890',
    slippagePercent: 0.1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(mockNow);
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return a quote correctly', async () => {
    // Across v3 /suggested-fees nests fees under `<fee>.total`; `totalRelayFee`
    // already bundles gas + capital + LP and is the amount deducted from input.
    const mockApiResponse = {
      totalRelayFee: { pct: '1600000000000000', total: '160000' },
      relayerGasFee: { pct: '500000000000000', total: '50000' },
      relayerCapitalFee: { pct: '100000000000000', total: '10000' },
      lpFee: { pct: '1000000000000000', total: '100000' },
      expectedFillTimeSec: 120,
      timestamp: 1700000000,
    };

    // @ts-expect-error - mocking fetch
    (global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    // @ts-expect-error - mocking fetchTokenPrices
    (fetchTokenPrices as vi.Mock).mockResolvedValueOnce({
      'coingecko:usd-coin': 1.0,
    });

    const quote = await acrossBridgePlugin.getQuote(mockQuoteParams);

    expect(quote).not.toBeNull();
    expect(quote?.bridgeId).toBe('across');
    expect(quote?.expectedOutputAmount).toBe('99840000'); // 100000000 - totalRelayFee.total (160000)
    expect(quote?.feeUsd).toBeCloseTo(0.16, 2); // (160000 / 1e6) * 1.0

    expect(quote?.expiresAt.getTime()).toBe(mockNow + BRIDGE_QUOTE_TTL_MS);
  });

  it('falls back to summing sub-fees when totalRelayFee is absent', async () => {
    // Shape change / partial payload: no `totalRelayFee`, only the sub-fees. The
    // fee must still be deducted, not silently treated as 0 (which would
    // over-promise the full input as output).
    const mockApiResponse = {
      relayerGasFee: { pct: '0', total: '50000' },
      relayerCapitalFee: { pct: '0', total: '10000' },
      lpFee: { pct: '0', total: '100000' },
      expectedFillTimeSec: 120,
      timestamp: 1700000000,
    };

    // @ts-expect-error - mocking fetch
    (global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });
    // @ts-expect-error - mocking fetchTokenPrices
    (fetchTokenPrices as vi.Mock).mockResolvedValueOnce({ 'coingecko:usd-coin': 1.0 });

    const quote = await acrossBridgePlugin.getQuote(mockQuoteParams);
    // 50000 + 10000 + 100000 = 160000 deducted -> 99840000.
    expect(quote?.expectedOutputAmount).toBe('99840000');
  });

  it('returns null when the response carries no fee fields at all', async () => {
    // @ts-expect-error - mocking fetch
    (global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ expectedFillTimeSec: 120, timestamp: 1700000000 }),
    });

    const quote = await acrossBridgePlugin.getQuote(mockQuoteParams);
    expect(quote).toBeNull();
  });

  it('applies the slippage tolerance to the depositV3 outputAmount', async () => {
    const depositV3Abi = [
      {
        inputs: [
          { name: 'depositor', type: 'address' },
          { name: 'recipient', type: 'address' },
          { name: 'inputToken', type: 'address' },
          { name: 'outputToken', type: 'address' },
          { name: 'inputAmount', type: 'uint256' },
          { name: 'outputAmount', type: 'uint256' },
          { name: 'destinationChainId', type: 'uint256' },
          { name: 'exclusiveRelayer', type: 'address' },
          { name: 'quoteTimestamp', type: 'uint32' },
          { name: 'fillDeadline', type: 'uint32' },
          { name: 'exclusivityDeadline', type: 'uint32' },
          { name: 'message', type: 'bytes' },
        ],
        name: 'depositV3',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
      },
    ] as const;

    const expectedOutput = 99840000n;
    const mockQuote: Partial<BridgeQuote> = {
      bridgeId: 'across',
      expectedOutputAmount: expectedOutput.toString(),
      slippagePercent: 1, // 1% => 100 bps
      expiresAt: new Date(),
      rawQuote: {
        inputAmount: '100000000',
        inputToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        outputToken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        originChainId: 1,
        destinationChainId: 42161,
        recipientAddress: '0x1234567890123456789012345678901234567890',
        timestamp: 1700000000,
        tokenSymbol: 'USDC',
        decimals: 6,
      },
    };

    const tx = await acrossBridgePlugin.buildBridgeTx(mockQuote as BridgeQuote);
    const decoded = decodeFunctionData({ abi: depositV3Abi, data: tx.data as `0x${string}` });
    const outputAmount = decoded.args[5] as bigint;

    expect(outputAmount).toBe((expectedOutput * 9900n) / 10000n);
    expect(outputAmount).toBeLessThan(expectedOutput);
  });

  it('should build a bridge transaction correctly', async () => {
    const mockQuote: Partial<BridgeQuote> = {
      bridgeId: 'across',
      feeUsd: 0.16,
      estimatedTimeSeconds: 120,
      expectedOutputAmount: '99840000',
      slippagePercent: 0.1,
      expiresAt: new Date(),
      rawQuote: {
        inputAmount: '100000000',
        inputToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        outputToken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        originChainId: 1,
        destinationChainId: 42161,
        recipientAddress: '0x1234567890123456789012345678901234567890',
        timestamp: 1700000000,
        tokenSymbol: 'USDC',
        decimals: 6,
      },
    };

    const tx = await acrossBridgePlugin.buildBridgeTx(mockQuote as BridgeQuote);

    expect(tx.chainId).toBe(1);
    expect(tx.to).toBe('0x59728544B08AB483533076417FbBB2fD0B17CE3a');
    expect(tx.data).toBeDefined();
    expect(tx.data.startsWith('0x')).toBe(true);
    expect(tx.value).toBe(0n);
  });

  it('should build a native ETH bridge transaction correctly', async () => {
    const mockQuote: Partial<BridgeQuote> = {
      bridgeId: 'across',
      feeUsd: 5.0,
      estimatedTimeSeconds: 120,
      expectedOutputAmount: '990000000000000000',
      slippagePercent: 0.1,
      expiresAt: new Date(),
      rawQuote: {
        inputAmount: '1000000000000000000',
        inputToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        outputToken: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        originChainId: 1,
        destinationChainId: 42161,
        recipientAddress: '0x1234567890123456789012345678901234567890',
        timestamp: 1700000000,
        tokenSymbol: 'ETH',
        decimals: 18,
      },
    };

    const tx = await acrossBridgePlugin.buildBridgeTx(mockQuote as BridgeQuote);

    expect(tx.chainId).toBe(1);
    expect(tx.value).toBe(1000000000000000000n);
  });

  it('should poll status correctly', async () => {
    // @ts-expect-error - mocking fetch
    (global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'filled',
        fillTxs: [{ hash: '0xabc' }],
        destinationChainId: 42161, // Arbitrum
      }),
    });

    const status = await acrossBridgePlugin.pollStatus('0x123', 'ethereum');

    expect(status.status).toBe('complete');
    expect(status.destinationTxHash).toBe('0xabc');
    expect(status.trackingUrl).toBe('https://arbiscan.io/tx/0xabc');
  });

  it('should return pending status if not filled', async () => {
    // @ts-expect-error - mocking fetch
    (global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'pending' }),
    });

    const status = await acrossBridgePlugin.pollStatus('0x123', 'ethereum');

    expect(status.status).toBe('pending');
    expect(status.trackingUrl).toBe('https://across.to/explorer/transactions/0x123');
  });

  it('should return failed status if expired', async () => {
    // @ts-expect-error - mocking fetch
    (global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'expired' }),
    });

    const status = await acrossBridgePlugin.pollStatus('0x123', 'ethereum');

    expect(status.status).toBe('failed');
    expect(status.errorMessage).toBe('Across deposit expired');
    expect(status.trackingUrl).toBe('https://across.to/explorer/transactions/0x123');
  });

  it('should return null for unsupported token', async () => {
    const quote = await acrossBridgePlugin.getQuote({
      ...mockQuoteParams,
      token: 'INVALID',
    });
    expect(quote).toBeNull();
  });

  it('should return null for unsupported route', async () => {
    const quote = await acrossBridgePlugin.getQuote({
      ...mockQuoteParams,
      toChain: 'solana',
    });
    expect(quote).toBeNull();
  });

  it('should return null when API returns non-OK response', async () => {
    // @ts-expect-error - mocking fetch
    (global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: false,
    });

    const quote = await acrossBridgePlugin.getQuote(mockQuoteParams);
    expect(quote).toBeNull();
  });

  it('should return null when API throws', async () => {
    // @ts-expect-error - mocking fetch
    (global.fetch as vi.Mock).mockRejectedValueOnce(new Error('Network error'));

    const quote = await acrossBridgePlugin.getQuote(mockQuoteParams);
    expect(quote).toBeNull();
  });

  it('should return null if getQuote times out', async () => {
    // Mock fetch to hang and handle abort signal
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (_url: unknown, options: { signal?: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              reject(new Error('The user aborted a request.'));
            });
          }
        });
      },
    );

    const quotePromise = acrossBridgePlugin.getQuote(mockQuoteParams);

    // Advance timers by 8001ms to trigger timeout
    await vi.advanceTimersByTimeAsync(8001);

    const quote = await quotePromise;
    expect(quote).toBeNull();
  }, 15000);

  it('should return pending if pollStatus times out', async () => {
    // Mock fetch to hang and handle abort signal
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (_url: unknown, options: { signal?: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              reject(new Error('The user aborted a request.'));
            });
          }
        });
      },
    );

    const statusPromise = acrossBridgePlugin.pollStatus('0x123', 'ethereum');

    // Advance timers by 8001ms to trigger timeout
    await vi.advanceTimersByTimeAsync(8001);

    const status = await statusPromise;
    expect(status.status).toBe('pending');
  }, 15000);
});
