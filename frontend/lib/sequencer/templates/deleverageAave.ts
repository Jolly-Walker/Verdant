import { SequencePlan } from '../../plugins/types/sequencer';
import { ChainId, ProtocolId } from '../../plugins/types/shared';

export interface DeleverageAaveParams {
  borrowAsset: string;
  collateralAsset: string;
  totalDebt: string;
  totalCollateral: string;
  initialHealthFactor: number;
  amountUsd: number;
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

  // Calculate effective Liquidation Threshold from initial HF
  // HF = (Collateral * LT) / Debt  => LT = (HF * Debt) / Collateral
  const totalDebt = Number(params.totalDebt);
  const totalCollateral = Number(params.totalCollateral);
  
  if (totalDebt === 0) throw new Error('Total debt must be greater than zero for de-leveraging');
  if (totalCollateral === 0) throw new Error('Total collateral must be greater than zero for de-leveraging');

  const lt = (params.initialHealthFactor * totalDebt) / totalCollateral;

  let currentDebt = totalDebt;
  let currentCollateral = totalCollateral;
  let previousStepId: string | null = null;

  for (let i = 0; i < params.cycles; i++) {
    const repayId = `repay-${i}`;
    const withdrawId = `withdraw-${i}`;
    
    const repayAmount = (totalDebt / params.cycles).toString();
    const withdrawAmount = (totalCollateral / params.cycles).toString();

    // 1. Repay step (increases HF)
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

    currentDebt -= Number(repayAmount);

    // 2. Health Factor Projection before Withdrawal
    const projectedCollateral = currentCollateral - Number(withdrawAmount);
    const projectedHF = currentDebt > 0 ? (projectedCollateral * lt) / currentDebt : Infinity;

    if (projectedHF < 1.05 && currentDebt > 0) {
      throw new Error(`Cycle ${i+1} withdrawal would drop Health Factor to ${projectedHF.toFixed(2)}, which is below the safe limit of 1.05. Aborting plan creation.`);
    }

    // 3. Withdraw step (decreases HF)
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

    currentCollateral -= Number(withdrawAmount);
    previousStepId = withdrawId;
  }

  return plan;
}
