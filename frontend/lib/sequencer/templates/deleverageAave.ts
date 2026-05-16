import { SequencePlan } from '../../plugins/types/sequencer';
import { ChainId, ProtocolId } from '../../plugins/types/shared';

export interface DeleverageAaveParams {
  borrowAsset: string;
  collateralAsset: string;
  totalDebt: string;
  totalCollateral: string;
  cycles: number;
  protocol: ProtocolId; // usually 'aave'
  chain: ChainId;
  walletAddress: string;
}

export function buildDeleverageAavePlan(params: DeleverageAaveParams): SequencePlan {
  const plan: SequencePlan = {
    id: crypto.randomUUID(),
    walletAddress: params.walletAddress,
    createdAt: new Date(),
    status: 'draft',
    totalCostUsd: 0,
    description: `De-leverage ${params.collateralAsset}/${params.borrowAsset} loop on ${params.protocol}`,
    steps: []
  };

  // Simplistic approximation of computing N cycles
  // For the sake of this template, we'll create the number of requested repay/withdraw cycles
  let previousStepId: string | null = null;

  for (let i = 0; i < params.cycles; i++) {
    const repayId = `repay-${i}`;
    const withdrawId = `withdraw-${i}`;
    
    // Fraction of total debt/collateral (for simplistic mock logic)
    const repayAmount = (Number(params.totalDebt) / params.cycles).toString();
    const withdrawAmount = (Number(params.totalCollateral) / params.cycles).toString();

    plan.steps.push({
      id: repayId,
      label: `Cycle ${i+1}: Repay ${repayAmount} ${params.borrowAsset}`,
      chain: params.chain,
      pluginId: params.protocol,
      dependsOn: previousStepId ? [previousStepId] : [],
      status: 'pending',
      buildParams: {
        action: 'repay',
        protocol: params.protocol,
        chain: params.chain,
        asset: params.borrowAsset,
        amount: repayAmount,
        userAddress: params.walletAddress,
      }
    });

    plan.steps.push({
      id: withdrawId,
      label: `Cycle ${i+1}: Withdraw ${withdrawAmount} ${params.collateralAsset}`,
      chain: params.chain,
      pluginId: params.protocol,
      dependsOn: [repayId],
      status: 'pending',
      buildParams: {
        action: 'withdraw',
        protocol: params.protocol,
        chain: params.chain,
        asset: params.collateralAsset,
        amount: withdrawAmount,
        userAddress: params.walletAddress,
      }
    });

    previousStepId = withdrawId;
  }

  return plan;
}
