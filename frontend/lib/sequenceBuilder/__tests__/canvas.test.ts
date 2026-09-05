import { describe, expect, it } from 'vitest';
import type { Position } from '@/types/position';
import type { BridgeId, ChainId } from '@/types/shared';
import {
  appendStepOfKind,
  edgeLabelForStep,
  getPaletteItems,
  isActionType,
  isPaletteOpen,
  layoutPosition,
  NODE_SPACING_X,
  NODE_Y,
  PALETTE_METADATA,
  type PaletteItem,
  removeStepAt,
  stepsToGraph,
  summarizeStep,
  visiblePaletteFilters,
} from '../canvas';
import type { ActionType, BuilderStep, DepositDestination, TokenState } from '../types';

const ALL_ACTION_TYPES: ActionType[] = [
  'deposit',
  'repay',
  'withdraw',
  'repayAndWithdraw',
  'bridge',
  'swap',
];

describe('Sequence Builder Canvas', () => {
  const mockPositions: Position[] = [
    {
      id: 'aave-supply-usdc-arb',
      protocol: 'aave',
      chain: 'arbitrum',
      asset: 'USDC',
      assetAddress: '0x123',
      amount: 1000,
      amountUsd: 1000,
      currentApy: 0.04,
      positionType: 'supply',
      claimableRewards: [],
      priceUsd: 1,
      metadata: {},
    },
    {
      id: 'aave-borrow-usdc-arb',
      protocol: 'aave',
      chain: 'arbitrum',
      asset: 'USDC',
      assetAddress: '0x123',
      amount: 500,
      amountUsd: 500,
      currentApy: 0.05,
      positionType: 'borrow',
      claimableRewards: [],
      priceUsd: 1,
      healthFactor: 2.0,
      metadata: {},
    },
  ];

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
  const bridge: BuilderStep = {
    kind: 'bridge',
    tokenIn: usdcArb,
    toChain: 'base',
    bridgeId: 'across',
    feeUsd: 1.2,
    tokenOut: usdcBase,
  };
  const swap: BuilderStep = {
    kind: 'swap',
    tokenIn: usdcBase,
    toToken: 'WETH',
    feeUsd: 0.5,
    tokenOut: wethBase,
  };
  const deposit: BuilderStep = { kind: 'deposit', tokenIn: usdcBase, destination };
  const repay: BuilderStep = {
    kind: 'repay',
    tokenIn: usdcArb,
    targetPositionId: 'aave-borrow-usdc-arb',
  };
  const withdraw: BuilderStep = {
    kind: 'withdraw',
    tokenIn: { ...usdcArb, sourcePositionId: 'aave-supply-usdc-arb', positionType: 'supply' },
    sourcePositionId: 'aave-supply-usdc-arb',
    tokenOut: usdcArb,
  };
  const repayAndWithdraw: BuilderStep = {
    kind: 'repayAndWithdraw',
    tokenIn: usdcArb,
    targetPositionId: 'aave-borrow-usdc-arb',
    tokenOut: wethBase,
  };
  // Mid-edit placeholders, exactly as appendStepOfKind creates them — used by
  // the palette / fail-closed guards as "trailing step is not action-select".
  const depositPlaceholder: BuilderStep = {
    kind: 'deposit',
    tokenIn: usdcBase,
    destination: {} as DepositDestination,
  };
  const withdrawPlaceholder: BuilderStep = {
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
      expect(edgeLabelForStep(withdraw)).toBe('1,000 USDC');
      const { edges } = stepsToGraph([source, bridge], 1);
      expect(edges[0].label).toBe('1,000 USDC');
    });

    it('layoutPosition places index i at exactly i * NODE_SPACING_X on a constant y', () => {
      // Pin the constant itself: the edge pill is drawn in the gap between two
      // w-64 (256px) cards, so shrinking the spacing clips it.
      expect(NODE_SPACING_X).toBe(360);
      expect(NODE_SPACING_X).toBeGreaterThanOrEqual(320);
      expect(NODE_Y).toBe(0);

      const positions = [0, 1, 2, 3, 4].map(layoutPosition);
      positions.forEach((pos, index) => {
        expect(pos).toEqual({ x: index * NODE_SPACING_X, y: NODE_Y });
      });
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i].x - positions[i - 1].x).toBe(NODE_SPACING_X);
        expect(positions[i].y).toBe(positions[0].y);
      }
    });
  });

  describe('isActionType', () => {
    it('accepts every ActionType', () => {
      for (const action of ALL_ACTION_TYPES) {
        expect(isActionType(action)).toBe(true);
      }
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

    it('getPaletteItems returns null when the palette is not open', () => {
      expect(getPaletteItems([source, depositPlaceholder], mockPositions)).toBeNull();
      expect(getPaletteItems([emptySource], mockPositions)).toBeNull();
    });

    it('getPaletteItems filters through getEligibleActions', () => {
      const supplyIn: TokenState = {
        ...usdcArb,
        sourcePositionId: 'aave-supply-usdc-arb',
        positionType: 'supply',
      };
      const items = getPaletteItems(
        [
          { kind: 'source', tokenOut: supplyIn },
          { kind: 'action-select', tokenIn: supplyIn },
        ],
        mockPositions,
      );
      expect(items).not.toBeNull();
      expect(items?.map((i) => i.action)).toEqual(['withdraw']);
      expect(items?.[0].label).toBe('Withdraw');
      expect(items?.[0].description.length).toBeGreaterThan(0);
    });

    it('visiblePaletteFilters keeps everything for "all" and narrows to one kind otherwise', () => {
      const items = getPaletteItems([source, actionSelect], mockPositions) as PaletteItem[];
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
      const items = getPaletteItems([source, actionSelect], mockPositions) as PaletteItem[];
      const { chips } = visiblePaletteFilters(items, 'all');
      expect(chips[0].id).toBe('all');
      const addable = new Set(items.map((i) => i.action));
      for (const chip of chips.slice(1)) {
        expect(addable.has(chip.id as ActionType)).toBe(true);
      }
      expect(chips).toHaveLength(addable.size + 1);
    });

    it('visiblePaletteFilters falls back to "all" when the active chip is no longer addable', () => {
      // A supply-sourced token only offers `withdraw`, so a stale `bridge`
      // chip must not strand the user on an empty list.
      const supplyIn: TokenState = {
        token: 'USDC',
        chain: 'arbitrum',
        amount: 1000,
        amountUsd: 1000,
        sourcePositionId: 'aave-supply-usdc-arb',
        positionType: 'supply',
      };
      const items = getPaletteItems(
        [
          { kind: 'source', tokenOut: supplyIn },
          { kind: 'action-select', tokenIn: supplyIn },
        ],
        mockPositions,
      ) as PaletteItem[];
      const view = visiblePaletteFilters(items, 'bridge');
      expect(view.effectiveFilter).toBe('all');
      expect(view.visible).toEqual(items);
      expect(view.chips.map((c) => c.id)).toEqual(['all', 'withdraw']);
    });
  });

  describe('appendStepOfKind', () => {
    const kinds = ALL_ACTION_TYPES;

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
      expect(expectedPlaceholders.map(([kind]) => kind)).toEqual(kinds);
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
      expect(summary).not.toBeNull();
      expect(summary?.title).toBe('Morpho — Gauntlet USDC');
      expect(summary?.metric).toContain('6.80%');
      expect(summary?.metric).toContain('$278.80M');
      expect(summary?.chipValue.length).toBeGreaterThan(0);
    });

    it('surfaces the fee and destination chain for a bridge', () => {
      const summary = summarizeStep(bridge);
      expect(summary).not.toBeNull();
      expect(`${summary?.title} ${summary?.metric}`).toContain('Base');
      expect(summary?.metric).toContain('$1.20');
      expect(summary?.chipValue).toBe('998.8 USDC');
    });

    it('surfaces the debt position chain and amount for a repay', () => {
      expect(summarizeStep(repay)).toEqual({
        title: 'Repay USDC',
        subline: 'Repay',
        metric: 'Arbitrum One',
        chipValue: '1,000 USDC',
      });
    });

    it('surfaces both legs for a repayAndWithdraw', () => {
      expect(summarizeStep(repayAndWithdraw)).toEqual({
        title: 'Repay USDC → WETH',
        subline: 'Repay & Withdraw',
        metric: 'Base',
        chipValue: '0.4 WETH',
      });
    });

    it('surfaces the pair and fee for a swap', () => {
      expect(summarizeStep(swap)).toEqual({
        title: 'USDC → WETH',
        subline: 'Swap',
        metric: 'Fee $0.50',
        chipValue: '0.4 WETH',
      });
    });

    it('surfaces the exited position for a withdraw', () => {
      expect(summarizeStep(withdraw)).toEqual({
        title: 'Withdraw USDC',
        subline: 'Withdraw',
        metric: 'Arbitrum One',
        chipValue: '1,000 USDC',
      });
    });

    it('returns null for the kinds that never render a StepNode', () => {
      // action-select is never a card; the root `source` step is DepositNode's.
      expect(summarizeStep(actionSelect)).toBeNull();
      expect(summarizeStep(source)).toBeNull();
      expect(summarizeStep(emptySource)).toBeNull();
    });

    it.each(
      ALL_ACTION_TYPES,
    )('returns the safe "Configuring…" fallback for a fresh %s placeholder', (kind) => {
      // Driven from the real placeholders so the two stay in sync.
      const placeholder = appendStepOfKind([source, actionSelect], kind)[1];
      expect(placeholder.kind).toBe(kind);
      expect(summarizeStep(placeholder)).toEqual({
        title: PALETTE_METADATA[kind].label,
        subline: 'Configuring…',
        metric: '',
        chipValue: '',
      });
    });
  });
});
