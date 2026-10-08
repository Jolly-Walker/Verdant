'use client';

import { Handle, type Node, type NodeProps, Position } from '@xyflow/react';
import { TokenIcon } from '@/components/positions/TokenIcon';
import { PlusIcon } from '@/components/ui/PlusIcon';
import { XIcon } from '@/components/ui/XIcon';
import { NODE_WIDTH, summarizeStep } from '@/lib/sequenceBuilder/canvas';
import type { BuilderStep } from '@/lib/sequenceBuilder/types';

/**
 * Data carried by every canvas node. A `type` (not `interface`) so it satisfies
 * React Flow's `Record<string, unknown>` constraint on node data.
 */
export type CanvasNodeData = {
  step: BuilderStep;
  index: number;
  selected: boolean;
  /** True on the last materialized node while the palette is open. */
  showAddPort: boolean;
  onFocus: (index: number) => void;
  onRemove: (index: number) => void;
  onFocusPalette: () => void;
};

type StepFlowNode = Node<CanvasNodeData, 'step'>;

/** Edge anchors only — connections are disabled at the ReactFlow level, so they stay invisible. */
const HIDDEN_HANDLE = { opacity: 0 };

export function NodeHandles() {
  return (
    <>
      <Handle type="target" position={Position.Left} isConnectable={false} style={HIDDEN_HANDLE} />
      <Handle type="source" position={Position.Right} isConnectable={false} style={HIDDEN_HANDLE} />
    </>
  );
}

/** Round "+" port on the right edge of the last node — focuses the palette. */
export function AddPort({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label="Add step"
      className="pointer-events-auto absolute top-1/2 -right-6 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full"
    >
      <span className="grid h-7 w-7 place-items-center rounded-full bg-verdant-moss text-white shadow-organic transition-transform duration-150 hover:scale-110">
        <PlusIcon size={14} />
      </span>
    </button>
  );
}

/**
 * React Flow gives every node wrapper an inline `pointer-events: none` unless
 * the graph is selectable/draggable or an `onNodeClick` is wired (see
 * `NodeWrapper`'s `hasPointerEvents`) — all of which this read-only canvas
 * deliberately disables. `pointer-events-auto` re-enables input for the card
 * and its buttons without handing React Flow selection semantics we don't want.
 * The width is the layout constant the lib derives node spacing from.
 */
const CARD_STYLE = { width: NODE_WIDTH };

export function cardFrame(selected: boolean) {
  return {
    className: `pointer-events-auto relative rounded-2xl border bg-verdant-surface p-4 shadow-organic transition-[border-color,box-shadow] duration-200 ${
      selected
        ? 'border-verdant-moss ring-2 ring-verdant-moss/20'
        : 'border-verdant-rule hover:border-verdant-rule-strong'
    }`,
    style: CARD_STYLE,
  };
}

/**
 * Full-card hit target and the card's single tab stop — canvas nodes are not
 * focusable themselves (`nodesFocusable={false}`), so this button is what
 * keyboard users land on. Sits under the card's own `pointer-events-none`
 * content layer.
 */
export function CardFocusButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      // Not a toggle: activating it makes this step the current one.
      aria-current={selected ? 'step' : undefined}
      className="absolute inset-0 rounded-2xl"
    />
  );
}

/** Compact, read-only summary card for every non-root step. */
export function StepNode({ data }: NodeProps<StepFlowNode>) {
  // The root `source` step is DepositNode's; action-select is never a node.
  if (data.step.kind === 'source' || data.step.kind === 'action-select') return null;

  const summary = summarizeStep(data.step);

  return (
    <div {...cardFrame(data.selected)}>
      <CardFocusButton
        label={`Configure step ${data.index + 1}: ${summary.title}`}
        selected={data.selected}
        onClick={() => data.onFocus(data.index)}
      />

      <div className="pointer-events-none relative flex flex-col gap-3">
        <div className="flex items-start gap-3 pr-6">
          <TokenIcon symbol={data.step.tokenIn.token} className="h-9 w-9 shrink-0" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-verdant-text-primary">
              {summary.title}
            </div>
            <div
              className={`truncate text-xs ${
                summary.configuring ? 'italic text-verdant-teak' : 'text-verdant-text-muted'
              }`}
            >
              {summary.subline}
            </div>
          </div>
        </div>

        {summary.metric && (
          <div className="truncate font-mono text-[11px] tabular-nums text-verdant-text-muted">
            {summary.metric}
          </div>
        )}

        {summary.configuring ? (
          <div className="self-start rounded-lg border border-dashed border-verdant-rule-strong px-2.5 py-1 font-mono text-[11px] text-verdant-text-muted">
            Awaiting details
          </div>
        ) : (
          <div className="self-start rounded-lg bg-verdant-pine px-2.5 py-1 font-mono text-xs tabular-nums text-verdant-glacial">
            {summary.chipValue}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          data.onRemove(data.index);
        }}
        aria-label="Remove step"
        className="absolute -top-2 -right-2 grid h-11 w-11 place-items-center rounded-full focus-visible:outline-verdant-loss"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full border border-verdant-rule bg-verdant-surface text-verdant-text-muted shadow-organic transition-colors duration-150 hover:border-verdant-loss hover:text-verdant-loss">
          <XIcon size={11} strokeWidth={2.5} />
        </span>
      </button>

      {data.showAddPort && <AddPort onClick={data.onFocusPalette} />}
      <NodeHandles />
    </div>
  );
}
