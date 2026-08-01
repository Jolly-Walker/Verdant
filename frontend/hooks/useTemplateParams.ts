'use client';

import { useCallback, useState } from 'react';
import { SUPPORTED_TOKENS } from '@/constants/tokens';
import { computeOptimalCycles } from '@/lib/sequencer/templates/deleverageAave';
import type { TemplateId, TemplateParams } from '@/types/sequencer';
import type { ChainId, ProtocolId } from '@/types/shared';

/** Every field the shared template-parameter form can edit. */
export interface TemplateParamValues {
  asset: string;
  borrowAsset: string;
  collateralAsset: string;
  amount: string;
  collateralAmount: string;
  healthFactor: number;
  cycles: number;
  fromChain: ChainId;
  toChain: ChainId;
  fromProtocol: ProtocolId;
  toProtocol: ProtocolId;
  ptAddress: string;
}

/** Typed single-field setter handed to `TemplateParamsForm`. */
export type SetTemplateParam = <K extends keyof TemplateParamValues>(
  key: K,
  value: TemplateParamValues[K],
) => void;

const DEFAULT_HEALTH_FACTOR = 2.5;
const DEFAULT_CYCLES = 2;

const DEFAULTS: TemplateParamValues = {
  asset: 'USDC',
  borrowAsset: 'USDC',
  collateralAsset: 'ETH',
  amount: '100',
  collateralAmount: '1',
  healthFactor: DEFAULT_HEALTH_FACTOR,
  cycles: DEFAULT_CYCLES,
  fromChain: 'ethereum',
  toChain: 'arbitrum',
  fromProtocol: 'aave',
  toProtocol: 'aave',
  ptAddress: '',
};

/**
 * Owns the template-parameter form state shared by the sequence modal
 * (`components/sequence/SequenceModal.tsx`) and the standalone sequence page
 * (`app/sequence/page.tsx`). The two call sites differ only in where the
 * initial values come from — modal props vs. `useSearchParams()` — so both
 * hand `hydrate` a plain string record and render `TemplateParamsForm`.
 *
 * `buildParams` is the single source of truth for the state -> `TemplateParams`
 * mapping that `/api/sequencer/plan` turns into real transactions; keep any
 * change to it in step with the matching template builder in `lib/sequencer/templates/`.
 */
export function useTemplateParams() {
  const [values, setValues] = useState<TemplateParamValues>(DEFAULTS);

  const setValue = useCallback<SetTemplateParam>((key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  /**
   * Reset to defaults, then apply whatever the caller supplies. Unknown keys are
   * ignored, and a blank/absent value always falls back to the default.
   */
  const hydrate = useCallback(
    (raw: Partial<Record<string, string>>, template?: TemplateId | null) => {
      const next: TemplateParamValues = { ...DEFAULTS };

      if (raw.asset) next.asset = raw.asset;
      if (raw.amount) next.amount = raw.amount;
      if (raw.ptAddress) next.ptAddress = raw.ptAddress;
      if (raw.chain) {
        next.fromChain = raw.chain as ChainId;
        next.toChain = raw.chain as ChainId; // default to same chain unless overridden
      }
      if (raw.protocol) next.fromProtocol = raw.protocol as ProtocolId;
      if (raw.borrowAsset) next.borrowAsset = raw.borrowAsset;
      if (raw.collateralAsset) next.collateralAsset = raw.collateralAsset;
      if (raw.collateralAmount) next.collateralAmount = raw.collateralAmount;

      if (raw.healthFactor) {
        next.healthFactor = parseFloat(raw.healthFactor) || DEFAULT_HEALTH_FACTOR;
      }

      const resolvedTemplate = template ?? undefined;

      if (raw.cycles) {
        next.cycles = parseInt(raw.cycles, 10) || DEFAULT_CYCLES;
      } else if (resolvedTemplate === 'deleverageAave' || resolvedTemplate === undefined) {
        // Deliberately permissive (this is the old SequenceModal behaviour, kept
        // over the stricter `=== 'deleverageAave'` check the page used): when no
        // template is pre-selected the user may still pick deleverageAave in the
        // selector, and by then the position's debt/collateral figures are gone.
        // Deriving cycles up front costs nothing for the other templates, which
        // never read the field.
        if (raw.totalDebtUsd && raw.totalCollateralUsd) {
          const debtUsd = parseFloat(raw.totalDebtUsd);
          const collUsd = parseFloat(raw.totalCollateralUsd);
          if (debtUsd > 0 && collUsd > 0) {
            const lt = (next.healthFactor * debtUsd) / collUsd;
            next.cycles = computeOptimalCycles(debtUsd, collUsd, lt);
          }
        }
      }

      setValues(next);
    },
    [],
  );

  /** Map the current form state onto the `TemplateParams` shape for `templateId`. */
  const buildParams = useCallback(
    (templateId: TemplateId): TemplateParams => {
      const {
        asset,
        borrowAsset,
        collateralAsset,
        amount,
        collateralAmount,
        healthFactor,
        cycles,
        fromChain,
        toChain,
        fromProtocol,
        toProtocol,
        ptAddress,
      } = values;

      if (templateId === 'bridgeAndDeposit') {
        return {
          asset,
          amount,
          fromChain,
          toChain,
          fromProtocol: 'wallet',
          toProtocol,
        };
      }

      if (templateId === 'repayAndWithdraw') {
        return {
          borrowAsset,
          borrowAmount: amount,
          collateralAsset,
          collateralAmount,
          protocol: fromProtocol,
          chain: fromChain,
        };
      }

      if (templateId === 'crossChainRebalance') {
        return {
          asset,
          amount,
          fromProtocol,
          fromChain,
          toProtocol,
          toChain,
        };
      }

      if (templateId === 'deleverageAave') {
        return {
          borrowAsset,
          collateralAsset,
          totalDebt: amount,
          totalCollateral: collateralAmount,
          initialHealthFactor: healthFactor,
          cycles,
          protocol: fromProtocol,
          chain: fromChain,
        };
      }

      if (templateId === 'exitPendle') {
        const ptAsset = asset === 'ETH' ? 'PT-eETH' : 'PT-USDC';
        const dynamicPtAddress = SUPPORTED_TOKENS[ptAsset]?.addresses[fromChain] || '';

        return {
          ptAsset,
          ptAddress: ptAddress || dynamicPtAddress,
          amount,
          underlyingAsset: asset,
          fromChain,
          toChain,
          toProtocol,
        };
      }

      return {};
    },
    [values],
  );

  return { values, setValue, hydrate, buildParams };
}
