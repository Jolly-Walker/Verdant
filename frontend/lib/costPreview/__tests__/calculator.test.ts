import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/data/prices', () => ({
  getEthPrice: vi.fn().mockResolvedValue(3000),
  fetchTokenPrices: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/server/rpc', () => ({
  fetchGasPrice: vi.fn().mockResolvedValue(20),
}));

vi.mock('@/lib/simulation/simulate', () => ({
  estimateBridgeGas: vi.fn().mockResolvedValue(150_000),
  estimateDepositGas: vi.fn().mockResolvedValue(120_000),
}));

vi.mock('@/lib/data/defillama', () => ({
  findPoolApy: vi.fn(),
}));

import { findPoolApy } from '@/lib/data/defillama';
import { calculateCostPreview } from '../calculator';

describe('calculateCostPreview — legacy quote path APY lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findPoolApy).mockResolvedValue({
      poolId: 'pool-1',
      apy: 0.05,
      borrowApyDecimal: null,
      tvlUsd: 1_000_000,
      utilisationDecimal: null,
    });
  });

  it('resolves ProtocolId/ChainId to DefiLlama slug + chain name before lookup', async () => {
    const result = await calculateCostPreview({
      asset: 'USDC',
      amountUsd: 10_000,
      sourceProtocol: 'aave',
      sourceChain: 'ethereum',
      destProtocol: 'morpho',
      destChain: 'base',
    });

    // Must use DefiLlama identifiers ('aave-v3' / 'Ethereum'), NOT raw ids.
    expect(findPoolApy).toHaveBeenCalledWith('aave-v3', 'Ethereum', 'USDC');
    expect(findPoolApy).toHaveBeenCalledWith('morpho-blue', 'Base', 'USDC');

    // And the APYs flow through as non-zero rather than collapsing to 0.
    expect(result.currentApyDecimal).toBe(0.05);
    expect(result.targetApyDecimal).toBe(0.05);
  });
});
