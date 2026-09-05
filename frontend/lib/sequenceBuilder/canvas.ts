// Pure graph / palette / summary logic for the sequence-builder canvas.
//
// Deliberately free of React and `@xyflow/react`: this module is the
// client-safety firewall between the builder's data model and the canvas
// components, and it must stay importable under Vitest's `node` environment.

import { getChainDisplayName } from '@/lib/utils/chains';
import { formatCompactUsd, formatPercent, formatToken, formatUsd } from '@/lib/utils/formatting';
import type { Position } from '@/types/position';
import type { BridgeId, ChainId } from '@/types/shared';
import { getEligibleActions } from './logic';
import type { ActionType, BuilderStep, DepositDestination, TokenState } from './types';

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

export const PALETTE_METADATA: Record<ActionType, { label: string; description: string }> = {
  deposit: {
    label: 'Deposit',
    description: 'Earn yield in a protocol',
  },
  repay: {
    label: 'Repay',
    description: 'Pay down existing debt',
  },
  repayAndWithdraw: {
    label: 'Repay & Withdraw',
    description: 'Repay debt, free collateral',
  },
  bridge: {
    label: 'Bridge',
    description: 'Move to another chain',
  },
  swap: {
    label: 'Swap',
    description: 'Exchange for another token',
  },
  withdraw: {
    label: 'Withdraw',
    description: 'Exit protocol position',
  },
};

export type PaletteFilter = 'all' | ActionType;

export const PALETTE_FILTERS: Array<{ id: PaletteFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'deposit', label: 'Deposit' },
  { id: 'bridge', label: 'Bridge' },
  { id: 'swap', label: 'Swap' },
  { id: 'repay', label: 'Repay' },
  { id: 'withdraw', label: 'Withdraw' },
  { id: 'repayAndWithdraw', label: 'Repay & Withdraw' },
];

export type PaletteItem = { action: ActionType; label: string; description: string };

/** dataTransfer MIME type used when a palette row is dragged onto the canvas. */
export const ACTION_DRAG_MIME = 'application/x-verdant-action';

export function isActionType(value: string): value is ActionType {
  return Object.hasOwn(PALETTE_METADATA, value);
}

/** True exactly when the pipeline is waiting for the user to pick the next action. */
export function isPaletteOpen(steps: BuilderStep[]): boolean {
  return steps.length > 0 && steps[steps.length - 1].kind === 'action-select';
}

/** Addable actions for the trailing action-select, or `null` when the palette is closed. */
export function getPaletteItems(
  steps: BuilderStep[],
  userPositions: Position[],
): PaletteItem[] | null {
  // Doubles as the TypeScript narrowing `isPaletteOpen` cannot express.
  const trailing = steps[steps.length - 1];
  if (trailing?.kind !== 'action-select') return null;
  return getEligibleActions(trailing.tokenIn, userPositions).map((action) => ({
    action,
    ...PALETTE_METADATA[action],
  }));
}

function filterPaletteItems(items: PaletteItem[], filter: PaletteFilter): PaletteItem[] {
  if (filter === 'all') return items;
  return items.filter((item) => item.action === filter);
}

export type PaletteView = {
  /** Only the chips whose kind is actually addable right now (plus "All"). */
  chips: Array<{ id: PaletteFilter; label: string }>;
  /** `filter`, or `'all'` when the requested chip is no longer offered. */
  effectiveFilter: PaletteFilter;
  visible: PaletteItem[];
};

/**
 * Derives the palette's chip row and visible rows in one pass. The fallback
 * rule matters: when the previous step changes what is eligible, a chip the
 * user had selected can disappear — the list then reverts to "all" instead of
 * silently rendering empty.
 */
export function visiblePaletteFilters(items: PaletteItem[], filter: PaletteFilter): PaletteView {
  const chips = PALETTE_FILTERS.filter(
    (f) => f.id === 'all' || items.some((i) => i.action === f.id),
  );
  const effectiveFilter = chips.some((c) => c.id === filter) ? filter : 'all';
  return { chips, effectiveFilter, visible: filterPaletteItems(items, effectiveFilter) };
}

// ---------------------------------------------------------------------------
// Step mutations
// ---------------------------------------------------------------------------

