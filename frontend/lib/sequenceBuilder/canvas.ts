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
import type { ActionStep, ActionType, BuilderStep, DepositDestination, TokenState } from './types';

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

/** The one per-action table: label, palette blurb, and the row glyph. */
export const PALETTE_METADATA: Record<
  ActionType,
  { label: string; description: string; glyph: string }
> = {
  deposit: { label: 'Deposit', description: 'Earn yield in a protocol', glyph: '↓' },
  repay: { label: 'Repay', description: 'Pay down existing debt', glyph: '↩' },
  repayAndWithdraw: {
    label: 'Repay & Withdraw',
    description: 'Repay debt, free collateral',
    glyph: '↹',
  },
  bridge: { label: 'Bridge', description: 'Move to another chain', glyph: '⇄' },
  swap: { label: 'Swap', description: 'Exchange for another token', glyph: '⇅' },
  withdraw: { label: 'Withdraw', description: 'Exit protocol position', glyph: '↑' },
};

export type PaletteFilter = 'all' | ActionType;

/** Chip order differs from the metadata's key order: the common actions lead. */
const CHIP_ORDER: ActionType[] = [
  'deposit',
  'bridge',
  'swap',
  'repay',
  'withdraw',
  'repayAndWithdraw',
];

const PALETTE_FILTERS: Array<{ id: PaletteFilter; label: string }> = [
  { id: 'all', label: 'All' },
  ...CHIP_ORDER.map((id) => ({ id, label: PALETTE_METADATA[id].label })),
];

export type PaletteItem = { action: ActionType } & (typeof PALETTE_METADATA)[ActionType];

/** dataTransfer MIME type used when a palette row is dragged onto the canvas. */
export const ACTION_DRAG_MIME = 'application/x-verdant-action';

export function isActionType(value: string): value is ActionType {
  return Object.hasOwn(PALETTE_METADATA, value);
}

/** True exactly when the pipeline is waiting for the user to pick the next action. */
export function isPaletteOpen(steps: BuilderStep[]): boolean {
  return steps.length > 0 && steps[steps.length - 1].kind === 'action-select';
}

/** The step the side panel is showing; a stale index falls back to the tail. */
export function activeStep(steps: BuilderStep[], activeStepIndex: number): BuilderStep {
  return steps[activeStepIndex] ?? steps[steps.length - 1];
}

/** Addable actions for the token an open palette is acting on. */
export function getPaletteItems(tokenIn: TokenState, userPositions: Position[]): PaletteItem[] {
  return getEligibleActions(tokenIn, userPositions).map((action) => ({
    action,
    ...PALETTE_METADATA[action],
  }));
}

type PaletteView = {
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
  const visible =
    effectiveFilter === 'all' ? items : items.filter((item) => item.action === effectiveFilter);
  return { chips, effectiveFilter, visible };
}

// ---------------------------------------------------------------------------
// Step predicates
// ---------------------------------------------------------------------------

/**
 * The output token a successor would act on, or `null` for terminal kinds
 * (deposit/repay) and for anything still unconfigured. Placeholders carry
 * `{} as TokenState`, so "has a token symbol" is the configured test.
 */
export function stepOutputToken(step: BuilderStep): TokenState | null {
  return 'tokenOut' in step && step.tokenOut.token ? step.tokenOut : null;
}

/** True once the per-kind config card has filled the placeholder in. */
export function isStepConfigured(step: ActionStep): boolean {
  switch (step.kind) {
    case 'deposit':
      return Boolean(step.destination.id);
    case 'repay':
      return Boolean(step.targetPositionId);
    case 'withdraw':
      return stepOutputToken(step) !== null;
    case 'repayAndWithdraw':
      return Boolean(step.targetPositionId) && stepOutputToken(step) !== null;
    case 'bridge':
      return Boolean(step.toChain) && stepOutputToken(step) !== null;
    case 'swap':
      return Boolean(step.toToken) && stepOutputToken(step) !== null;
  }
}

// ---------------------------------------------------------------------------
// Step mutations
// ---------------------------------------------------------------------------

/** Replaces `steps[idx]` and drops everything after it: a change invalidates its successors. */
export function replaceStepAt(steps: BuilderStep[], idx: number, step: BuilderStep): BuilderStep[] {
  return [...steps.slice(0, idx), step];
}

/**
 * `replaceStepAt`, then reopens the palette on the step's output token. A
 * step with nothing to act on (terminal, or still a placeholder) is committed
 * as the new tail instead — this is the only place an action-select is built.
 */
