import { useRouter } from 'next/navigation';
import type React from 'react';
import { useState } from 'react';
import { HealthFactor } from '@/components/ui/HealthFactor';
import { DEFAULT_MIN_USD_THRESHOLD } from '@/constants/settings';
import { useHarvest } from '@/hooks/useHarvest';
import { usePositions } from '@/hooks/usePositions';
import { formatPercent, formatToken, formatUsd } from '@/lib/utils/formatting';
import type { Position } from '@/types/position';
import type { TemplateId } from '@/types/sequencer';
import { Tooltip } from '../ui/Tooltip';
import { TokenIcon } from './TokenIcon';

interface PositionCardProps {
  position: Position;
  onSequence?: (template: TemplateId, params: Record<string, string>) => void;
  onOpenBuilder?: (positionId: string) => void;
  onOpenLoopModal?: (position: Position, collateral?: Position) => void;
  /** 'row' renders a table row (desktop); 'card' a stacked card (mobile). */
  layout?: 'row' | 'card';
}

export function PositionCard({
  position,
  onSequence,
  onOpenBuilder,
  onOpenLoopModal,
  layout = 'row',
}: PositionCardProps) {
  const router = useRouter();
  const [isHarvesting, setIsHarvesting] = useState(false);

  // Sibling positions, to find collateral for borrow actions. Served from the
  // shared PositionsProvider context — this does not issue its own request.
  const { positions } = usePositions();
  const { harvest, isSimulating: isHarvestSimulating, isSigning } = useHarvest();

  const isWallet = position.positionType === 'wallet';
  const isBorrow = position.positionType === 'borrow';
  const isPendle = position.positionType === 'pendle-pt' || position.positionType === 'pendle-yt';
  const isPT = position.positionType === 'pendle-pt';

  // Format unit price
  const formattedPrice = position.priceUsd ? formatUsd(position.priceUsd) : '-';

  // Calculate rewards info for supply positions
  const hasRewards = position.claimableRewards && position.claimableRewards.length > 0;
  const rewardsUsd = hasRewards
    ? position.claimableRewards.reduce((sum, r) => sum + r.amountUsd, 0)
    : 0;
  const canHarvest = rewardsUsd >= DEFAULT_MIN_USD_THRESHOLD;

  // Maturity calculations for Pendle
  const maturityDate = position.maturityDate ? new Date(position.maturityDate) : null;
  const isValidDate = maturityDate && !Number.isNaN(maturityDate.getTime());
  const showExpiryWarning =
    isPendle && isValidDate && maturityDate!.getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;
  const formattedMaturity = isValidDate
    ? maturityDate!.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Unknown';

  // Liquidation risk for borrow positions.
  //
  // Aave's aggregate health factor is HF = (collateralUsd × liquidationThreshold) / debtUsd
  // and liquidation triggers at HF = 1.0. Holding debt and threshold constant, collateral
  // value scales linearly with the collateral asset's price, so HF reaches 1.0 once the
  // collateral's USD value falls to (1 / HF) of its current level. The fractional price
  // drop the portfolio can absorb before liquidation is therefore:
  //     priceDropToLiquidation = 1 − (1 / HF)
  // This is derived purely from `position.healthFactor`, the one risk field the real Aave
  // fetcher reliably populates on borrow positions. A per-position TRUE liquidation price
  // is NOT shown unless the upstream pipeline actually provides `position.liquidationPrice`
  // (it currently does not for live data), so we never fabricate one.
  const hasRealLiquidationPrice =
    isBorrow && typeof position.liquidationPrice === 'number' && position.liquidationPrice > 0;
  const priceDropToLiquidationPct =
    isBorrow && position.healthFactor !== undefined && position.healthFactor > 1
      ? (1 - 1 / position.healthFactor) * 100
      : undefined;

  // Identify Aave/Morpho/Euler collateral for borrow positions
  const potentialCollaterals = positions.filter(
    (p) =>
      p.chain === position.chain && p.protocol === position.protocol && p.positionType === 'supply',
  );
  const collateralPosition =
    potentialCollaterals.length > 0
      ? [...potentialCollaterals].sort((a, b) => b.amountUsd - a.amountUsd)[0]
      : undefined;

  // Handler for Harvest action
  const handleHarvest = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canHarvest) return;

    setIsHarvesting(true);
    try {
      await harvest(position.protocol as string, position.chain);
    } catch (e) {
      console.error(e);
      alert('An error occurred during harvest');
    } finally {
      setIsHarvesting(false);
    }
  };

  // Route a template either to the in-page sequence handler or the /sequence page.
  const dispatchTemplate = (template: TemplateId, params: Record<string, string>) => {
    if (onSequence) {
      onSequence(template, params);
    } else {
      router.push(`/sequence?${new URLSearchParams(params).toString()}`);
    }
  };

  // Handler for De-leverage action
  const handleDeleverage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenLoopModal) {
      onOpenLoopModal(position, collateralPosition);
      return;
    }
    const params: Record<string, string> = {
      template: 'deleverageAave',
      protocol: position.protocol,
      chain: position.chain,
      borrowAsset: position.asset,
      amount: position.amount.toString(),
      totalDebtUsd: position.amountUsd.toString(),
    };

    if (collateralPosition) {
      params.collateralAsset = collateralPosition.asset;
      params.collateralAmount = collateralPosition.amount.toString();
      params.totalCollateralUsd = collateralPosition.amountUsd.toString();
    }

    if (position.healthFactor !== undefined) {
      params.healthFactor = position.healthFactor.toString();
    }

    dispatchTemplate('deleverageAave', params);
  };

  // Handler for Repay action
  const handleRepay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenBuilder) {
      onOpenBuilder(position.id);
      return;
    }
    const params: Record<string, string> = {
      template: 'repayAndWithdraw',
      protocol: position.protocol,
      chain: position.chain,
      borrowAsset: position.asset,
      borrowAmount: position.amount.toString(),
    };

    if (collateralPosition) {
      params.collateralAsset = collateralPosition.asset;
      params.collateralAmount = collateralPosition.amount.toString();
    }

    dispatchTemplate('repayAndWithdraw', params);
  };

  // Handler for Exit Pendle action
  const handleExitPendle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenBuilder) {
      onOpenBuilder(position.id);
      return;
    }
    const params = {
      template: 'exitPendle' as TemplateId,
      asset: position.asset,
      amount: position.amount.toString(),
      ptAddress: position.assetAddress || '',
      chain: position.chain,
    };

    dispatchTemplate('exitPendle', params);
  };

  // Handler for Manage/Rebalance action (Supply positions)
  const handleManageSupply = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenBuilder) {
      onOpenBuilder(position.id);
      return;
    }
    const params = {
      template: 'crossChainRebalance' as TemplateId,
      asset: position.asset,
      amount: position.amount.toString(),
      amountUsd: position.amountUsd.toString(),
      fromProtocol: position.protocol,
      fromChain: position.chain,
    };

    dispatchTemplate('crossChainRebalance', params);
  };

  // Handler for Wallet Deposit action
  const handleDepositWallet = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenBuilder) {
      onOpenBuilder(position.id);
      return;
    }
    const params = {
      template: 'bridgeAndDeposit' as TemplateId,
      asset: position.asset,
      amount: position.amount.toString(),
      amountUsd: position.amountUsd.toString(),
      fromChain: position.chain,
    };

    dispatchTemplate('bridgeAndDeposit', params);
  };

  // ---------- shared render helpers (both layouts read the same locals) ----------

  const typeTag = (
    <>
      {isBorrow && (
        <span className="text-[9px] bg-verdant-loss/10 text-verdant-loss border border-verdant-loss/25 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
          Debt
        </span>
      )}
      {isWallet && (
        <span className="text-[9px] bg-verdant-paper-deep/60 text-verdant-text-muted border border-verdant-rule px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
          Wallet
        </span>
      )}
      {isPendle && (
        <span className="text-[9px] bg-verdant-caution/10 text-verdant-caution border border-verdant-caution/25 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
          {isPT ? 'PT' : 'YT'}
        </span>
      )}
    </>
  );

  const assetIdentity = (
    <div className="flex items-center gap-3">
      <TokenIcon
        symbol={isPendle ? position.underlyingAsset || 'ETH' : position.asset}
        className="w-8 h-8"
      />
      <div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-verdant-text-primary text-sm">{position.asset}</span>
          {typeTag}
        </div>
        <span className="text-xs text-verdant-text-muted capitalize block mt-0.5">
          {isWallet ? 'Available Balance' : `${position.protocol} • ${position.positionType}`}
        </span>
      </div>
    </div>
  );

  const renderValue = (align: 'start' | 'end') => (
    <div className={`flex flex-col ${align === 'end' ? 'items-end' : 'items-start'}`}>
      <span
        className={`font-mono text-sm font-bold ${isBorrow ? 'text-verdant-loss' : 'text-verdant-text-primary'}`}
      >
        {isBorrow ? '-' : ''}
        {formatUsd(position.amountUsd)}
      </span>
      <span className="font-mono text-xs text-verdant-text-muted mt-0.5">
        {formatToken(position.amount)} {position.asset}
      </span>
      {hasRewards && rewardsUsd > 0 && (
        <span className="font-mono text-[10px] text-verdant-profit font-semibold mt-1">
          +{formatUsd(rewardsUsd)} rewards
        </span>
      )}
    </div>
  );

  const renderApy = (align: 'start' | 'end') => (
    <div className={`flex flex-col ${align === 'end' ? 'items-end' : 'items-start'}`}>
      {!isWallet ? (
        <>
          <span
            className={`font-mono text-sm font-semibold ${isBorrow ? 'text-verdant-loss' : 'text-verdant-profit'}`}
          >
            {isBorrow ? '-' : '+'}
            {formatPercent(position.currentApy)}
          </span>

          {/* Contextual subtext under APY: visual health-factor gauge + liquidation risk */}
          {isBorrow && position.healthFactor !== undefined && (
            <div className="mt-1">
              <HealthFactor value={position.healthFactor} />
            </div>
          )}

          {/*
            Liquidation risk line. Prefer a TRUE liquidation price only when the
            upstream pipeline actually supplies one; otherwise fall back to the
            real, HF-derived buffer (price drop the collateral can absorb before
            HF hits 1.0). Never fabricate a number.
          */}
          {hasRealLiquidationPrice && (
            <span className="font-mono text-[10px] font-medium mt-0.5 text-verdant-text-muted">
              Liq. price: {formatUsd(position.liquidationPrice!)}
            </span>
          )}
          {!hasRealLiquidationPrice && priceDropToLiquidationPct !== undefined && (
            <span className="font-mono text-[10px] font-medium mt-0.5 text-verdant-text-muted">
              −{priceDropToLiquidationPct.toFixed(1)}% to liquidation
            </span>
          )}

          {isPendle && (
            <span
              className={`font-mono text-[10px] mt-0.5 ${showExpiryWarning ? 'text-verdant-caution font-semibold animate-pulse' : 'text-verdant-text-muted'}`}
            >
              Maturity: {formattedMaturity}
            </span>
          )}
        </>
      ) : (
        <span className="font-mono text-sm text-verdant-text-muted">-</span>
      )}
    </div>
  );

  // compact = table row; otherwise full-width ≥44px mobile buttons
  const renderActions = (compact: boolean) => {
    const primary = compact
      ? 'btn btn-primary text-xs px-3 py-1.5'
      : 'btn btn-primary flex-1 min-h-[44px]';
    const secondary = compact
      ? 'btn btn-secondary text-xs px-3 py-1.5'
      : 'btn btn-secondary flex-1 min-h-[44px]';
    const danger = compact
      ? 'btn btn-danger text-xs px-3.5 py-1.5'
      : 'btn btn-danger flex-1 min-h-[44px]';

    return (
      <>
        {isWallet && (
          <button type="button" onClick={handleDepositWallet} className={primary}>
            Deposit
          </button>
        )}

        {isBorrow && (
          <>
            {position.healthFactor !== undefined && (
              <button type="button" onClick={handleDeleverage} className={danger}>
                De-leverage
              </button>
            )}
            <button type="button" onClick={handleRepay} className={secondary}>
              Repay
            </button>
          </>
        )}

        {isPendle && (
          <button type="button" onClick={handleExitPendle} className={secondary}>
            Exit
          </button>
        )}

        {!isWallet && !isBorrow && !isPendle && (
          <>
            {hasRewards && (
              <Tooltip
                content={
                  !canHarvest
                    ? `Minimum harvest is $${DEFAULT_MIN_USD_THRESHOLD.toLocaleString()}`
                    : ''
                }
                className={compact ? '' : 'flex-1'}
              >
                <button
                  type="button"
                  onClick={handleHarvest}
                  disabled={!canHarvest || isHarvesting || isHarvestSimulating}
                  className={compact ? primary : `${primary} w-full`}
                >
                  {isHarvestSimulating ? 'Simulating...' : isSigning ? 'Signing...' : 'Harvest'}
                </button>
              </Tooltip>
            )}
            <button type="button" onClick={handleManageSupply} className={secondary}>
              {onOpenBuilder ? 'Sequence' : 'Manage'}
            </button>
          </>
        )}
      </>
    );
  };

  // ---------- card layout (mobile) ----------
  if (layout === 'card') {
    const statLabel = 'font-mono text-[11px] uppercase tracking-wider text-verdant-text-muted';
    return (
      <div className="rounded-xl border border-verdant-rule bg-verdant-surface p-4 shadow-organic">
        {assetIdentity}

        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-verdant-rule/60 pt-3">
          <div>
            <p className={statLabel}>Price</p>
            <p className="mt-0.5 font-mono text-sm text-verdant-text-primary">{formattedPrice}</p>
          </div>
          <div>
            <p className={statLabel}>Balance</p>
            <div className="mt-0.5">{renderValue('start')}</div>
          </div>
          <div className="col-span-2">
            <p className={statLabel}>APY</p>
            <div className="mt-0.5">{renderApy('start')}</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">{renderActions(false)}</div>
      </div>
    );
  }

  // ---------- row layout (desktop table) ----------
  return (
    <tr className="border-b border-verdant-rule/40 hover:bg-verdant-canvas/50 transition-colors last:border-b-0">
      <td className="px-5 py-4">{assetIdentity}</td>

      <td className="px-5 py-4 text-right">
        <span className="font-mono text-sm text-verdant-text-primary">{formattedPrice}</span>
      </td>

      <td className="px-5 py-4 text-right">{renderValue('end')}</td>

      <td className="px-5 py-4 text-right">{renderApy('end')}</td>

      <td className="px-5 py-4 text-right">
        <div className="flex justify-end gap-2 items-center">{renderActions(true)}</div>
      </td>
    </tr>
  );
}
