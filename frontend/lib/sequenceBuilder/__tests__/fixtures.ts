import type { Position } from '@/types/position';

/** An Arbitrum USDC supply and borrow pair shared by the builder's logic and canvas tests. */
export const mockPositions: Position[] = [
  {
    id: 'aave-supply-usdc-arb',
    protocol: 'aave',
    chain: 'arbitrum',
    asset: 'USDC',
    assetAddress: '0x123',
    amount: 1000,
    amountUsd: 1000,
    currentApy: 0.04,
    positionType: 'supply',
    claimableRewards: [],
    priceUsd: 1,
    metadata: {},
  },
  {
    id: 'aave-borrow-usdc-arb',
    protocol: 'aave',
    chain: 'arbitrum',
    asset: 'USDC',
    assetAddress: '0x123',
    amount: 500,
    amountUsd: 500,
    currentApy: 0.05,
    positionType: 'borrow',
    claimableRewards: [],
    priceUsd: 1,
    healthFactor: 2.0,
    metadata: {},
  },
];
