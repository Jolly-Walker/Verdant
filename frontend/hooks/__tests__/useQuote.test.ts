/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CostPreviewInput } from '@/types/quote';
import { useQuote } from '../useQuote';

const INPUT: CostPreviewInput = {
  asset: 'USDC',
  amountUsd: 50_000,
  sourceProtocol: 'aave',
  sourceChain: 'ethereum',
  destProtocol: 'morpho',
  destChain: 'base',
};

const QUOTE_PAYLOAD = {
  steps: [],
  totalCostUsd: 42.5,
  totalGasUsd: 12.5,
  totalBridgeFeeUsd: 20,
  totalSlippageUsd: 10,
  currentApyDecimal: 0.03,
  targetApyDecimal: 0.05,
  netUpliftDecimal: 0.02,
  dailyYieldGainUsd: 2.7,
  breakEvenDays: 16,
  targetUtilisationDecimal: 0.9,
  quoteFetchedAt: '2026-07-11T00:00:00.000Z',
  warnings: [],
};

const fetchMock = vi.fn();

function jsonResponse(body: unknown, ok = true): Response {
  // Minimal Response stand-in — the hook only reads .ok and .json().
  return { ok, json: async () => body } as unknown as Response;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('useQuote', () => {
  it('debounces 800ms, then POSTs the input to /api/quote and stores the quote', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(QUOTE_PAYLOAD));
    const { result } = renderHook(() => useQuote(INPUT));

    expect(fetchMock).not.toHaveBeenCalled();
    await advance(799);
    expect(fetchMock).not.toHaveBeenCalled();

    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(INPUT),
    });

    expect(result.current.quote?.totalCostUsd).toBe(42.5);
    expect(result.current.quote?.quoteFetchedAt).toBeInstanceOf(Date);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.quoteAge).toBe(0);
    expect(result.current.isStale).toBe(false);
  });

  it('collapses rapid input changes into a single fetch with the latest input', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(QUOTE_PAYLOAD));
    const { rerender } = renderHook(({ input }) => useQuote(input), {
      initialProps: { input: INPUT },
    });

    await advance(400);
    const newerInput: CostPreviewInput = { ...INPUT, amountUsd: 75_000 };
    rerender({ input: newerInput });

    await advance(799);
    expect(fetchMock).not.toHaveBeenCalled(); // timer restarted on change

    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).amountUsd).toBe(75_000);
  });

  it('does not fetch for null input, and clears quote/error when input becomes null', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(QUOTE_PAYLOAD));
    const { result, rerender } = renderHook(
      ({ input }: { input: CostPreviewInput | null }) => useQuote(input),
      { initialProps: { input: INPUT as CostPreviewInput | null } },
    );

    await advance(800);
    expect(result.current.quote).not.toBeNull();

    rerender({ input: null });
    expect(result.current.quote).toBeNull();
    expect(result.current.error).toBeNull();

    await advance(2000);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no further fetches
  });

  it('surfaces the server error message on a non-ok response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'No route found' }, false));
    const { result } = renderHook(() => useQuote(INPUT));

    await advance(800);

    expect(result.current.error).toBe('No route found');
    expect(result.current.quote).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('falls back to a status message when the error body is unparseable', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response);
    const { result } = renderHook(() => useQuote(INPUT));

    await advance(800);

    expect(result.current.error).toBe('Quote fetch failed: 502');
  });

  it('reports a congestion message when the network request rejects', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useQuote(INPUT));

    await advance(800);

    expect(result.current.error).toBe('Could not get quote. Network may be congested.');
    expect(result.current.quote).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('ignores an out-of-order (stale) response, keeping the newest quote', async () => {
    let resolveFirst: (r: Response) => void = () => {};
    fetchMock
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ ...QUOTE_PAYLOAD, totalCostUsd: 99 }));

    const { result } = renderHook(() => useQuote(INPUT));
    await advance(800); // fires fetch #1 (left pending)

    // Manual refetch fires fetch #2, which resolves first.
    await act(async () => {
      result.current.refetch();
    });
    expect(result.current.quote?.totalCostUsd).toBe(99);

    // Fetch #1 finally resolves with older data — must be discarded.
    await act(async () => {
      resolveFirst(jsonResponse({ ...QUOTE_PAYLOAD, totalCostUsd: 1 }));
    });
    expect(result.current.quote?.totalCostUsd).toBe(99);
    expect(result.current.isLoading).toBe(false);
  });

  it('tracks quote age and flags staleness after 30s; refetch resets it', async () => {
    fetchMock.mockResolvedValue(jsonResponse(QUOTE_PAYLOAD));
    const { result } = renderHook(() => useQuote(INPUT));

    await advance(800);
    expect(result.current.isStale).toBe(false);

    await advance(31_000);
    expect(result.current.quoteAge).toBeGreaterThanOrEqual(31);
    expect(result.current.isStale).toBe(true);

    // Manual refresh bypasses the debounce and resets staleness.
    await act(async () => {
      result.current.refetch();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.quoteAge).toBe(0);
    expect(result.current.isStale).toBe(false);
  });
});
