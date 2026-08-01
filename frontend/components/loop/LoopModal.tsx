'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { parseUnits } from 'viem';
import { SUPPORTED_TOKENS } from '@/constants/tokens';
import { useSequencer } from '@/hooks/useSequencer';
import { PROTOCOL_DISPLAY_MAP } from '@/lib/plugins/protocols/metadata';
import { computeOptimalCycles, SAFE_TARGET_HF } from '@/lib/sequencer/templates/deleverageAave';
import { formatPercent, formatToken, formatUsd } from '@/lib/utils/formatting';
import type { Position } from '@/types/position';
import type { TemplateParams } from '@/types/sequencer';
import { HealthFactor } from '../ui/HealthFactor';
import { Modal } from '../ui/Modal';
import { WarningBanner } from '../ui/WarningBanner';

interface LoopModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: Position;
  collateralPosition?: Position;
}

/**
 * De-leverage (loop unwind) modal — the single action this component offers.
 *
 * A "Leverage" tab used to live here. It was wired to the `crossChainRebalance`
 * template with identical from/to chain *and* protocol, which emits exactly two
 * steps — withdraw the collateral, deposit the same asset straight back — so the
 * user signed twice, paid gas twice, and ended with an unchanged position while
 * the summary quoted a new debt and health factor that could never materialise.
 * Real leverage needs its own template in `lib/sequencer/templates/` (supply →
 * borrow → swap → re-supply, with a per-cycle health-factor projection and the
 * protocol's real liquidation threshold). Until that template exists, the action
 * is not offered rather than faked.
 *
 * Every number rendered below is read from the `position` / `collateralPosition`
 * props or derived from them; cost estimates deliberately live downstream, where
 * `lib/costPreview/calculator.ts` itemizes them from the actual plan steps.
 */
