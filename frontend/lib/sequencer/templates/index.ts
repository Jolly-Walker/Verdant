export type TemplateId = 'bridgeAndDeposit' | 'repayAndWithdraw' | 'crossChainRebalance' | 'deleverageAave' | 'exitPendle';

export const TEMPLATE_REGISTRY: Record<TemplateId, {
  id: TemplateId;
  displayName: string;
  description: string;
  requiredParams: string[];
}> = {
  bridgeAndDeposit: {
    id: 'bridgeAndDeposit',
    displayName: 'Bridge & Deposit',
    description: 'Bridge an asset to another chain and deposit it into a protocol.',
    requiredParams: ['asset', 'amount', 'amountUsd', 'fromChain', 'toChain', 'fromProtocol', 'toProtocol', 'walletAddress']
  },
  repayAndWithdraw: {
    id: 'repayAndWithdraw',
    displayName: 'Repay & Withdraw',
    description: 'Repay a borrow and withdraw the collateral on the same chain.',
    requiredParams: ['borrowAsset', 'borrowAmount', 'collateralAsset', 'collateralAmount', 'protocol', 'chain', 'walletAddress']
  },
  crossChainRebalance: {
    id: 'crossChainRebalance',
    displayName: 'Cross-Chain Rebalance',
    description: 'Withdraw an asset, bridge it, and deposit it into a protocol on another chain.',
    requiredParams: ['asset', 'amount', 'amountUsd', 'fromProtocol', 'fromChain', 'toProtocol', 'toChain', 'walletAddress']
  },
  deleverageAave: {
    id: 'deleverageAave',
    displayName: 'De-leverage Aave Loop',
    description: 'Compute optimal repay/withdraw cycles to unwind a leveraged position.',
    requiredParams: ['borrowAsset', 'collateralAsset', 'totalDebt', 'totalCollateral', 'cycles', 'protocol', 'chain', 'walletAddress']
  },
  exitPendle: {
    id: 'exitPendle',
    displayName: 'Exit Pendle',
    description: 'Redeem PT/YT and move proceeds to another protocol or chain.',
    requiredParams: ['ptAsset', 'amount', 'amountUsd', 'underlyingAsset', 'fromChain', 'toChain', 'toProtocol', 'walletAddress']
  }
};

export * from './bridgeAndDeposit';
export * from './repayAndWithdraw';
export * from './crossChainRebalance';
export * from './deleverageAave';
export * from './exitPendle';
