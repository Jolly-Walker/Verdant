import { describe, expect, it } from 'vitest';
import type { BridgeId, ChainId } from '@/types/shared';
import {
  activeStep,
  appendStepOfKind,
  commitStep,
  getPaletteItems,
  isActionType,
  isPaletteOpen,
  isStepConfigured,
  NODE_SPACING_X,
  NODE_WIDTH,
  PALETTE_METADATA,
  type PaletteItem,
  removeStepAt,
  replaceStepAt,
  stepOutputToken,
  stepsToGraph,
  summarizeStep,
  visiblePaletteFilters,
} from '../canvas';
import type { ActionStep, ActionType, BuilderStep, DepositDestination, TokenState } from '../types';
import { mockPositions } from './fixtures';

// The full union the palette knows about, spelled out so a new kind fails here.
const ALL_ACTION_TYPES: ActionType[] = [
  'deposit',
  'repay',
  'withdraw',
  'repayAndWithdraw',
  'bridge',
  'swap',
];

describe('Sequence Builder Canvas', () => {
  const usdcArb: TokenState = {
    token: 'USDC',
    chain: 'arbitrum',
    amount: 1000,
    amountUsd: 1000,
    positionType: 'wallet',
  };

  const usdcBase: TokenState = { token: 'USDC', chain: 'base', amount: 998.8, amountUsd: 998.8 };

  const wethBase: TokenState = { token: 'WETH', chain: 'base', amount: 0.4, amountUsd: 995 };

  // A token that came out of a supply position — `appendStepOfKind` must carry
  // its `sourcePositionId` onto a withdraw placeholder.
  const supplyUsdcArb: TokenState = {
    ...usdcArb,
    sourcePositionId: 'aave-supply-usdc-arb',
    positionType: 'supply',
  };

  const destination: DepositDestination = {
    id: 'pool-1',
    protocol: 'morpho',
    chain: 'base',
    token: 'USDC',
    apy: 0.068,
    apyMean30d: 0.065,
    apyBase: 0.05,
    apyReward: 0.018,
    displayName: 'Morpho — Gauntlet USDC',
    outputTokenSymbol: 'gauntletUSDC',
    apyType: 'variable',
    tvlUsd: 278_800_000,
    rewardTokens: [],
    lockPeriodDays: null,
    lockDescription: null,
  };

  const emptySource: BuilderStep = {
    kind: 'source',
    tokenOut: { token: '', chain: 'ethereum', amount: 0, amountUsd: 0 },
  };
  const source: BuilderStep = { kind: 'source', tokenOut: usdcArb };
  const actionSelect: BuilderStep = { kind: 'action-select', tokenIn: usdcArb };
  const bridge: ActionStep = {
    kind: 'bridge',
    tokenIn: usdcArb,
    toChain: 'base',
    bridgeId: 'across',
    feeUsd: 1.2,
    tokenOut: usdcBase,
  };
  const swap: ActionStep = {
    kind: 'swap',
    tokenIn: usdcBase,
    toToken: 'WETH',
    feeUsd: 0.5,
    tokenOut: wethBase,
  };
  const deposit: ActionStep = { kind: 'deposit', tokenIn: usdcBase, destination };
  const repay: ActionStep = {
    kind: 'repay',
    tokenIn: usdcArb,
    targetPositionId: 'aave-borrow-usdc-arb',
  };
  const withdraw: ActionStep = {
    kind: 'withdraw',
    tokenIn: supplyUsdcArb,
    sourcePositionId: 'aave-supply-usdc-arb',
    tokenOut: usdcArb,
  };
  const repayAndWithdraw: ActionStep = {
    kind: 'repayAndWithdraw',
    tokenIn: usdcArb,
    targetPositionId: 'aave-borrow-usdc-arb',
    tokenOut: wethBase,
  };
  // Mid-edit placeholders, exactly as appendStepOfKind creates them — used by
  // the palette / fail-closed guards as "trailing step is not action-select".
  const depositPlaceholder: ActionStep = {
    kind: 'deposit',
    tokenIn: usdcBase,
    destination: {} as DepositDestination,
  };
  const withdrawPlaceholder: ActionStep = {
    kind: 'withdraw',
    tokenIn: usdcArb,
    sourcePositionId: 'aave-supply-usdc-arb',
    tokenOut: {} as TokenState,
  };

  describe('stepsToGraph', () => {
    it('builds N nodes and N-1 edges in array order', () => {
      const { nodes, edges } = stepsToGraph([source, bridge, deposit], 2);
      expect(nodes).toHaveLength(3);
      expect(edges).toHaveLength(2);
      expect(nodes.map((n) => n.id)).toEqual(['step-0', 'step-1', 'step-2']);
      for (let i = 0; i < edges.length; i++) {
        expect(edges[i].source).toBe(nodes[i].id);
        expect(edges[i].target).toBe(nodes[i + 1].id);
      }
    });

    it('skips action-select steps when materializing nodes', () => {
      const { nodes, edges } = stepsToGraph([source, actionSelect], 1);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].step.kind).toBe('source');
      expect(edges).toHaveLength(0);
    });

    it('yields only the root node for the initial empty source', () => {
      const { nodes, edges } = stepsToGraph([emptySource], 0);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].isRoot).toBe(true);
      expect(edges).toHaveLength(0);
    });

    it('marks isRoot true only for the index-0 node', () => {
      const { nodes } = stepsToGraph([source, bridge, deposit], 0);
      expect(nodes.map((n) => n.isRoot)).toEqual([true, false, false]);
    });

    it('marks selected true on exactly the activeStepIndex node', () => {
      const { nodes } = stepsToGraph([source, bridge, deposit], 1);
      expect(nodes.map((n) => n.selected)).toEqual([false, true, false]);
      expect(nodes.filter((n) => n.selected)).toHaveLength(1);
    });

    it('labels an edge with the destination step incoming token', () => {
      const { edges } = stepsToGraph([source, bridge, swap], 1);
      expect(edges.map((e) => e.label)).toEqual(['1,000 USDC', '998.8 USDC']);
    });

    it('lays nodes out left-to-right on one row, with room for the edge pill', () => {
      // The pill is drawn in the gap between two cards, so the gap past the card
      // width must clear it: a "1,000 USDC" mono pill is roughly 64px wide at its 10px font.
      expect(NODE_SPACING_X - NODE_WIDTH).toBeGreaterThanOrEqual(64);
      // Pins the current layout so a change is deliberate.
      expect(NODE_SPACING_X).toBe(360);
      const { nodes } = stepsToGraph([source, bridge, swap], 0);
      expect(nodes.map((n) => n.position)).toEqual([
        { x: 0, y: 0 },
        { x: NODE_SPACING_X, y: 0 },
        { x: 2 * NODE_SPACING_X, y: 0 },
      ]);
    });
  });

  describe('isActionType', () => {
    it('accepts every ActionType', () => {
      expect(ALL_ACTION_TYPES.every(isActionType)).toBe(true);
      // The list under test is the full union the palette knows about.
      expect(ALL_ACTION_TYPES.slice().sort()).toEqual(Object.keys(PALETTE_METADATA).sort());
    });

    it('rejects empty, unknown and prototype-inherited keys', () => {
      // `dataTransfer.getData` returns '' for a drop that carries no payload.
      for (const value of ['', 'nope', 'Deposit', 'deposit ', 'action-select', 'source']) {
        expect(isActionType(value)).toBe(false);
      }
      // Object.hasOwn, not `in`: inherited Object.prototype keys must not pass.
      for (const value of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
        expect(isActionType(value)).toBe(false);
      }
      expect(isActionType(undefined as unknown as string)).toBe(false);
      expect(isActionType(null as unknown as string)).toBe(false);
    });
  });

  describe('palette', () => {
    it('isPaletteOpen is true only when the trailing step is action-select', () => {
      expect(isPaletteOpen([source, actionSelect])).toBe(true);
      expect(isPaletteOpen([source, bridge, deposit])).toBe(false);
      expect(isPaletteOpen([source, withdrawPlaceholder])).toBe(false);
      expect(isPaletteOpen([])).toBe(false);
    });

    it('activeStep resolves the index, falling back to the tail when stale', () => {
      expect(activeStep([source, bridge, actionSelect], 1)).toBe(bridge);
      expect(activeStep([source, bridge, actionSelect], 7)).toBe(actionSelect);
    });

    it('getPaletteItems filters through getEligibleActions and carries the metadata', () => {
      const items = getPaletteItems(supplyUsdcArb, mockPositions);
      expect(items.map((i) => i.action)).toEqual(['withdraw']);
      expect(items[0]).toEqual({ action: 'withdraw', ...PALETTE_METADATA.withdraw });
    });

    it('visiblePaletteFilters keeps everything for "all" and narrows to one kind otherwise', () => {
      const items = getPaletteItems(usdcArb, mockPositions);
      expect(items.length).toBeGreaterThan(1);
      const all = visiblePaletteFilters(items, 'all');
      expect(all.effectiveFilter).toBe('all');
      expect(all.visible).toEqual(items);

      const bridgeOnly = visiblePaletteFilters(items, 'bridge');
      expect(bridgeOnly.effectiveFilter).toBe('bridge');
      expect(bridgeOnly.visible).toHaveLength(1);
      expect(bridgeOnly.visible[0].action).toBe('bridge');
    });

    it('visiblePaletteFilters offers a chip only for an addable kind, "All" always first', () => {
      const items = getPaletteItems(usdcArb, mockPositions);
      const { chips } = visiblePaletteFilters(items, 'all');
      expect(chips[0].id).toBe('all');
      const addable = new Set(items.map((i) => i.action));
      for (const chip of chips.slice(1)) {
        expect(addable.has(chip.id as ActionType)).toBe(true);
        expect(chip.label).toBe(PALETTE_METADATA[chip.id as ActionType].label);
      }
      expect(chips).toHaveLength(addable.size + 1);
    });

    it('visiblePaletteFilters offers every action as a chip, in the fixed chip order', () => {
      // Items go in union order, which differs from the chip order, so a pass
      // proves the chips follow CHIP_ORDER rather than the items' order.
      const items: PaletteItem[] = ALL_ACTION_TYPES.map((action) => ({
        action,
        ...PALETTE_METADATA[action],
      }));
      const ids = visiblePaletteFilters(items, 'all').chips.map((c) => c.id);
      // Exhaustive: an action added to the metadata but not to CHIP_ORDER fails here.
      expect(ids).toHaveLength(ALL_ACTION_TYPES.length + 1);
      expect(ids.slice(1).sort()).toEqual(Object.keys(PALETTE_METADATA).sort());
      expect(ids).toEqual([
        'all',
        'deposit',
        'bridge',
        'swap',
        'repay',
        'withdraw',
        'repayAndWithdraw',
      ]);
    });

    it('visiblePaletteFilters falls back to "all" when the active chip is no longer addable', () => {
      // A supply-sourced token only offers `withdraw`, so a stale `bridge`
      // chip must not strand the user on an empty list.
      const items = getPaletteItems(supplyUsdcArb, mockPositions);
      const view = visiblePaletteFilters(items, 'bridge');
      expect(view.effectiveFilter).toBe('all');
      expect(view.visible).toEqual(items);
      expect(view.chips.map((c) => c.id)).toEqual(['all', 'withdraw']);
    });
  });

  describe('step predicates', () => {
    it('stepOutputToken yields the configured output of source and transit steps only', () => {
      expect(stepOutputToken(source)).toBe(usdcArb);
      expect(stepOutputToken(bridge)).toBe(usdcBase);
      expect(stepOutputToken(swap)).toBe(wethBase);
      expect(stepOutputToken(withdraw)).toBe(usdcArb);
      expect(stepOutputToken(repayAndWithdraw)).toBe(wethBase);
      // Terminal kinds have no output; placeholders and the empty root have none yet.
      expect(stepOutputToken(deposit)).toBeNull();
      expect(stepOutputToken(repay)).toBeNull();
      expect(stepOutputToken(actionSelect)).toBeNull();
      expect(stepOutputToken(emptySource)).toBeNull();
      expect(stepOutputToken(withdrawPlaceholder)).toBeNull();
    });

    it('isStepConfigured is true for a filled step and false for every fresh placeholder', () => {
      for (const step of [deposit, repay, withdraw, repayAndWithdraw, bridge, swap]) {
        expect(isStepConfigured(step)).toBe(true);
      }
      for (const kind of ALL_ACTION_TYPES) {
        const placeholder = appendStepOfKind([source, actionSelect], kind)[1] as ActionStep;
        expect(isStepConfigured(placeholder)).toBe(false);
      }
    });

    it('isStepConfigured is false when only one of a two-part step is filled', () => {
      // Each case blanks one field of a configured fixture, so a dropped check flips it to true.
      expect(isStepConfigured({ ...repayAndWithdraw, targetPositionId: '' })).toBe(false);
      expect(isStepConfigured({ ...bridge, toChain: '' as ChainId })).toBe(false);
      // A bridge with a chain picked but no quote yet.
      expect(isStepConfigured({ ...bridge, tokenOut: {} as TokenState })).toBe(false);
      expect(isStepConfigured({ ...swap, tokenOut: {} as TokenState })).toBe(false);
      expect(isStepConfigured({ ...swap, toToken: '' })).toBe(false);
    });
  });

  describe('replaceStepAt / commitStep', () => {
    it('replaceStepAt swaps the step in and drops its successors', () => {
      const steps: BuilderStep[] = [source, bridge, swap, actionSelect];
      expect(replaceStepAt(steps, 1, withdraw)).toEqual([source, withdraw]);
      expect(steps).toHaveLength(4);
    });

    it('commitStep reopens the palette on the committed output token', () => {
      expect(commitStep([source, bridge, deposit], 1, swap)).toEqual([
        source,
        swap,
        { kind: 'action-select', tokenIn: wethBase },
      ]);
      // Seeding the root from nothing yields the canonical two-step start.
      expect(commitStep([], 0, source)).toEqual([source, actionSelect]);
    });

    it('commitStep leaves a step with no output as the new tail', () => {
      expect(commitStep([source, bridge, actionSelect], 1, deposit)).toEqual([source, deposit]);
      expect(commitStep([source, actionSelect], 0, emptySource)).toEqual([emptySource]);
    });
  });

  describe('appendStepOfKind', () => {
    // The exact placeholder each kind must produce from a supply-sourced
    // tokenIn. Every field the per-kind config card and summarizeStep's
    // "Configuring…" guards read is pinned here, so collapsing the switch to
    // `{ kind, tokenIn }` fails.
    const expectedPlaceholders: Array<[ActionType, BuilderStep]> = [
      [
        'deposit',
        { kind: 'deposit', tokenIn: supplyUsdcArb, destination: {} as DepositDestination },
      ],
      ['repay', { kind: 'repay', tokenIn: supplyUsdcArb, targetPositionId: '' }],
      [
        'withdraw',
        {
          kind: 'withdraw',
          tokenIn: supplyUsdcArb,
          sourcePositionId: 'aave-supply-usdc-arb',
          tokenOut: {} as TokenState,
        },
      ],
      [
        'repayAndWithdraw',
        {
          kind: 'repayAndWithdraw',
          tokenIn: supplyUsdcArb,
          targetPositionId: '',
          tokenOut: {} as TokenState,
        },
      ],
      [
        'bridge',
        {
          kind: 'bridge',
          tokenIn: supplyUsdcArb,
          toChain: '' as ChainId,
          bridgeId: '' as BridgeId,
          feeUsd: 0,
          tokenOut: {} as TokenState,
        },
      ],
      [
        'swap',
        {
          kind: 'swap',
          tokenIn: supplyUsdcArb,
          toToken: '',
          feeUsd: 0,
          tokenOut: {} as TokenState,
        },
      ],
    ];

    it('covers every ActionType in the placeholder table', () => {
      expect(expectedPlaceholders.map(([kind]) => kind)).toEqual(ALL_ACTION_TYPES);
    });

    it.each(
      expectedPlaceholders,
    )('builds the exact %s placeholder in place of the trailing action-select', (kind, expected) => {
      const steps: BuilderStep[] = [
        { kind: 'source', tokenOut: supplyUsdcArb },
        { kind: 'action-select', tokenIn: supplyUsdcArb },
      ];
      const result = appendStepOfKind(steps, kind);
      expect(result).toHaveLength(2);
      expect(result[1]).toEqual(expected);
      // Preceding steps pass through by reference; the input is never mutated.
      expect(result[0]).toBe(steps[0]);
      expect(steps[1].kind).toBe('action-select');
    });

    it('falls back to an empty sourcePositionId when tokenIn is not position-sourced', () => {
      // usdcArb is a wallet balance — no sourcePositionId to carry over.
      const result = appendStepOfKind([source, actionSelect], 'withdraw');
      expect(result[1]).toEqual({
        kind: 'withdraw',
        tokenIn: usdcArb,
        sourcePositionId: '',
        tokenOut: {} as TokenState,
      });
    });

    it('is a fail-closed no-op when the trailing step is not action-select', () => {
      const steps: BuilderStep[] = [source, depositPlaceholder];
      expect(appendStepOfKind(steps, 'swap')).toBe(steps);
      expect(appendStepOfKind([], 'swap')).toEqual([]);
    });
  });

  describe('removeStepAt', () => {
    it('re-derives a trailing action-select from a completed transit/source predecessor', () => {
      const cases: Array<{ steps: BuilderStep[]; idx: number; expectedTokenIn: TokenState }> = [
        { steps: [source, bridge, deposit], idx: 2, expectedTokenIn: usdcBase },
        { steps: [source, swap, deposit], idx: 2, expectedTokenIn: wethBase },
        { steps: [source, withdraw, deposit], idx: 2, expectedTokenIn: usdcArb },
        { steps: [source, repayAndWithdraw, deposit], idx: 2, expectedTokenIn: wethBase },
        // source-as-predecessor (idx === 1)
        { steps: [source, bridge, deposit], idx: 1, expectedTokenIn: usdcArb },
      ];
      for (const { steps, idx, expectedTokenIn } of cases) {
        const result = removeStepAt(steps, idx);
        expect(result).toHaveLength(idx + 1);
        expect(result.slice(0, idx)).toEqual(steps.slice(0, idx));
        expect(result[idx]).toEqual({ kind: 'action-select', tokenIn: expectedTokenIn });
      }
    });

    it('returns the plain truncation when the predecessor is a terminal deposit/repay', () => {
      // This shape cannot occur via the app's own state machine (a terminal step
      // never has anything after it) but must still degrade safely.
      const afterDeposit: BuilderStep[] = [source, deposit, swap];
      expect(removeStepAt(afterDeposit, 2)).toEqual([source, deposit]);
      const afterRepay: BuilderStep[] = [source, repay, swap];
      expect(removeStepAt(afterRepay, 2)).toEqual([source, repay]);
    });

    it('is a no-op for the root (idx 0)', () => {
      const steps: BuilderStep[] = [source, bridge];
      expect(removeStepAt(steps, 0)).toBe(steps);
    });

    it('is a no-op for idx >= steps.length', () => {
      const steps: BuilderStep[] = [source, bridge];
      expect(removeStepAt(steps, 2)).toBe(steps);
      expect(removeStepAt(steps, 99)).toBe(steps);
    });

    it('is a no-op when idx points at a persisted action-select', () => {
      const steps: BuilderStep[] = [source, actionSelect];
      expect(removeStepAt(steps, 1)).toBe(steps);
    });

    it('truncates instead of re-deriving when the predecessor has no output token', () => {
      // An unconfigured transit placeholder carries `{} as TokenState`.
      const unconfiguredBridge: BuilderStep = { ...bridge, tokenOut: {} as TokenState };
      const steps: BuilderStep[] = [source, unconfiguredBridge, deposit];
      expect(removeStepAt(steps, 2)).toEqual([source, unconfiguredBridge]);
    });
  });

  describe('summarizeStep', () => {
    it('surfaces APY and TVL for a deposit from existing destination fields', () => {
      const summary = summarizeStep(deposit);
      expect(summary.title).toBe('Morpho — Gauntlet USDC');
      expect(summary.metric).toContain('6.80%');
      expect(summary.metric).toContain('$278.80M');
      expect(summary.chipValue.length).toBeGreaterThan(0);
      expect(summary.configuring).toBe(false);
    });

    it('surfaces the fee and destination chain for a bridge', () => {
      const summary = summarizeStep(bridge);
      expect(`${summary.title} ${summary.metric}`).toContain('Base');
      expect(summary.metric).toContain('$1.20');
      expect(summary.chipValue).toBe('998.8 USDC');
      expect(summary.configuring).toBe(false);
    });

    it('surfaces the debt position chain and amount for a repay', () => {
      expect(summarizeStep(repay)).toEqual({
        title: 'Repay USDC',
        subline: 'Repay',
        metric: 'Arbitrum One',
        chipValue: '1,000 USDC',
        configuring: false,
      });
    });

    it('surfaces both legs for a repayAndWithdraw', () => {
      expect(summarizeStep(repayAndWithdraw)).toEqual({
        title: 'Repay USDC → WETH',
        subline: 'Repay & Withdraw',
        metric: 'Base',
        chipValue: '0.4 WETH',
        configuring: false,
      });
    });

    it('surfaces the pair and fee for a swap', () => {
      expect(summarizeStep(swap)).toEqual({
        title: 'USDC → WETH',
        subline: 'Swap',
        metric: 'Fee $0.50',
        chipValue: '0.4 WETH',
        configuring: false,
      });
    });

    it('surfaces the exited position for a withdraw', () => {
      expect(summarizeStep(withdraw)).toEqual({
        title: 'Withdraw USDC',
        subline: 'Withdraw',
        metric: 'Arbitrum One',
        chipValue: '1,000 USDC',
        configuring: false,
      });
    });

    it.each(
      ALL_ACTION_TYPES,
    )('returns the safe "Configuring…" fallback for a fresh %s placeholder', (kind) => {
      // Driven from the real placeholders so the two stay in sync.
      const placeholder = appendStepOfKind([source, actionSelect], kind)[1] as ActionStep;
      expect(placeholder.kind).toBe(kind);
      expect(summarizeStep(placeholder)).toEqual({
        title: PALETTE_METADATA[kind].label,
        subline: 'Configuring…',
        metric: '',
        chipValue: '',
        configuring: true,
      });
    });
  });
});
