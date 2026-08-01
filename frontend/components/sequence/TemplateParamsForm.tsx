'use client';

import type { SetTemplateParam, TemplateParamValues } from '@/hooks/useTemplateParams';
import type { TemplateId } from '@/types/sequencer';
import type { ChainId, ProtocolId } from '@/types/shared';

interface TemplateParamsFormProps {
  /** Which template's fields to show — drives every conditional below. */
  templateId: TemplateId;
  values: TemplateParamValues;
  setValue: SetTemplateParam;
}

const CHAIN_OPTIONS: { value: ChainId; label: string }[] = [
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'arbitrum', label: 'Arbitrum' },
  { value: 'base', label: 'Base' },
];

const PROTOCOL_OPTIONS: { value: ProtocolId; label: string }[] = [
  { value: 'aave', label: 'Aave V3' },
  { value: 'morpho', label: 'Morpho' },
  { value: 'euler', label: 'Euler' },
];

/**
 * The template parameter fields, shared verbatim by the sequence modal and the
 * standalone /sequence page. Purely presentational: state lives in
 * `useTemplateParams`, which also owns the state -> `TemplateParams` mapping.
 */
export function TemplateParamsForm({ templateId, values, setValue }: TemplateParamsFormProps) {
  // Debt-unwind templates swap the single asset picker for a borrow/collateral pair.
  const isDebtTemplate = templateId === 'repayAndWithdraw' || templateId === 'deleverageAave';
  const isDeleverage = templateId === 'deleverageAave';
  const showToChain =
    templateId === 'bridgeAndDeposit' ||
    templateId === 'crossChainRebalance' ||
    templateId === 'exitPendle';
  const showFromProtocol = templateId === 'crossChainRebalance' || isDebtTemplate;
  const showToProtocol = !isDebtTemplate && templateId !== 'exitPendle';

  return (
    <div className="space-y-4">
      {isDebtTemplate ? (
        <>
          <div>
            <label htmlFor="seq-borrow-asset" className="field-label">
              Borrow Asset (to repay)
            </label>
            <select
              id="seq-borrow-asset"
              className="field-input"
              value={values.borrowAsset}
              onChange={(e) => setValue('borrowAsset', e.target.value)}
            >
              <option value="USDC">USDC</option>
              <option value="USDT">USDT</option>
              <option value="DAI">DAI</option>
            </select>
          </div>
          <div>
            <label htmlFor="seq-collateral-asset" className="field-label">
              Collateral Asset (to withdraw)
            </label>
            <select
              id="seq-collateral-asset"
              className="field-input"
              value={values.collateralAsset}
              onChange={(e) => setValue('collateralAsset', e.target.value)}
            >
              <option value="ETH">ETH</option>
              <option value="wstETH">wstETH</option>
              <option value="WBTC">WBTC</option>
            </select>
          </div>
        </>
      ) : (
        <div>
          <label htmlFor="seq-asset" className="field-label">
            Asset
          </label>
          <select
            id="seq-asset"
            className="field-input"
            value={values.asset}
            onChange={(e) => setValue('asset', e.target.value)}
          >
            <option value="USDC">USDC</option>
            <option value="ETH">ETH</option>
          </select>
        </div>
      )}

      <div>
        <label htmlFor="seq-amount" className="field-label">
          {isDeleverage ? 'Total Debt Amount' : 'Amount'}
        </label>
        <input
          id="seq-amount"
          type="number"
          className="field-input font-mono"
          value={values.amount}
          onChange={(e) => setValue('amount', e.target.value)}
        />
      </div>

      {isDeleverage && (
        <div>
          <label htmlFor="seq-cycles" className="field-label">
            Unwind Cycles
          </label>
          <input
            id="seq-cycles"
            type="number"
            min="1"
            max="10"
            className="field-input font-mono"
            value={values.cycles}
            onChange={(e) => setValue('cycles', parseInt(e.target.value, 10) || 1)}
          />
          <p className="mt-1 text-xs text-verdant-text-muted">
            Higher cycles are safer but cost more gas.
          </p>
        </div>
      )}

      {isDebtTemplate && (
        <>
          <div>
            <label htmlFor="seq-collateral-amount" className="field-label">
              Total Collateral Amount
            </label>
            <input
              id="seq-collateral-amount"
              type="number"
              className="field-input font-mono"
              value={values.collateralAmount}
              onChange={(e) => setValue('collateralAmount', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="seq-health-factor" className="field-label">
              Current Health Factor
            </label>
            <input
              id="seq-health-factor"
              type="number"
              step="0.1"
              className="field-input font-mono"
              value={values.healthFactor}
              onChange={(e) => setValue('healthFactor', parseFloat(e.target.value) || 2.5)}
            />
          </div>
        </>
      )}

      <div>
        <label htmlFor="seq-from-chain" className="field-label">
          From Chain
        </label>
        <select
          id="seq-from-chain"
          className="field-input"
          value={values.fromChain}
          onChange={(e) => setValue('fromChain', e.target.value as ChainId)}
        >
          {CHAIN_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {showFromProtocol && (
        <div>
          <label htmlFor="seq-from-protocol" className="field-label">
            From Protocol
          </label>
          <select
            id="seq-from-protocol"
            className="field-input"
            value={values.fromProtocol}
            onChange={(e) => setValue('fromProtocol', e.target.value as ProtocolId)}
          >
            {PROTOCOL_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {showToChain && (
        <div>
          <label htmlFor="seq-to-chain" className="field-label">
            To Chain
          </label>
          <select
            id="seq-to-chain"
            className="field-input"
            value={values.toChain}
            onChange={(e) => setValue('toChain', e.target.value as ChainId)}
          >
            {CHAIN_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {showToProtocol && (
        <div>
          <label htmlFor="seq-to-protocol" className="field-label">
            Destination Protocol
          </label>
          <select
            id="seq-to-protocol"
            className="field-input"
            value={values.toProtocol}
            onChange={(e) => setValue('toProtocol', e.target.value as ProtocolId)}
          >
            {PROTOCOL_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
