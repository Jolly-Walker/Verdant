import { BridgeId } from '@/types/shared'

export const DEMO_BRIDGE_QUOTES: Record<string, { bridgeId: BridgeId; label: string; feeUsd: number; timeSeconds: number }[]> = {
  'arbitrum': [
    { bridgeId: 'across',    label: 'Across V3',       feeUsd: 1.20, timeSeconds: 45 },
    { bridgeId: 'layerzero', label: 'LayerZero CCTP',  feeUsd: 0.80, timeSeconds: 120 },
  ],
  'base': [
    { bridgeId: 'across',    label: 'Across V3',       feeUsd: 0.90, timeSeconds: 30 },
    { bridgeId: 'chainlink', label: 'Chainlink CCIP',  feeUsd: 1.50, timeSeconds: 900 },
  ],
  'ethereum': [
    { bridgeId: 'across',    label: 'Across V3',       feeUsd: 3.40, timeSeconds: 120 },
    { bridgeId: 'layerzero', label: 'LayerZero CCTP',  feeUsd: 2.90, timeSeconds: 180 },
  ],
}

export function estimateDemoSwapFee(amountUsd: number): number {
  return Math.min(amountUsd * 0.0004, 20)
}
