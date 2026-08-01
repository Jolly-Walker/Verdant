import type { DeleverageAaveParams, SequencePlan } from '@/types/sequencer';

// The health-factor floor every intermediate cycle must stay above; also the
// default target for computeOptimalCycles and the number quoted in the UI.
export const SAFE_TARGET_HF = 1.05;

export function computeOptimalCycles(
  totalDebtUsd: number,
  totalCollateralUsd: number,
  lt: number,
  targetHF: number = SAFE_TARGET_HF,
  maxCycles: number = 20,
): number {
  for (let i = 1; i <= maxCycles; i++) {
    const repayPerCycle = totalDebtUsd / i;
    let debt = totalDebtUsd;
    let collateral = totalCollateralUsd;
    let feasible = true;

    for (let c = 0; c < i; c++) {
      debt = Math.max(0, debt - repayPerCycle);
      const maxWithdraw =
        debt === 0 ? collateral : Math.max(0, collateral - (debt * targetHF) / lt);
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
    positionSizeUsd: params.totalDebtUsd,
    description: `De-leverage ${params.collateralAsset}/${params.borrowAsset} loop on ${params.protocol}`,
    steps: [],
  };

  const totalDebtUsd = params.totalDebtUsd;
  const totalCollateralUsd = params.totalCollateralUsd;

  if (totalDebtUsd === 0) throw new Error('Total debt must be greater than zero for de-leveraging');
  if (totalCollateralUsd === 0)
    throw new Error('Total collateral must be greater than zero for de-leveraging');

  const lt = (params.initialHealthFactor * totalDebtUsd) / totalCollateralUsd;

  // Integrate computeOptimalCycles as a floor
  const optimalCycles = computeOptimalCycles(totalDebtUsd, totalCollateralUsd, lt);
  let cycles = Math.max(params.cycles || optimalCycles, optimalCycles);

  const totalDebtBI = BigInt(params.totalDebt);
  const totalCollateralBI = BigInt(params.totalCollateral);

  // More cycles than atomic debt units would emit zero-amount repay steps.
  if (BigInt(cycles) > totalDebtBI) cycles = Math.max(1, Number(totalDebtBI));

  let currentCollateralUsd = totalCollateralUsd;
  let withdrawnBI = 0n;
  let previousStepId: string | null = null;

  const baseRepayBI = totalDebtBI / BigInt(cycles);

  for (let i = 0; i < cycles; i++) {
    const repayId = `repay-${i}`;
    const withdrawId = `withdraw-${i}`;
    const isLastCycle = i === cycles - 1;

    // Closed form (not cumulative subtraction) so the final cycle's debt is
    // exactly 0 — cumulative float drift left ~1e-14 residuals that turned
    // the HF projection into a dust/dust ratio and spuriously tripped the
    // safety guard on healthy positions.
    const debtAfterRepayUsd = (totalDebtUsd * (cycles - 1 - i)) / cycles;

    // Compute maximum safe withdraw USD:
    let maxWithdrawUsd = 0;
    if (debtAfterRepayUsd === 0) {
      maxWithdrawUsd = currentCollateralUsd;
    } else {
      maxWithdrawUsd = Math.max(
        0,
        currentCollateralUsd - (debtAfterRepayUsd * SAFE_TARGET_HF) / lt,
      );
    }

    // Convert to token units using BigInt for precision. The final cycle
    // withdraws exactly what's left so rounding drift can't strand dust.
    let withdrawAmountBI: bigint;
    if (isLastCycle) {
      withdrawAmountBI = totalCollateralBI - withdrawnBI;
    } else {
      const withdrawFraction = totalCollateralUsd > 0 ? maxWithdrawUsd / totalCollateralUsd : 0;
      const PRECISION = 1_000_000n;
      const withdrawFractionBI = BigInt(Math.round(withdrawFraction * Number(PRECISION)));
      withdrawAmountBI = (totalCollateralBI * withdrawFractionBI) / PRECISION;
    }
    withdrawnBI += withdrawAmountBI;
    const withdrawAmount = withdrawAmountBI.toString();

    // Even split, with the integer-division remainder folded into the final
    // repay so the scheduled repays sum to exactly the total debt.
    const repayAmount = (
      isLastCycle ? totalDebtBI - baseRepayBI * BigInt(cycles - 1) : baseRepayBI
    ).toString();

    // 1. Repay step (increases HF)
    const repayProjectedHF =
      debtAfterRepayUsd > 0 ? (currentCollateralUsd * lt) / debtAfterRepayUsd : Infinity;

    plan.steps.push({
      id: repayId,
      label: `Cycle ${i + 1}: Repay ${repayAmount} ${params.borrowAsset}`,
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
        extraParams: { isWei: true },
      },
    });

    // 2. Health Factor Projection before Withdrawal
    const projectedCollateralUsd = currentCollateralUsd - maxWithdrawUsd;
    const projectedHF =
      debtAfterRepayUsd > 0 ? (projectedCollateralUsd * lt) / debtAfterRepayUsd : Infinity;

    // 0.001 tolerance below the floor to avoid float precision issues in check
    if (projectedHF < SAFE_TARGET_HF - 0.001 && debtAfterRepayUsd > 0) {
      throw new Error(
        `Cycle ${i + 1} withdrawal would drop Health Factor to ${projectedHF.toFixed(2)}, which is below the safe limit of ${SAFE_TARGET_HF}. Aborting plan creation.`,
      );
    }

    // 3. Withdraw step (decreases HF)
    plan.steps.push({
      id: withdrawId,
      label: `Cycle ${i + 1}: Withdraw ${withdrawAmount} ${params.collateralAsset}`,
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
        extraParams: { isWei: true },
      },
    });

    currentCollateralUsd = projectedCollateralUsd;
    previousStepId = withdrawId;
  }

  return plan;
}
