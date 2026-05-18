import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { SequencePlan, SequenceStep } from '@/types/sequencer';
import { ChainId, TxBuildParams } from '@/types/shared';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/data/sequencePlans', () => ({
  getSequencePlan: vi.fn(),
  updateSequencePlanStep: vi.fn(),
}));

vi.mock('@/lib/simulation/simulate', () => ({
  simulateTransaction: vi.fn(),
}));

vi.mock('@/lib/sequencer/engine', () => ({
  applyStepUpdate: vi.fn(),
  computePlanStatus: vi.fn(),
  serializeSequenceStep: vi.fn((step) => ({
    ...step,
    unsignedTx: step.unsignedTx ? {
      ...step.unsignedTx,
      value: step.unsignedTx.value.toString(),
    } : undefined
  })),
}));

vi.mock('@/lib/data/prices', () => ({
  getNativeAssetPrice: vi.fn(),
}));

vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({
    getGasPrice: vi.fn().mockResolvedValue(10n),
  })),
  http: vi.fn(),
}));

vi.mock('@/lib/server/rpc', () => ({
  getRpcUrl: vi.fn().mockReturnValue('http://localhost:8545'),
}));

vi.mock('@/lib/plugins/protocols', () => ({
  PROTOCOL_REGISTRY: {
    aave: {
      builder: {
        buildTx: vi.fn(),
      }
    }
  }
}));

vi.mock('@/lib/plugins/bridges', () => ({
  BRIDGE_REGISTRY: {}
}));

