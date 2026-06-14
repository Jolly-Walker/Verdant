import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/utils/fetch', () => ({
  fetchWithTimeout: vi.fn(),
}));

vi.mock('@/lib/data/prices', () => ({
  fetchTokenPrices: vi.fn().mockResolvedValue({ 'coingecko:usd-coin': 1.0 }),
}));

import { BRIDGE_QUOTE_TTL_MS } from '@/constants/bridges';
import { fetchWithTimeout } from '@/lib/utils/fetch';
import type { BridgeQuote, BridgeQuoteParams, ChainId } from '@/types/shared';
import { layerzeroBridgePlugin } from '../layerzero';

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as unknown as Response;
}

describe('layerzeroBridgePlugin', () => {
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a quote derived from the real Circle fee schedule (standard = 0 bps)', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(
      jsonResponse([
        { finalityThreshold: 1000, minimumFee: 1 },
        { finalityThreshold: 2000, minimumFee: 0 },
      ]),
    );

    const quote = await layerzeroBridgePlugin.getQuote(mockQuoteParams);

    expect(quote).not.toBeNull();
    expect(quote?.bridgeId).toBe('layerzero');
    expect(quote?.feeUsd).toBe(0); // standard transfer, 0 bps
    expect(quote?.expectedOutputAmount).toBe('100000000');
    // @ts-expect-error - accessing rawQuote
    expect(quote?.rawQuote.destDomain).toBe(3); // Arbitrum
    // @ts-expect-error - accessing rawQuote
    expect(quote?.rawQuote.minFinalityThreshold).toBe(2000);
    expect(quote?.expiresAt.getTime()).toBe(mockNow + BRIDGE_QUOTE_TTL_MS);
  });

  it('computes a non-zero fee when the route charges bps', async () => {
    // 10 bps on 100 USDC = 0.1 USDC
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(
      jsonResponse([{ finalityThreshold: 2000, minimumFee: 10 }]),
    );

    const quote = await layerzeroBridgePlugin.getQuote(mockQuoteParams);
    expect(quote?.feeUsd).toBeCloseTo(0.1, 6);
    expect(quote?.expectedOutputAmount).toBe('99900000'); // 100 - 0.1 USDC
  });

  it('falls back to a 0-fee quote when the fee API is unreachable', async () => {
    vi.mocked(fetchWithTimeout).mockRejectedValueOnce(new Error('network'));
    const quote = await layerzeroBridgePlugin.getQuote(mockQuoteParams);
    expect(quote?.feeUsd).toBe(0);
    expect(quote?.expectedOutputAmount).toBe('100000000');
  });

  it('builds a CCTP v2 depositForBurn transaction', async () => {
    const mockQuote: Partial<BridgeQuote> = {
      bridgeId: 'layerzero',
      rawQuote: {
        destDomain: 3,
        fromChain: 'ethereum',
        toChain: 'arbitrum',
        amount: '100000000',
        recipientAddress: '0x1234567890123456789012345678901234567890',
        maxFee: '0',
        minFinalityThreshold: 2000,
      },
    };

    const tx = await layerzeroBridgePlugin.buildBridgeTx(mockQuote as BridgeQuote);

    expect(tx.chainId).toBe(1);
    expect(tx.to).toBe('0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d');
    expect(tx.data).toBeDefined();
    expect(tx.value).toBe(0n);
    expect(tx.description).toContain('Bridge USDC');
  });

  it('reports complete once Circle has attested the burn', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(
      jsonResponse({
        messages: [
          {
            status: 'complete',
            attestation: '0xabcd',
            forwardTxHash: '0xdest',
          },
        ],
      }),
    );

    const status = await layerzeroBridgePlugin.pollStatus('0x123', 'ethereum');
    expect(status.status).toBe('complete');
    expect(status.destinationTxHash).toBe('0xdest');
  });

  it('reports pending while awaiting confirmations', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(
      jsonResponse({ messages: [{ status: 'pending_confirmations', attestation: null }] }),
    );
    const status = await layerzeroBridgePlugin.pollStatus('0x123', 'ethereum');
    expect(status.status).toBe('pending');
    expect(status.trackingUrl).toContain('0x123');
  });

  it('returns null for unsupported token', async () => {
    const quote = await layerzeroBridgePlugin.getQuote({ ...mockQuoteParams, token: 'ETH' });
    expect(quote).toBeNull();
  });

  it('returns null for unsupported route', async () => {
    const quote = await layerzeroBridgePlugin.getQuote({ ...mockQuoteParams, toChain: 'solana' });
    expect(quote).toBeNull();
  });

  it('throws for unsupported fromChain in buildBridgeTx', async () => {
    const mockQuote: Partial<BridgeQuote> = {
      bridgeId: 'layerzero',
      rawQuote: {
        fromChain: 'solana' as unknown as ChainId,
        amount: '1000000',
        destDomain: 3,
      },
    };
    await expect(layerzeroBridgePlugin.buildBridgeTx(mockQuote as BridgeQuote)).rejects.toThrow(
      'Unsupported chain solana',
    );
  });
});
