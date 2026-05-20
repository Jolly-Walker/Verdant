import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/data/supabase', () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  gt: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn(() => ({
                        maybeSingle: vi.fn().mockResolvedValue({ data: null })
                      }))
                    }))
                  }))
                }))
              }))
            }))
          }))
        }))
      }))
    }))
  }))
}));

vi.mock('@/lib/plugins/bridges', () => ({
  BRIDGE_REGISTRY: {}
}));

describe('Bridge Quote API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockRequest = (url: string) => {
    return new NextRequest(new URL(url, 'http://localhost'));
  };

  it('should return 400 for an invalid EVM recipient address on ethereum', async () => {
    const req = createMockRequest('http://localhost/api/bridges/quote?fromChain=arbitrum&toChain=ethereum&token=USDC&amount=1000000&recipientAddress=invalid-evm-address');

    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid recipient address for ethereum');
  });

  it('should return 400 for an invalid Solana recipient address on solana', async () => {
    const req = createMockRequest('http://localhost/api/bridges/quote?fromChain=ethereum&toChain=solana&token=USDC&amount=1000000&recipientAddress=invalid-solana-address');

    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid recipient address for solana');
  });

  it('should return 400 when an EVM address is provided for solana', async () => {
    const req = createMockRequest('http://localhost/api/bridges/quote?fromChain=ethereum&toChain=solana&token=USDC&amount=1000000&recipientAddress=0x742d35Cc6634C0532925a3b844Bc454e4438f44e');

    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid recipient address for solana');
  });

  it('should return 400 when a Solana address is provided for ethereum', async () => {
    const req = createMockRequest('http://localhost/api/bridges/quote?fromChain=solana&toChain=ethereum&token=USDC&amount=1000000&recipientAddress=HN7c7Ex3PBvLSuuJA4asBgXWoCBy9TGR2fN8zH7r1S8A');

    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid recipient address for ethereum');
  });
});
