import { SequencePlan } from '../../plugins/types/sequencer';
import { ChainId, ProtocolId } from '../../plugins/types/shared';

export interface RepayAndWithdrawParams {
  borrowAsset: string;    // asset to repay
  borrowAmount: string;   // amount of debt to repay
  amountUsd: number;
  collateralAsset: string;
  collateralAmount: string;
  protocol: ProtocolId;   // must be 'aave' or 'euler'
  chain: ChainId;
  walletAddress: string;
}

export function buildRepayAndWithdrawPlan(params: RepayAndWithdrawParams): SequencePlan {
  return {
    id: crypto.randomUUID(),
    walletAddress: params.walletAddress,
    createdAt: new Date(),
    status: 'draft',
    totalCostUsd: 0,
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
