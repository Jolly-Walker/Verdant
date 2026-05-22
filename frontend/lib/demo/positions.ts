import { Position } from '@/types/position'

// Realistic whale portfolio (~$475K) designed for the demo flow.
// Position 1 (Aave USDC on Arbitrum) is the source of the cross-chain rebalance sequence.
// Position 4 (Morpho USDC on Base) is the destination.

// Real USDC contract addresses per chain
const USDC_ARBITRUM = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
const USDC_ETHEREUM = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const WETH_ETHEREUM = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const PT_STETH = '0x7d372819240d14fb477f17b964f95f33beb4c704'
const EULER_TOKEN = '0xd9fcd98c322942075a5c3860693e9f4f03aae07b'

// 60 days from now for Pendle maturity (avoids the <30d warning)
const PENDLE_MATURITY = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()

export const DEMO_POSITIONS: Position[] = [
  {
    // 1. Aave V3 USDC supply on Arbitrum — demo sequence source
    id: 'demo-aave-usdc-arb',
    protocol: 'aave',
    chain: 'arbitrum',
    asset: 'USDC',
    assetAddress: USDC_ARBITRUM,
    amount: 180000,
    amountUsd: 180000,
    currentApy: 4.2,
    positionType: 'supply',
    priceUsd: 1.00,
    claimableRewards: [],
    metadata: { supplyApy: 4.2 },
  },
  {
    // 2. Aave V3 WETH supply on Ethereum
    id: 'demo-aave-weth-eth',
    protocol: 'aave',
    chain: 'ethereum',
    asset: 'WETH',
    assetAddress: WETH_ETHEREUM,
    amount: 28.13,
    amountUsd: 95000,
    currentApy: 1.8,
    positionType: 'supply',
    priceUsd: 3376.15,
    claimableRewards: [],
    metadata: { supplyApy: 1.8 },
  },
  {
    // 3. Aave V3 USDC borrow on Ethereum — triggers BorrowCard with De-leverage button
    id: 'demo-aave-usdc-borrow-eth',
    protocol: 'aave',
    chain: 'ethereum',
    asset: 'USDC',
    assetAddress: USDC_ETHEREUM,
    amount: 42000,
    amountUsd: 42000,
    currentApy: 5.1,
    positionType: 'borrow',
    priceUsd: 1.00,
    healthFactor: 1.82,
    liquidationPrice: 1420,
    borrowApy: 5.1,
    claimableRewards: [],
    metadata: { borrowApy: 5.1, healthFactor: 1.82 },
  },
  {
    // 4. Morpho USDC supply on Base — demo sequence destination
    id: 'demo-morpho-usdc-base',
    protocol: 'morpho',
    chain: 'base',
    asset: 'USDC',
    assetAddress: USDC_BASE,
    amount: 67000,
    amountUsd: 67000,
    currentApy: 6.8,
    positionType: 'supply',
    priceUsd: 1.00,
    claimableRewards: [],
    metadata: { supplyApy: 6.8 },
  },
  {
    // 5. Pendle PT-stETH on Ethereum — ~60d maturity, no warning shown
    id: 'demo-pendle-pt-steth-eth',
    protocol: 'pendle',
    chain: 'ethereum',
    asset: 'PT-stETH',
    assetAddress: PT_STETH,
    amount: 11.79,
    amountUsd: 38000,
    currentApy: 8.3,
    positionType: 'pendle-pt',
    priceUsd: 3223.07,
    fixedApy: 8.3,
    maturityDate: PENDLE_MATURITY,
    underlyingAsset: 'stETH',
    claimableRewards: [],
    metadata: { fixedApy: 8.3, maturityDate: PENDLE_MATURITY },
  },
  {
    // 6. Wallet ETH on Ethereum — plain balance, no protocol
    id: 'demo-wallet-eth',
    protocol: 'wallet',
    chain: 'ethereum',
    asset: 'ETH',
    assetAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    amount: 6.51,
    amountUsd: 22000,
    currentApy: 0,
    positionType: 'wallet',
    priceUsd: 3379.42,
    claimableRewards: [],
    metadata: {},
  },
  {
    // 7. Euler USDC supply on Base — small claimable EULER reward
    id: 'demo-euler-usdc-base',
    protocol: 'euler',
    chain: 'base',
    asset: 'USDC',
    assetAddress: USDC_BASE,
    amount: 31000,
    amountUsd: 31000,
    currentApy: 5.9,
    positionType: 'supply',
    priceUsd: 1.00,
    claimableRewards: [
      {
        token: 'EULER',
        amount: '12400000000000000000', // 12.4 EULER (18 decimals)
        amountUsd: 87,
      },
    ],
    metadata: { supplyApy: 5.9, rewardToken: EULER_TOKEN },
  },
]

export const DEMO_TOTAL_VALUE_USD = 475000
export const DEMO_TOTAL_REWARDS_USD = 87
