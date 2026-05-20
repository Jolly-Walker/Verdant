import { SequencePlan, DeleverageAaveParams } from '@/types/sequencer';

export function computeOptimalCycles(
  totalDebtUsd: number,
  totalCollateralUsd: number,
  lt: number,
  targetHF: number = 1.05,
  maxCycles: number = 20
): number {
  for (let i = 1; i <= maxCycles; i++) {
    const repayPerCycle = totalDebtUsd / i;
    let debt = totalDebtUsd;
    let collateral = totalCollateralUsd;
    let feasible = true;

    for (let c = 0; c < i; c++) {
      debt = Math.max(0, debt - repayPerCycle);
      const maxWithdraw = debt === 0 ? collateral : Math.max(0, collateral - (debt * targetHF) / lt);
      collateral = Math.max(0, collateral - maxWithdraw);
      if (debt > 0 && (collateral * lt) / debt < targetHF - 0.0001) {
        feasible = false;
        break;
      }
    }

    if (feasible) return i;
  }
  return maxCycles;
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

  const totalDebtUsd = params.totalDebtUsd;
  const totalCollateralUsd = params.totalCollateralUsd;
  
  if (totalDebtUsd === 0) throw new Error('Total debt must be greater than zero for de-leveraging');
  if (totalCollateralUsd === 0) throw new Error('Total collateral must be greater than zero for de-leveraging');

  const lt = (params.initialHealthFactor * totalDebtUsd) / totalCollateralUsd;

  // Integrate computeOptimalCycles as a floor
  const optimalCycles = computeOptimalCycles(totalDebtUsd, totalCollateralUsd, lt);
  const cycles = Math.max(params.cycles || optimalCycles, optimalCycles);

  let currentDebtUsd = totalDebtUsd;
  let currentCollateralUsd = totalCollateralUsd;
  let previousStepId: string | null = null;

  const totalDebtBI = BigInt(params.totalDebt);
  const totalCollateralBI = BigInt(params.totalCollateral);

  for (let i = 0; i < cycles; i++) {
    const repayId = `repay-${i}`;
    const withdrawId = `withdraw-${i}`;
    
    // Amounts in USD for HF projections
    const repayAmountUsd = totalDebtUsd / cycles;
    const debtAfterRepayUsd = Math.max(0, currentDebtUsd - repayAmountUsd);

    // Compute maximum safe withdraw USD:
    let maxWithdrawUsd = 0;
    if (debtAfterRepayUsd === 0) {
      maxWithdrawUsd = currentCollateralUsd;
    } else {
      maxWithdrawUsd = Math.max(0, currentCollateralUsd - (debtAfterRepayUsd * 1.05) / lt);
    }

    // Convert to token units using BigInt for precision
    const withdrawFraction = totalCollateralUsd > 0 ? maxWithdrawUsd / totalCollateralUsd : 0;
    
    // Use scaled integer arithmetic for withdrawAmount
    const PRECISION = 1_000_000n;
    const withdrawFractionBI = BigInt(Math.round(withdrawFraction * Number(PRECISION)));
    const withdrawAmount = ((totalCollateralBI * withdrawFractionBI) / PRECISION).toString();
    
    // Repay amount is even split
    const repayAmount = (totalDebtBI / BigInt(cycles)).toString();

    // 1. Repay step (increases HF)
    const repayProjectedHF = debtAfterRepayUsd > 0 
      ? (currentCollateralUsd * lt) / debtAfterRepayUsd 
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

    currentDebtUsd = debtAfterRepayUsd;

    // 2. Health Factor Projection before Withdrawal
    const projectedCollateralUsd = currentCollateralUsd - maxWithdrawUsd;
    const projectedHF = currentDebtUsd > 0 ? (projectedCollateralUsd * lt) / currentDebtUsd : Infinity;

    if (projectedHF < 1.049 && currentDebtUsd > 0) { // Using 1.049 to avoid float precision issues in check
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

    currentCollateralUsd = projectedCollateralUsd;
    previousStepId = withdrawId;
  }

  return plan;
}
