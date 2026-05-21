import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';
import { simulateTransaction } from '@/lib/simulation/simulate';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/plugins/bridges', () => ({
  BRIDGE_REGISTRY: {
    across: {
      buildBridgeTx: vi.fn().mockResolvedValue({
        chainId: 1,
        to: '0xContract',
        data: '0xData',
        value: 1000000000000000000n,
        description: 'Test Bridge'
      })
    }
  }
}));

vi.mock('@/lib/simulation/simulate', () => ({
  simulateTransaction: vi.fn()
}));

describe('Bridge Build API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockRequest = (body: Record<string, unknown>) => {
    return new NextRequest('http://localhost/api/bridges/build', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  };

  it('returns 400 if validation fails due to missing walletAddress', async () => {
    const req = createMockRequest({
      bridgeId: 'across',
      quote: {
        rawQuote: {
          recipientAddress: '0x123',
          originChainId: 1
        }
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('returns 400 if walletAddress does not match recipientAddress', async () => {
    const req = createMockRequest({
      bridgeId: 'across',
      walletAddress: '0xMismatch',
      quote: {
        rawQuote: {
          recipientAddress: '0x123',
          originChainId: 1
        }
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('walletAddress does not match recipientAddress');
  });

  it('returns 400 if origin chain is unsupported', async () => {
    const req = createMockRequest({
      bridgeId: 'across',
      walletAddress: '0x123',
      quote: {
        rawQuote: {
          recipientAddress: '0x123',
          originChainId: 999999 // Unsupported chain ID
        }
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Unsupported origin chain');
  });

  it('returns 400 if simulation fails', async () => {
    vi.mocked(simulateTransaction).mockResolvedValue({
      success: false,
      revertReason: 'Insufficient balance',
      simulatedAt: new Date()
    });

    const req = createMockRequest({
      bridgeId: 'across',
      walletAddress: '0x123',
      quote: {
        rawQuote: {
          recipientAddress: '0x123',
          originChainId: 1
        }
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Insufficient balance');
  });

  it('returns 200 and unsignedTx if simulation succeeds', async () => {
    vi.mocked(simulateTransaction).mockResolvedValue({
      success: true,
      gasEstimate: 21000n,
      gasCostUsd: 0.5,
      simulatedAt: new Date()
    });

    const req = createMockRequest({
      bridgeId: 'across',
      walletAddress: '0x123',
      quote: {
        rawQuote: {
          recipientAddress: '0x123',
          originChainId: 1
        }
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.unsignedTx).toBeDefined();
    expect(data.unsignedTx.to).toBe('0xContract');
  });
});
