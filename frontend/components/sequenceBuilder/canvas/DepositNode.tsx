'use client';

import type { Node, NodeProps } from '@xyflow/react';
import { TokenIcon } from '@/components/positions/TokenIcon';
import { getChainDisplayName } from '@/lib/utils/chains';
import { formatToken, formatUsd } from '@/lib/utils/formatting';
import { AddPort, type CanvasNodeData, CardFocusButton, cardFrame, NodeHandles } from './StepNode';

export type DepositFlowNode = Node<CanvasNodeData, 'deposit'>;

/**
 * Root card — the source of funds, styled after a "Simulate deposit" card:
 * amount + token chip + "≈ $ USD". Never removable.
 */
export function DepositNode({ data }: NodeProps<DepositFlowNode>) {
  if (data.step.kind !== 'source') return null;
  const out = data.step.tokenOut;
  const filled = Boolean(out.token) && out.amount > 0;

  return (
    <div className={cardFrame(data.selected)}>
      <CardFocusButton
        label="Configure source of funds"
        selected={data.selected}
        onClick={() => data.onFocus(data.index)}
      />

      <div className="pointer-events-none relative flex flex-col gap-3">
        <div className="fl-eyebrow">Source</div>

        <div className="flex items-center justify-between gap-3">
          <div
            className={`fl-numeral min-w-0 truncate text-3xl ${
              filled ? 'text-verdant-pine' : 'text-verdant-text-muted'
            }`}
          >
            {filled ? formatToken(out.amount) : '0'}
          </div>
          {out.token && (
            <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-verdant-rule bg-verdant-paper py-1 pr-3 pl-1">
              <TokenIcon symbol={out.token} className="h-5 w-5" />
              <span className="text-xs font-semibold text-verdant-text-primary">{out.token}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 font-mono text-[11px] tabular-nums text-verdant-text-muted">
          {filled ? (
            <>
              <span>≈ {formatUsd(out.amountUsd)} USD</span>
              <span className="truncate">{getChainDisplayName(out.chain)}</span>
            </>
          ) : (
            <span className="italic text-verdant-teak">Pick a position to fund the sequence</span>
          )}
        </div>
      </div>

      {data.showAddPort && <AddPort onClick={data.onFocusPalette} />}
      <NodeHandles />
    </div>
  );
}
