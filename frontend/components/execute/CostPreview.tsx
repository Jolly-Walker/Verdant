'use client';

import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useQuote } from '@/hooks/useQuote';
import { formatPercent, formatUsd } from '@/lib/utils/formatting';
import type { CostPreviewInput, CostPreviewResult } from '@/types/quote';

interface CostPreviewProps {
  input?: CostPreviewInput | null;
  /** Optional: pre-fetched result (e.g. from useSequenceCost for a multi-step plan) */
  result?: CostPreviewResult | null;
  isLoading?: boolean;
  error?: string | null;
  isStale?: boolean;
  quoteAge?: number;
  refetch?: () => void;
  /** Step IDs whose bridge quotes are stale (show orange indicator) */
  staleStepIds?: Set<string>;
  /** Step IDs whose bridge quotes have expired (show red indicator) */
  expiredStepIds?: Set<string>;
  /** Labels for each step in the same order as result.steps, for staleness lookup */
  stepIds?: string[];
}

export function CostPreview({
  input = null,
  result: providedResult,
  isLoading: externalLoading,
  error: externalError,
  isStale: externalIsStale,
  quoteAge: externalQuoteAge,
  refetch: externalRefetch,
  staleStepIds,
  expiredStepIds,
  stepIds,
}: CostPreviewProps) {
  const {
    quote: fetchedQuote,
    isLoading: internalLoading,
    error: internalError,
    isStale: internalIsStale,
    quoteAge: internalQuoteAge,
    refetch: internalRefetch,
  } = useQuote(providedResult ? null : input); // skip internal fetch if result provided

  const result = providedResult || fetchedQuote;
  const isLoading = externalLoading ?? internalLoading;
  const error = externalError ?? internalError;
  const isStale = externalIsStale ?? internalIsStale;
  const quoteAge = externalQuoteAge ?? internalQuoteAge;
  const refetch = externalRefetch ?? internalRefetch;

  if (isLoading && !result) {
    return (
      <Card className="p-6 bg-verdant-surface border border-verdant-rule flex flex-col items-center justify-center min-h-[400px] shadow-organic">
        <Spinner size="lg" />
        <p className="text-verdant-text-muted mt-4 animate-pulse">Calculating optimal route...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 bg-verdant-surface border border-verdant-loss/30 shadow-organic">
        <h2 className="text-xl font-semibold text-verdant-text-primary mb-4">Preview Failed</h2>
        <div className="bg-verdant-loss/10 border border-verdant-loss/20 rounded-lg p-4 mb-6">
          <p className="text-sm text-verdant-loss">{error}</p>
        </div>
        <button type="button" onClick={refetch} className="btn btn-primary w-full">
          Retry Calculation
        </button>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card className="p-6 bg-verdant-surface border border-verdant-rule flex items-center justify-center min-h-[400px] shadow-organic">
        <p className="text-verdant-text-muted text-center max-w-[200px]">
          Select an asset and template to see cost & yield impact
        </p>
      </Card>
    );
  }

  const hasMultipleSteps = result.steps.length > 2;
  const hasSubtotals = result.totalGasUsd !== undefined;

  return (
    <Card className="p-0 bg-verdant-surface border border-verdant-rule shadow-organic relative overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 bg-verdant-black/5 backdrop-blur-[1px] flex items-center justify-center z-10">
          <Spinner />
        </div>
      )}

      {/* ── Receipt header ──────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-5">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="fl-serif text-xl text-verdant-pine">Cost &amp; Yield Preview</h2>
            <p className="fl-eyebrow mt-1">Verdant · Transaction Receipt</p>
          </div>
          {isStale ? (
            <Badge variant="warning" className="cursor-pointer" onClick={refetch}>
              Stale ({quoteAge}s) • Refresh
            </Badge>
          ) : (
            <span className="text-[10px] text-verdant-text-muted uppercase tracking-widest font-bold">
              Updated {quoteAge}s ago
            </span>
          )}
        </div>
      </div>

      {/* perforated tear-line */}
      <div
        className="h-px mx-6 border-t border-dashed border-verdant-rule-strong"
        aria-hidden="true"
      />

      <div className="px-6 py-6 space-y-8">
        {/* ── Itemized Step Costs (receipt / timeline) ──────────────────── */}
        <section>
          <h3 className="text-xs font-bold text-verdant-text-muted uppercase tracking-wider mb-5">
            Itemized Switching Costs
          </h3>
          <div className="relative">
            {/* vertical timeline rail */}
            <div
              className="absolute left-[5px] top-2 bottom-2 w-px bg-verdant-rule"
              aria-hidden="true"
            />

            <div className="space-y-5">
              {result.steps.map((step, i) => {
                const stepId = stepIds?.[i];
                const isStepStale = stepId ? staleStepIds?.has(stepId) : false;
                const isStepExpired = stepId ? expiredStepIds?.has(stepId) : false;
                const hasBridgeFee = step.bridgeFeeUsd != null && step.bridgeFeeUsd > 0;

                return (
                  <motion.div
                    key={stepId ?? step.stepLabel}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.04, ease: 'easeOut' }}
                    className="relative pl-7 space-y-1"
                  >
                    {/* timeline marker */}
                    <span
                      className="absolute left-0 top-1 w-[11px] h-[11px] rounded-full bg-verdant-surface border-2 border-verdant-moss"
                      aria-hidden="true"
                    />
                    <div className="flex justify-between text-sm items-start gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-verdant-text-primary font-medium">
                          {step.stepLabel}
                        </span>
                        {hasBridgeFee && isStepExpired && (
                          <span className="text-[10px] bg-verdant-loss/10 text-verdant-loss border border-verdant-loss/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                            Quote Expired
                          </span>
                        )}
                        {hasBridgeFee && isStepStale && !isStepExpired && (
                          <span className="text-[10px] bg-verdant-caution/10 text-verdant-caution border border-verdant-caution/25 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                            Stale Quote
                          </span>
                        )}
                      </div>
                      <span className="text-verdant-text-primary font-mono tabular-nums tracking-tight shrink-0">
                        {formatUsd(
                          step.gasCostUsd + (step.bridgeFeeUsd || 0) + (step.slippageUsd || 0),
                        )}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-verdant-text-muted">
                      <span className="bg-verdant-paper-deep/60 border border-verdant-rule px-1.5 rounded uppercase tracking-wide">
                        {step.chain}
                      </span>
                      <span className="font-mono tabular-nums">
                        Gas: {formatUsd(step.gasCostUsd)}
                      </span>
                      {step.bridgeFeeUsd != null && step.bridgeFeeUsd > 0 && (
                        <span className="font-mono tabular-nums">
                          • Fee: {formatUsd(step.bridgeFeeUsd)}
                        </span>
                      )}
                      {step.slippageUsd != null && step.slippageUsd > 0 && (
                        <span className="font-mono tabular-nums">
                          • Slippage: {formatUsd(step.slippageUsd)}
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Subtotals — shown for multi-step plans */}
          {hasMultipleSteps && hasSubtotals && (
            <div className="mt-5 pt-4 border-t border-dashed border-verdant-rule-strong space-y-2">
              {result.totalGasUsd > 0 && (
                <div className="flex justify-between text-xs text-verdant-text-muted">
                  <span>Total Gas</span>
                  <span className="font-mono tabular-nums">{formatUsd(result.totalGasUsd)}</span>
                </div>
              )}
              {result.totalBridgeFeeUsd > 0 && (
                <div className="flex justify-between text-xs text-verdant-text-muted">
                  <span>Total Bridge Fees</span>
                  <span className="font-mono tabular-nums">
                    {formatUsd(result.totalBridgeFeeUsd)}
                  </span>
                </div>
              )}
              {result.totalSlippageUsd > 0 && (
                <div className="flex justify-between text-xs text-verdant-text-muted">
                  <span>Total Slippage</span>
                  <span className="font-mono tabular-nums">
                    {formatUsd(result.totalSlippageUsd)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Running total — prominent receipt footer */}
          <div className="mt-5 pt-4 border-t-2 border-verdant-rule-strong flex justify-between items-baseline">
            <span className="text-verdant-text-muted font-semibold uppercase text-xs tracking-wider">
              Total Cost
            </span>
            <span className="text-2xl font-bold text-verdant-text-primary font-mono tabular-nums tracking-tight">
              {formatUsd(result.totalCostUsd)}
            </span>
          </div>
        </section>

        {/* ── De-leverage Break-even ────────────────────────────────────── */}
        {result.deleverageBreakEven && (
          <section className="bg-verdant-paper border border-verdant-rule rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-verdant-text-muted uppercase tracking-wider">
              De-leverage Savings
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-verdant-text-muted">Annual Interest Saved</span>
                <span className="text-verdant-profit font-medium tabular-nums font-mono">
                  +{formatUsd(result.deleverageBreakEven.annualInterestSavingsUsd)}/yr
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-verdant-text-muted">Collateral Yield Foregone</span>
                <span className="text-verdant-caution font-medium tabular-nums font-mono">
                  -{formatUsd(result.deleverageBreakEven.annualCollateralCostUsd)}/yr
                </span>
              </div>
              <div className="pt-2 border-t border-verdant-rule flex justify-between items-center">
                <span className="text-verdant-text-primary font-semibold text-sm">
                  Net Annual Benefit
                </span>
                <span
                  className={`font-bold tabular-nums font-mono ${result.deleverageBreakEven.netAnnualUpliftUsd > 0 ? 'text-verdant-profit' : 'text-verdant-loss'}`}
                >
                  {result.deleverageBreakEven.netAnnualUpliftUsd > 0 ? '+' : ''}
                  {formatUsd(result.deleverageBreakEven.netAnnualUpliftUsd)}/yr
                </span>
              </div>
            </div>
            {result.deleverageBreakEven.breakEvenDays !== Infinity &&
              result.deleverageBreakEven.breakEvenDays > 0 && (
                <div className="flex justify-between items-center pt-1">
                  <span className="text-xs text-verdant-text-muted">Break-even</span>
                  <Badge
                    variant={result.deleverageBreakEven.breakEvenDays > 60 ? 'warning' : 'success'}
                    className="text-sm px-3 py-1"
                  >
                    {Math.ceil(result.deleverageBreakEven.breakEvenDays)} days
                  </Badge>
                </div>
              )}
          </section>
        )}

        {/* ── Yield Impact ─────────────────────────────────────────────── */}
        {(result.currentApyDecimal > 0 || result.targetApyDecimal > 0) && (
          <section>
            <h3 className="text-xs font-bold text-verdant-text-muted uppercase tracking-wider mb-4">
              Yield Impact
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-verdant-text-muted">Current APY</span>
                <span className="text-verdant-text-primary font-medium font-mono">
                  {formatPercent(result.currentApyDecimal)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-verdant-text-muted">Target APY</span>
                <span className="text-verdant-profit font-medium font-mono">
                  {formatPercent(result.targetApyDecimal)}
                </span>
              </div>
              <div className="pt-3 border-t border-verdant-rule flex justify-between items-center">
                <span className="text-verdant-text-primary font-semibold">Net Yield Uplift</span>
                <div className="text-right">
                  <div className="text-lg font-bold text-verdant-profit font-mono">
                    {result.netUpliftDecimal && result.netUpliftDecimal > 0 ? '+' : ''}
                    {formatPercent(result.netUpliftDecimal || 0)}
                  </div>
                  {result.dailyYieldGainUsd !== null && (
                    <div className="text-xs text-verdant-text-muted font-mono">
                      {result.dailyYieldGainUsd > 0 ? '+' : ''}
                      {formatUsd(result.dailyYieldGainUsd)} / day
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Standard Break-even ──────────────────────────────────────── */}
        {result.breakEvenDays !== null &&
          result.breakEvenDays > 0 &&
          result.breakEvenDays !== Infinity &&
          !result.deleverageBreakEven && (
            <section className="bg-verdant-paper border border-verdant-rule rounded-xl p-4">
              <div className="flex justify-between items-center">
                <div className="space-y-0.5">
                  <span className="text-xs text-verdant-text-muted uppercase font-bold tracking-tight">
                    Break-even Period
                  </span>
                  <p className="text-[11px] text-verdant-text-muted">
                    Recoup switching costs from yield
                  </p>
                </div>
                <Badge
                  variant={result.breakEvenDays > 30 ? 'warning' : 'success'}
                  className="text-sm px-3 py-1"
                >
                  {Math.ceil(result.breakEvenDays)} days
                </Badge>
              </div>
            </section>
          )}

        {/* ── Warnings ─────────────────────────────────────────────────── */}
        {result.warnings.length > 0 && (
          <section className="space-y-2">
            {result.warnings.map((warning) => (
              <div
                key={`${warning.type}-${warning.message}`}
                className="flex gap-3 bg-verdant-caution/10 border border-verdant-caution/25 rounded-lg p-3"
              >
                <span aria-hidden="true">⚠️</span>
                <p className="text-xs text-verdant-caution leading-relaxed">{warning.message}</p>
              </div>
            ))}
          </section>
        )}
      </div>
    </Card>
  );
}