/**
 * Replaces the trailing action-select with a fresh placeholder of `action`.
 * Fail-closed: returns `steps` untouched unless the trailing step really is an
 * action-select (a stale drag-start or a drop racing a state change must not
 * corrupt the pipeline).
 */
export function appendStepOfKind(steps: BuilderStep[], action: ActionType): BuilderStep[] {
  if (steps.length === 0) return steps;
  const trailing = steps[steps.length - 1];
  if (trailing.kind !== 'action-select') return steps;

  const tokenIn = trailing.tokenIn;
  let newStep: BuilderStep;

  // Placeholders are intentionally partial (empty-object / empty-string casts to
  // the named field types): the per-kind config card fills them in, and
  // summarizeStep treats them as "Configuring…" until then. Same shapes the
  // original SequenceBuilderModal switch created.
  switch (action) {
    case 'deposit':
      newStep = {
        kind: 'deposit',
        tokenIn,
        destination: {} as DepositDestination,
      };
      break;
    case 'repay':
      newStep = { kind: 'repay', tokenIn, targetPositionId: '' };
      break;
    case 'withdraw':
      newStep = {
        kind: 'withdraw',
        tokenIn,
        sourcePositionId: tokenIn.sourcePositionId || '',
        tokenOut: {} as TokenState,
      };
      break;
    case 'repayAndWithdraw':
      newStep = {
        kind: 'repayAndWithdraw',
        tokenIn,
        targetPositionId: '',
        tokenOut: {} as TokenState,
      };
      break;
    case 'bridge':
      newStep = {
        kind: 'bridge',
        tokenIn,
        toChain: '' as ChainId,
        bridgeId: '' as BridgeId,
        feeUsd: 0,
        tokenOut: {} as TokenState,
      };
      break;
    case 'swap':
      newStep = { kind: 'swap', tokenIn, toToken: '', feeUsd: 0, tokenOut: {} as TokenState };
      break;
  }

  const updated = steps.slice(0, steps.length - 1);
  updated.push(newStep);
  return updated;
}

/**
 * Removes `steps[idx]` and everything after it. When the exposed predecessor
 * still has an output token to act on (source or a transit step), a fresh
 * action-select is re-derived from it so the palette reopens; a terminal
 * predecessor (deposit/repay) is already submittable and gets a plain truncation.
 * Root (idx 0), out-of-range, and action-select targets are no-ops.
 */
export function removeStepAt(steps: BuilderStep[], idx: number): BuilderStep[] {
  if (idx <= 0 || idx >= steps.length) return steps;
  if (steps[idx].kind === 'action-select') return steps;

  const truncated = steps.slice(0, idx);
  const prev = truncated[truncated.length - 1];

  switch (prev.kind) {
    case 'source':
    case 'withdraw':
    case 'repayAndWithdraw':
    case 'bridge':
    case 'swap':
      return [...truncated, { kind: 'action-select', tokenIn: prev.tokenOut }];
    default:
      return truncated;
  }
}

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

export type GraphNode = {
  id: string;
  index: number;
  step: BuilderStep;
  x: number;
  y: number;
  isRoot: boolean;
  selected: boolean;
};

export type GraphEdge = { id: string; source: string; target: string; label: string };

export const NODE_SPACING_X = 360;
export const NODE_Y = 0;

/** Deterministic left-to-right placement — the sole source of truth for node position. */
export function layoutPosition(index: number): { x: number; y: number } {
  return { x: index * NODE_SPACING_X, y: NODE_Y };
}

function formatTokenAmount(token: TokenState | undefined): string {
  if (!token?.token) return '';
  return `${formatToken(token.amount)} ${token.token}`;
}

/** The asset flowing INTO `step`, e.g. "1,000 USDC". Empty for the root. */
export function edgeLabelForStep(step: BuilderStep): string {
  if (step.kind === 'source') return '';
  return formatTokenAmount(step.tokenIn);
}

/**
 * Materializes every non-action-select step as a node (id `step-${index}`) and
 * connects consecutive materialized nodes. Exactly one node — the one at
 * `activeStepIndex` — is `selected`; action-select itself is never a node (the
 * "+" port on the last real node covers that role).
 */