export function commitStep(steps: BuilderStep[], idx: number, step: BuilderStep): BuilderStep[] {
  const tokenIn = stepOutputToken(step);
  const updated = replaceStepAt(steps, idx, step);
  return tokenIn ? [...updated, { kind: 'action-select', tokenIn }] : updated;
}

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

  return replaceStepAt(steps, steps.length - 1, newStep);
}

/**
 * Removes `steps[idx]` and everything after it by re-committing the exposed
 * predecessor: when it still has an output token the palette reopens on it,
 * otherwise (terminal or unconfigured) the pipeline is simply truncated.
 * Root (idx 0), out-of-range, and action-select targets are no-ops.
 */
export function removeStepAt(steps: BuilderStep[], idx: number): BuilderStep[] {
  if (idx <= 0 || idx >= steps.length) return steps;
  if (steps[idx].kind === 'action-select') return steps;
  return commitStep(steps, idx - 1, steps[idx - 1]);
}

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

type GraphNode = {
  id: string;
  index: number;
  step: BuilderStep;
  position: { x: number; y: number };
  isRoot: boolean;
  selected: boolean;
};

type GraphEdge = { id: string; source: string; target: string; label: string };

/** Card width in px — the node components apply it, so the spacing below is derived from it. */
export const NODE_WIDTH = 256;
/** Room between two cards for the edge's token-amount pill. */
const NODE_GAP = 104;
export const NODE_SPACING_X = NODE_WIDTH + NODE_GAP;

function formatTokenAmount(token: TokenState | undefined): string {
  if (!token?.token) return '';
  return `${formatToken(token.amount)} ${token.token}`;
}

/**
 * Materializes every non-action-select step as a node (id `step-${index}`)
 * laid out left-to-right, and connects consecutive nodes with an edge labelled
 * by the asset flowing into the target ("1,000 USDC"). Exactly one node — the
 * one at `activeStepIndex` — is `selected`; action-select itself is never a
 * node (the "+" port on the last real node covers that role).
 */
export function stepsToGraph(
  steps: BuilderStep[],
  activeStepIndex: number,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  steps.forEach((step, index) => {
    if (step.kind === 'action-select') return;
    nodes.push({
      id: `step-${index}`,
      index,
      step,
      position: { x: nodes.length * NODE_SPACING_X, y: 0 },
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
      // Narrowing only: a target is never the root, so it always has a tokenIn.
      label: target.step.kind === 'source' ? '' : formatTokenAmount(target.step.tokenIn),
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
  /** True while the step is still a placeholder awaiting its config card. */
  configuring: boolean;
};

/**
 * Derives the compact-card content for an action step purely from fields
 * already on the step — no fetch. A placeholder yields a safe "Configuring…"
 * shape until its config card fills it in.
 */
export function summarizeStep(step: ActionStep): StepSummary {
  const label = PALETTE_METADATA[step.kind].label;
  if (!isStepConfigured(step)) {
    return { title: label, subline: 'Configuring…', metric: '', chipValue: '', configuring: true };
  }
  const base = { subline: label, configuring: false };

  switch (step.kind) {
    case 'deposit':
      return {
        ...base,
        title: step.destination.displayName,
        metric: `APY ${formatPercent(step.destination.apy)} · TVL ${formatCompactUsd(step.destination.tvlUsd)}`,
        chipValue: formatTokenAmount(step.tokenIn),
      };
    case 'repay':
      return {
        ...base,
        title: `Repay ${step.tokenIn.token}`,
        metric: getChainDisplayName(step.tokenIn.chain),
        chipValue: formatTokenAmount(step.tokenIn),
      };
    case 'withdraw':
      return {
        ...base,
        title: `Withdraw ${step.tokenIn.token}`,
        metric: getChainDisplayName(step.tokenOut.chain),
        chipValue: formatTokenAmount(step.tokenOut),
      };
    case 'repayAndWithdraw':
      return {
        ...base,
        title: `Repay ${step.tokenIn.token} → ${step.tokenOut.token}`,
        metric: getChainDisplayName(step.tokenOut.chain),
        chipValue: formatTokenAmount(step.tokenOut),
      };
    case 'bridge':
      return {
        ...base,
        title: `→ ${getChainDisplayName(step.toChain)}`,
        metric: `Fee ${formatUsd(step.feeUsd)} · via ${step.bridgeId}`,
        chipValue: formatTokenAmount(step.tokenOut),
      };
    case 'swap':
      return {
        ...base,
        title: `${step.tokenIn.token} → ${step.toToken}`,
        metric: `Fee ${formatUsd(step.feeUsd)}`,
        chipValue: formatTokenAmount(step.tokenOut),
      };
  }
}
