import { BRIDGE_QUOTE_TTL_MS } from '@/constants/bridges';
import { buildCrossChainRebalancePlan } from '@/lib/sequencer/templates';
import type { CostPreviewResult } from '@/types/quote';
import type { SequencePlan, SimulationResult } from '@/types/sequencer';
import { DEMO_WALLET_ADDRESS } from './wallet';

export { DEMO_WALLET_ADDRESS };

// Demo plans live only in client state, but navigating to /sequence/[planId]
// remounts a fresh hook (state lost) and that route otherwise fetches the real
// API. This module-level handoff lets the plan view rehydrate the just-created
// demo plan across that client-side navigation.
let lastDemoPlan: SequencePlan | null = null;
export function setLastDemoPlan(plan: SequencePlan): void {
  lastDemoPlan = plan;
}
export function getLastDemoPlan(): SequencePlan | null {
  return lastDemoPlan;
}

export function buildDemoPlan(walletAddress: string): SequencePlan {
  return buildCrossChainRebalancePlan({
    asset: 'USDC',
    amount: '180000000000', // 180,000 USDC in base units (6 decimals)
    fromProtocol: 'aave',
    fromChain: 'arbitrum',
    toProtocol: 'morpho',
    toChain: 'base',
    slippagePercent: 0.5,
    walletAddress,
    amountUsd: 180000,
  });
}

export const DEMO_SIMULATION_RESULT: SimulationResult = {
  success: true,
  gasEstimate: BigInt(185000),
  gasCostUsd: 3.4,
  simulatedAt: new Date(),
  stateChanges: [
    {
      type: 'balance',
      asset: 'USDC',
      assetAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      change: '-180000000000',
      decimals: 6,
      chainId: 'arbitrum',
    },
  ],
  warnings: [],
};

export const DEMO_COST_RESULT: CostPreviewResult = {
  steps: [
    {
      stepLabel: 'Withdraw USDC from Aave',
      chain: 'arbitrum',
      gasCostUsd: 3.4,
      bridgeFeeUsd: 0,
      slippageUsd: 0,
    },
    {
      stepLabel: 'Bridge USDC via Across',
      chain: 'arbitrum',
      gasCostUsd: 1.2,
      bridgeFeeUsd: 54.0, // 0.03% of $180k
      slippageUsd: 9.0, // 0.005%
      quoteExpiresAt: new Date(Date.now() + BRIDGE_QUOTE_TTL_MS).toISOString(),
    },
    {
      stepLabel: 'Deposit USDC into Morpho',
      chain: 'base',
      gasCostUsd: 2.8,
      bridgeFeeUsd: 0,
      slippageUsd: 0,
    },
  ],
  totalCostUsd: 70.4,
  totalGasUsd: 7.4,
  totalBridgeFeeUsd: 54.0,
  totalSlippageUsd: 9.0,
  currentApyDecimal: 0.042, // 4.2%
  targetApyDecimal: 0.068, // 6.8%
  netUpliftDecimal: 0.026, // 2.6%
  dailyYieldGainUsd: 12.82, // ($180k × 2.6%) / 365
  breakEvenDays: 5.5,
  targetUtilisationDecimal: null,
  quoteFetchedAt: new Date(),
  warnings: [],
};