export function LoopModal({ isOpen, onClose, position, collateralPosition }: LoopModalProps) {
  const router = useRouter();
  const { createPlan } = useSequencer();
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cycles, setCycles] = useState<number>(1);

  const debtUsd = position.amountUsd;
  const collateralUsd = collateralPosition?.amountUsd ?? 0;
  const healthFactor = position.healthFactor;

  // Invert Aave's aggregate health-factor formula to recover the position's real
  // blended liquidation threshold: HF = (collateralUsd × LT) / debtUsd, so
  // LT = HF × debtUsd / collateralUsd. `healthFactor` is the one risk field the
  // Aave fetcher reliably populates on borrow positions; without it there is no
  // honest way to size the cycles, so we block instead of assuming a threshold.
  const hasRiskInputs =
    typeof healthFactor === 'number' &&
    Number.isFinite(healthFactor) &&
    healthFactor > 0 &&
    debtUsd > 0 &&
    collateralUsd > 0;
  const liquidationThreshold = hasRiskInputs ? (healthFactor * debtUsd) / collateralUsd : null;

  // Smallest cycle count that keeps the health factor above SAFE_TARGET_HF at
  // every intermediate step — the same function the server-side builder uses as
  // its floor, so anything lower would be silently raised there anyway.
  const minCycles =
    liquidationThreshold !== null
      ? computeOptimalCycles(debtUsd, collateralUsd, liquidationThreshold, SAFE_TARGET_HF)
      : 1;
  const effectiveCycles = Math.max(cycles, minCycles);
  const cycleOptions = Array.from({ length: Math.max(1, 11 - minCycles) }, (_, i) => minCycles + i);

  // Plan amounts must be atomic units: the API divides them by 10**decimals to
  // re-price the position, and the template forwards them with `isWei: true`.
  const debtDecimals = SUPPORTED_TOKENS[position.asset]?.decimals;
  const collateralDecimals = collateralPosition
    ? SUPPORTED_TOKENS[collateralPosition.asset]?.decimals
    : undefined;

  const protocolLabel = PROTOCOL_DISPLAY_MAP[position.protocol]?.displayName ?? position.protocol;

  let blockedReason: string | null = null;
  if (!collateralPosition) {
    blockedReason = `No supply position was found on ${protocolLabel} · ${position.chain} to unwind this debt against.`;
  } else if (!hasRiskInputs) {
    blockedReason =
      'This position is missing the health-factor data needed to size safe repay/withdraw cycles.';
  } else if (debtDecimals === undefined || collateralDecimals === undefined) {
    blockedReason = `Verdant has no token metadata for ${debtDecimals === undefined ? position.asset : collateralPosition.asset} yet, so it cannot size the on-chain amounts.`;
  }

  // Reset the cycle count and any stale error each time the modal is opened.
  useEffect(() => {
    if (!isOpen) return;
    setCycles(minCycles);
    setError(null);
  }, [isOpen, minCycles]);

  // Unwinding repays the whole debt and withdraws the whole collateral, so what
  // the user keeps is the position's equity: collateral minus the debt it backs.
  // Priced at the collateral's current price from the same position payload.
  const collateralPrice =
    collateralPosition && collateralPosition.amount > 0
      ? collateralPosition.amountUsd / collateralPosition.amount
      : 0;
  const debtAmountInCollateral = collateralPrice > 0 ? debtUsd / collateralPrice : 0;
  const freedCollateralAmount = collateralPosition
    ? Math.max(collateralPosition.amount - debtAmountInCollateral, 0)
    : 0;
  const freedCollateralUsd = collateralPosition
    ? Math.max(collateralPosition.amountUsd - debtUsd, 0)
    : 0;

  const handleExecuteDeleverage = async () => {
    if (!collateralPosition || !hasRiskInputs) return;
    if (debtDecimals === undefined || collateralDecimals === undefined) return;

    setIsExecuting(true);
    setError(null);

    try {
      const params: TemplateParams = {
        borrowAsset: position.asset,
        collateralAsset: collateralPosition.asset,
        totalDebt: parseUnits(position.amount.toFixed(debtDecimals), debtDecimals).toString(),
        totalCollateral: parseUnits(
          collateralPosition.amount.toFixed(collateralDecimals),
          collateralDecimals,
        ).toString(),
        // The API re-prices both legs from live prices and overrides these.
        totalDebtUsd: debtUsd,
        totalCollateralUsd: collateralPosition.amountUsd,
        initialHealthFactor: healthFactor,
        cycles: effectiveCycles,
        protocol: position.protocol,
        chain: position.chain,
        walletAddress: '',
        amountUsd: debtUsd,
      };

      const plan = await createPlan('deleverageAave', params);
      if (plan) {
        onClose();
        router.push(`/sequence/${plan.id}`);
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Could not build the de-leverage plan.');
    } finally {
      setIsExecuting(false);
    }
  };

  const footer = (
    <div className="flex items-center justify-end gap-3">
      <button type="button" onClick={onClose} disabled={isExecuting} className="btn btn-ghost">
        Cancel
      </button>
      <button
        type="button"
        onClick={handleExecuteDeleverage}
        disabled={isExecuting || blockedReason !== null}
        className="btn btn-primary"
      >
        {isExecuting ? 'Building plan…' : 'Review unwind plan →'}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      eyebrow="De-leverage"
      title="Unwind borrow position"
      size="md"
      footer={footer}
    >
      <div className="space-y-5">
        {/* Position — straight from the position payload */}
        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-verdant-text-muted">
            Position
          </h3>
          <div className="space-y-2 rounded-xl border border-verdant-rule bg-verdant-paper p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-verdant-text-muted">Debt</span>
              <span className="font-mono font-semibold text-verdant-loss">
                {formatToken(position.amount)} {position.asset} (
                {formatPercent(position.borrowApy ?? position.currentApy)} APY)
              </span>
            </div>

            {collateralPosition && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-verdant-text-muted">Collateral</span>
                <span className="font-mono font-medium text-verdant-text-primary">
                  {formatToken(collateralPosition.amount)} {collateralPosition.asset} (
                  {formatUsd(collateralPosition.amountUsd)})
                </span>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <span className="text-verdant-text-muted">Market</span>
              <span className="font-medium text-verdant-text-primary capitalize">
                {protocolLabel} · {position.chain}
              </span>
            </div>

            {typeof healthFactor === 'number' && (
              <div className="flex items-center justify-between gap-3 border-t border-verdant-rule/60 pt-2">
                <span className="text-verdant-text-muted">Health Factor</span>
                <HealthFactor value={healthFactor} showLabel={false} />
              </div>
            )}
          </div>
        </section>

        {/* Unwind settings */}
        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-verdant-text-muted">
            Unwind settings
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="loop-cycles" className="text-sm text-verdant-text-primary">
                Repay / withdraw cycles
              </label>
              <select
                id="loop-cycles"
                value={effectiveCycles}
                onChange={(e) => setCycles(parseInt(e.target.value, 10))}
                disabled={blockedReason !== null}
                className="rounded-lg border border-verdant-rule bg-verdant-surface px-3 py-1.5 font-mono text-xs text-verdant-text-primary focus:border-verdant-moss focus:outline-none disabled:opacity-50"
              >
                {cycleOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {liquidationThreshold !== null && (
              <p className="text-xs text-verdant-text-muted">
                {minCycles === 1
                  ? `One cycle already clears this position without the health factor dropping below ${SAFE_TARGET_HF}.`
                  : `At least ${minCycles} cycles are needed to keep the health factor above ${SAFE_TARGET_HF} at every step, so lower counts are not offered.`}
              </p>
            )}
          </div>
        </section>

        {/* After unwind — equity released, derived from the two positions */}
        {collateralPosition && (
          <section className="space-y-2 rounded-xl border border-verdant-moss/20 bg-verdant-surface-accent p-4 text-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-verdant-moss">
              After unwind
            </h3>
            <div className="flex items-center justify-between gap-3">
              <span className="text-verdant-text-muted">Freed collateral</span>
              <span className="font-mono font-semibold text-verdant-profit">
                ~{formatToken(freedCollateralAmount)} {collateralPosition.asset} (~
                {formatUsd(freedCollateralUsd)})
              </span>
            </div>
            <p className="text-xs leading-relaxed text-verdant-text-muted">
              The sequence repays the full {formatToken(position.amount)} {position.asset} debt in
              equal shares across {effectiveCycles} {effectiveCycles === 1 ? 'cycle' : 'cycles'} and
              withdraws the collateral behind it, so what is left over is the position&apos;s equity
              at today&apos;s prices.
            </p>
          </section>
        )}

        <p className="text-xs leading-relaxed text-verdant-text-muted">
          Every step is simulated and itemized — gas, bridge, and yield impact — on the next screen,
          before you sign anything.
        </p>

        {blockedReason && <WarningBanner message={blockedReason} />}

        {error && <WarningBanner message={error} variant="error" />}
      </div>
    </Modal>
  );
}