export function stepsToGraph(
  steps: BuilderStep[],
  activeStepIndex: number,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  steps.forEach((step, index) => {
    if (step.kind === 'action-select') return;
    const { x, y } = layoutPosition(nodes.length);
    nodes.push({
      id: `step-${index}`,
      index,
      step,
      x,
      y,
      isRoot: index === 0,
      selected: index === activeStepIndex,
    });
  });

  const edges: GraphEdge[] = [];
  for (let i = 1; i < nodes.length; i++) {
    const source = nodes[i - 1];
    const target = nodes[i];
    edges.push({
      id: `edge-${source.index}-${target.index}`,
      source: source.id,
      target: target.id,
      label: edgeLabelForStep(target.step),
    });
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Compact-card summaries
// ---------------------------------------------------------------------------

export type StepSummary = {
  title: string;
  subline: string;
  metric: string;
  chipValue: string;
};

const CONFIGURING = 'Configuring…';

function incomplete(title: string): StepSummary {
  return { title, subline: CONFIGURING, metric: '', chipValue: '' };
}

/**
 * Derives the compact-card content for a materialized step purely from fields
 * already on the step — no fetch. Returns `null` for the two kinds that never
 * render a StepNode (action-select is never a card; the root `source` step is
 * DepositNode's job) and a safe "Configuring…" shape while a step is still a
 * placeholder.
 */
export function summarizeStep(step: BuilderStep): StepSummary | null {
  switch (step.kind) {
    case 'action-select':
    case 'source':
      return null;

    case 'deposit': {
      const dest = step.destination;
      if (!dest?.id) return incomplete(PALETTE_METADATA.deposit.label);
      return {
        title: dest.displayName,
        subline: PALETTE_METADATA.deposit.label,
        metric: `APY ${formatPercent(dest.apy)} · TVL ${formatCompactUsd(dest.tvlUsd)}`,
        chipValue: formatTokenAmount(step.tokenIn),
      };
    }

    case 'repay': {
      if (!step.targetPositionId) return incomplete(PALETTE_METADATA.repay.label);
      return {
        title: `Repay ${step.tokenIn.token}`,
        subline: PALETTE_METADATA.repay.label,
        metric: getChainDisplayName(step.tokenIn.chain),
        chipValue: formatTokenAmount(step.tokenIn),
      };
    }

    case 'withdraw': {
      if (!step.tokenOut?.token) return incomplete(PALETTE_METADATA.withdraw.label);
      return {
        title: `Withdraw ${step.tokenIn.token}`,
        subline: PALETTE_METADATA.withdraw.label,
        metric: getChainDisplayName(step.tokenOut.chain),
        chipValue: formatTokenAmount(step.tokenOut),
      };
    }

    case 'repayAndWithdraw': {
      if (!step.targetPositionId || !step.tokenOut?.token) {
        return incomplete(PALETTE_METADATA.repayAndWithdraw.label);
      }
      return {
        title: `Repay ${step.tokenIn.token} → ${step.tokenOut.token}`,
        subline: PALETTE_METADATA.repayAndWithdraw.label,
        metric: getChainDisplayName(step.tokenOut.chain),
        chipValue: formatTokenAmount(step.tokenOut),
      };
    }

    case 'bridge': {
      if (!step.toChain || !step.tokenOut?.token) return incomplete(PALETTE_METADATA.bridge.label);
      return {
        title: `→ ${getChainDisplayName(step.toChain)}`,
        subline: PALETTE_METADATA.bridge.label,
        metric: `Fee ${formatUsd(step.feeUsd)} · via ${step.bridgeId}`,
        chipValue: formatTokenAmount(step.tokenOut),
      };
    }

    case 'swap': {
      if (!step.toToken || !step.tokenOut?.token) return incomplete(PALETTE_METADATA.swap.label);
      return {
        title: `${step.tokenIn.token} → ${step.toToken}`,
        subline: PALETTE_METADATA.swap.label,
        metric: `Fee ${formatUsd(step.feeUsd)}`,
        chipValue: formatTokenAmount(step.tokenOut),
      };
    }
  }
}
