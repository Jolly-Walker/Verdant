import type { BridgeId } from '@/types/shared';

export const DEMO_BRIDGE_QUOTES: Record<
  string,
  { bridgeId: BridgeId; label: string; feeUsd: number; timeSeconds: number }[]
> = {
  arbitrum: [
    { bridgeId: 'across', label: 'Across V3', feeUsd: 1.2, timeSeconds: 45 },
    { bridgeId: 'layerzero', label: 'LayerZero CCTP', feeUsd: 0.8, timeSeconds: 120 },
  ],
  base: [
    { bridgeId: 'across', label: 'Across V3', feeUsd: 0.9, timeSeconds: 30 },
    { bridgeId: 'chainlink', label: 'Chainlink CCIP', feeUsd: 1.5, timeSeconds: 900 },
  ],
  ethereum: [
    { bridgeId: 'across', label: 'Across V3', feeUsd: 3.4, timeSeconds: 120 },
    { bridgeId: 'layerzero', label: 'LayerZero CCTP', feeUsd: 2.9, timeSeconds: 180 },
  ],
};

export function estimateDemoSwapFee(amountUsd: number): number {
  return Math.min(amountUsd * 0.0004, 20);
}
