import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { SequencePlan } from '@/types/sequencer';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/data/sequencePlans', () => ({
  createSequencePlan: vi.fn(),
}));

vi.mock('@/lib/sequencer/engine', () => ({
  serializeSequencePlan: vi.fn((plan) => ({
    ...plan,
    createdAt: plan.createdAt?.toISOString ? plan.createdAt.toISOString() : plan.createdAt,
  })),
}));

vi.mock('@/lib/sequencer/templates/bridgeAndDeposit', () => ({
  buildBridgeAndDepositPlan: vi.fn(),
}));

vi.mock('@/lib/sequencer/templates/repayAndWithdraw', () => ({
  buildRepayAndWithdrawPlan: vi.fn(),
}));

vi.mock('@/lib/sequencer/templates/crossChainRebalance', () => ({
  buildCrossChainRebalancePlan: vi.fn(),
}));

vi.mock('@/lib/sequencer/templates/deleverageAave', () => ({
  buildDeleverageAavePlan: vi.fn(),
}));

vi.mock('@/lib/sequencer/templates/exitPendle', () => ({
  buildExitPendlePlan: vi.fn(),
}));

vi.mock('@/lib/data/prices', () => ({
  fetchTokenPrices: vi.fn().mockResolvedValue({
    'coingecko:ethereum': 3000,
    'coingecko:usd-coin': 1,
  }),
}));

describe('Plan API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockRequest = (body: unknown) => {
    return {
      json: async () => body,
    } as Request;
  };

  it('should save a custom plan successfully', async () => {
    const { createSequencePlan } = await import('@/lib/data/sequencePlans');
    
    const mockPlan: Partial<SequencePlan> = {
      id: 'mock-uuid',
      walletAddress: '0x8ab71ad4037a06002fdcfbef051f2fa9799df240',
      description: 'Custom sequence: withdraw',
      steps: [],
      totalCostUsd: 0,
      status: 'draft',
      templateId: 'custom'
    };

    vi.mocked(createSequencePlan).mockImplementation(async (plan) => ({
      ...plan,
      id: 'saved-id',
      createdAt: new Date('2026-05-23T12:00:00Z'),
    } as unknown as SequencePlan));

    const req = createMockRequest({
      templateId: 'custom',
      customPlan: mockPlan,
      walletAddress: '0x8ab71ad4037a06002fdcfbef051f2fa9799df240'
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.plan.templateId).toBe('custom');
    expect(data.plan.id).toBe('saved-id');
    expect(createSequencePlan).toHaveBeenCalled();
  });

  it('should fail if customPlan is missing for custom templateId', async () => {
    const req = createMockRequest({
      templateId: 'custom',
      walletAddress: '0x8ab71ad4037a06002fdcfbef051f2fa9799df240'
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('customPlan is required for templateId custom');
  });
});
