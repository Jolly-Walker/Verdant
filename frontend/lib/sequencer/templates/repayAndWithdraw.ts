import { SequencePlan, RepayAndWithdrawParams } from '@/types/sequencer';

export function buildRepayAndWithdrawPlan(params: RepayAndWithdrawParams): SequencePlan {
  return {
    id: crypto.randomUUID(),
    walletAddress: params.walletAddress,
    createdAt: new Date(),
    status: 'draft',
    totalCostUsd: 0,
    positionSizeUsd: params.amountUsd,
    description: `Repay ${params.borrowAsset} and withdraw ${params.collateralAsset} on ${params.protocol}`,
    steps: [
      {
        id: 'repay',
        label: `Repay ${params.borrowAmount} ${params.borrowAsset} on ${params.protocol}`,
        chain: params.chain,
        pluginId: params.protocol,
        dependsOn: [],
        status: 'pending',
        buildParams: {
          action: 'repay',
          protocol: params.protocol,
          chain: params.chain,
          asset: params.borrowAsset,
          amount: params.borrowAmount,
          userAddress: params.walletAddress,
        }
      },
      {
        id: 'withdraw',
        label: `Withdraw ${params.collateralAmount} ${params.collateralAsset}`,
        chain: params.chain,
        pluginId: params.protocol,
        dependsOn: ['repay'],
        status: 'pending',
        buildParams: {
          action: 'withdraw',
          protocol: params.protocol,
          chain: params.chain,
          asset: params.collateralAsset,
          amount: params.collateralAmount,
          userAddress: params.walletAddress,
        }
      }
    ]
  };
}
