import { SequencePlan, DeleverageAaveParams } from '@/types/sequencer';

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
  // HF = (CollateralUsd * LT) / DebtUsd  => LT = (HF * DebtUsd) / CollateralUsd
  // We MUST use USD-normalized values here because assets may have different units.
  const totalDebtUsd = params.totalDebtUsd;
  const totalCollateralUsd = params.totalCollateralUsd;
  
  if (totalDebtUsd === 0) throw new Error('Total debt must be greater than zero for de-leveraging');
  if (totalCollateralUsd === 0) throw new Error('Total collateral must be greater than zero for de-leveraging');

  const lt = (params.initialHealthFactor * totalDebtUsd) / totalCollateralUsd;

  let currentDebtUsd = totalDebtUsd;
  let currentCollateralUsd = totalCollateralUsd;
  let previousStepId: string | null = null;

  for (let i = 0; i < params.cycles; i++) {
    const repayId = `repay-${i}`;
    const withdrawId = `withdraw-${i}`;
    
    // TODO: Even split is conservative. A proper implementation should compute the maximum
    // safe withdraw amount per cycle using:
    // maxWithdraw = collateral - (debt_after_repay * 1.05) / LT
    // This ensures HF stays above 1.05 while withdrawing the maximum possible each cycle.
    
    // Amounts in token units for buildParams
    const repayAmount = (Number(params.totalDebt) / params.cycles).toString();
    const withdrawAmount = (Number(params.totalCollateral) / params.cycles).toString();

    // Amounts in USD for HF projections
    const repayAmountUsd = totalDebtUsd / params.cycles;
    const withdrawAmountUsd = totalCollateralUsd / params.cycles;

    // 1. Repay step (increases HF)
    const repayProjectedHF = currentDebtUsd - repayAmountUsd > 0 
      ? (currentCollateralUsd * lt) / (currentDebtUsd - repayAmountUsd) 
      : Infinity;

    plan.steps.push({
      id: repayId,
      label: `Cycle ${i+1}: Repay ${repayAmount} ${params.borrowAsset}`,
      chain: params.chain,
      pluginId: params.protocol,
      dependsOn: previousStepId ? [previousStepId] : [],
      status: 'pending',
      projectedHealthFactor: repayProjectedHF,
      buildParams: {
        action: 'repay',
        protocol: params.protocol,
        chain: params.chain,
        asset: params.borrowAsset,
        amount: repayAmount,
        userAddress: params.walletAddress,
      }
    });

    currentDebtUsd -= repayAmountUsd;

    // 2. Health Factor Projection before Withdrawal
    const projectedCollateralUsd = currentCollateralUsd - withdrawAmountUsd;
    const projectedHF = currentDebtUsd > 0 ? (projectedCollateralUsd * lt) / currentDebtUsd : Infinity;

    if (projectedHF < 1.05 && currentDebtUsd > 0) {
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
      projectedHealthFactor: projectedHF,
      buildParams: {
        action: 'withdraw',
        protocol: params.protocol,
        chain: params.chain,
        asset: params.collateralAsset,
        amount: withdrawAmount,
        userAddress: params.walletAddress,
      }
    });

    currentCollateralUsd -= withdrawAmountUsd;
    previousStepId = withdrawId;
  }

  return plan;
}