describe('Simulate API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockRequest = (body: unknown) => {
    return {
      json: async () => body,
    } as Request;
  };

  it('should return 403 if wallet addresses do not match (auth failure)', async () => {
    const { getSequencePlan } = await import('@/lib/data/sequencePlans');
    vi.mocked(getSequencePlan).mockResolvedValue({
      id: 'plan-id',
      walletAddress: '0xAuthorized',
      steps: [],
    } as unknown as SequencePlan);

    const req = createMockRequest({
      planId: '00000000-0000-0000-0000-000000000000',
      stepId: 'step-1',
      walletAddress: '0xUnauthorized'
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe('Forbidden');
  });

  it('should process a successful simulation (happy path)', async () => {
    const { getSequencePlan, updateSequencePlanStep } = await import('@/lib/data/sequencePlans');
    const { simulateTransaction } = await import('@/lib/simulation/simulate');
    const { applyStepUpdate, computePlanStatus } = await import('@/lib/sequencer/engine');
    const { getNativeAssetPrice } = await import('@/lib/data/prices');
    const { PROTOCOL_REGISTRY } = await import('@/lib/plugins/protocols');

    const mockStep: SequenceStep = {
      id: 'step-1',
      label: 'Test Step',
      chain: 'ethereum' as ChainId,
      pluginId: 'aave',
      buildParams: {} as TxBuildParams,
      status: 'pending',
      dependsOn: []
    };

    vi.mocked(getSequencePlan).mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000000',
      walletAddress: '0xAuthorized',
      steps: [mockStep],
      status: 'draft',
      totalCostUsd: 0,
      description: 'Test Plan',
      createdAt: new Date()
    });

    vi.mocked(PROTOCOL_REGISTRY.aave.builder.buildTx).mockResolvedValue([{
      to: '0xTo',
      data: '0xData',
      value: 0n,
      chainId: 1,
      description: 'Test Tx'
    }]);

    vi.mocked(simulateTransaction).mockResolvedValue({
      success: true,
      gasEstimate: 21000n,
      simulatedAt: new Date()
    });

    vi.mocked(applyStepUpdate).mockReturnValue({
      id: 'plan-id',
      walletAddress: '0xAuthorized',
      steps: [{ ...mockStep, unsignedTx: { to: '0xTo', data: '0xData', value: 0n, chainId: 1, description: 'Test' } }],
      status: 'in-progress',
      totalCostUsd: 0,
      description: 'Test',
      createdAt: new Date()
    });

    vi.mocked(computePlanStatus).mockReturnValue('in-progress');
    vi.mocked(updateSequencePlanStep).mockResolvedValue(true);
    vi.mocked(getNativeAssetPrice).mockResolvedValue(3000);

    const req = createMockRequest({
      planId: '00000000-0000-0000-0000-000000000000',
      stepId: 'step-1',
      walletAddress: '0xAuthorized'
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.simulation.success).toBe(true);
    expect(updateSequencePlanStep).toHaveBeenCalled();
  });

  it('should handle a failed simulation', async () => {
    const { getSequencePlan, updateSequencePlanStep } = await import('@/lib/data/sequencePlans');
    const { simulateTransaction } = await import('@/lib/simulation/simulate');
    const { applyStepUpdate } = await import('@/lib/sequencer/engine');

    const mockStep: SequenceStep = {
      id: 'step-1',
      label: 'Test Step',
      chain: 'ethereum' as ChainId,
      pluginId: 'aave',
      buildParams: {} as TxBuildParams,
      status: 'pending',
      dependsOn: [],
      unsignedTx: { to: '0xTo', data: '0xData', value: 0n, chainId: 1, description: 'Test' }
    };

    vi.mocked(getSequencePlan).mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000000',
      walletAddress: '0xAuthorized',
      steps: [mockStep],
    } as unknown as SequencePlan);

    vi.mocked(simulateTransaction).mockResolvedValue({
      success: false,
      revertReason: 'Insufficient funds',
      simulatedAt: new Date()
    });

    vi.mocked(applyStepUpdate).mockReturnValue({
      steps: [{ ...mockStep, status: 'failed' }]
    } as unknown as SequencePlan);

    vi.mocked(updateSequencePlanStep).mockResolvedValue(true);

    const req = createMockRequest({
      planId: '00000000-0000-0000-0000-000000000000',
      stepId: 'step-1',
      walletAddress: '0xAuthorized'
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.simulation.success).toBe(false);
    expect(data.simulation.revertReason).toBe('Insufficient funds');
  });

  it('should return 400 if buildTx returns an empty array', async () => {
    const { getSequencePlan } = await import('@/lib/data/sequencePlans');
    const { PROTOCOL_REGISTRY } = await import('@/lib/plugins/protocols');

    vi.mocked(getSequencePlan).mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000000',
      walletAddress: '0xAuthorized',
      steps: [{
        id: 'step-1',
        chain: 'ethereum',
        pluginId: 'aave',
        buildParams: {} as TxBuildParams,
        status: 'pending',
        dependsOn: []
      }],
    } as unknown as SequencePlan);

    vi.mocked(PROTOCOL_REGISTRY.aave.builder.buildTx).mockResolvedValue([]);

    const req = createMockRequest({
      planId: '00000000-0000-0000-0000-000000000000',
      stepId: 'step-1',
      walletAddress: '0xAuthorized'
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('failed to build one');
  });

  it('should detect Pendle stub data and return 400', async () => {
    const { getSequencePlan } = await import('@/lib/data/sequencePlans');

    vi.mocked(getSequencePlan).mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000000',
      walletAddress: '0xAuthorized',
      steps: [{
        id: 'step-1',
        chain: 'ethereum',
        pluginId: 'pendle',
        buildParams: {} as TxBuildParams,
        status: 'pending',
        dependsOn: [],
        unsignedTx: { data: '0x', value: 0n, to: '0x', chainId: 1, description: 'Stub' }
      }],
    } as unknown as SequencePlan);

    const req = createMockRequest({
      planId: '00000000-0000-0000-0000-000000000000',
      stepId: 'step-1',
      walletAddress: '0xAuthorized'
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('stub data');
  });

  it('should return 500 if updateSequencePlanStep fails', async () => {
    const { getSequencePlan, updateSequencePlanStep } = await import('@/lib/data/sequencePlans');
    const { simulateTransaction } = await import('@/lib/simulation/simulate');
    const { applyStepUpdate } = await import('@/lib/sequencer/engine');

    vi.mocked(getSequencePlan).mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000000',
      walletAddress: '0xAuthorized',
      steps: [{
        id: 'step-1',
        chain: 'ethereum',
        pluginId: 'aave',
        buildParams: {} as TxBuildParams,
        status: 'pending',
        dependsOn: [],
        unsignedTx: { to: '0xTo', data: '0xData', value: 0n, chainId: 1, description: 'Test' }
      }],
    } as unknown as SequencePlan);

    vi.mocked(simulateTransaction).mockResolvedValue({ 
      success: true, 
      gasEstimate: 100000n, 
      simulatedAt: new Date() 
    });
    vi.mocked(applyStepUpdate).mockReturnValue({ steps: [] } as unknown as SequencePlan);
    vi.mocked(updateSequencePlanStep).mockResolvedValue(false);


    const req = createMockRequest({
      planId: '00000000-0000-0000-0000-000000000000',
      stepId: 'step-1',
      walletAddress: '0xAuthorized'
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('Failed to save simulation result');
  });
});
