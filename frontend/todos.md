# Verdant — Flowchart Sequence Builder & Loop Modal Design

Branch: `demo`

This document covers two new components:
1. **SequenceBuilder** — replaces `SequenceModal` as the primary sequence entry point
2. **LoopModal** — a dedicated modal for leveraged loop and deleverage flows, triggered from `BorrowCard`

The existing `SequenceModal` is kept in the codebase as a fallback but is no longer the primary entry point from the dashboard. `BorrowCard` triggers `LoopModal` instead.

---

## Part 1 — SequenceBuilder

### Concept

The user builds a transaction sequence step-by-step, where each completed step constrains what actions are valid next. The system always knows the current token, amount, and chain — so every dropdown is contextually filtered. There are no fixed templates in this UI; the user composes the flow themselves.

The builder grows **horizontally**, wrapping to a new row when needed. Each step is a fixed-width card. On desktop: 4 cards per row. On tablet: 3. On mobile: 2. Cards never collapse into summaries — the user scrolls horizontally within each row or reads the full chain top-to-bottom.

---

### State model

The builder is driven by a `BuilderStep[]` array. Each step has a type, the resolved token state entering it, the user's selection, and the resolved token state exiting it.

```ts
// lib/sequenceBuilder/types.ts

export type ActionType =
  | 'deposit'          // terminal
  | 'repay'            // terminal
  | 'withdraw'         // transit
  | 'repayAndWithdraw' // transit
  | 'bridge'           // transit
  | 'swap'             // transit

export type TokenState = {
  token: string           // e.g. 'USDC'
  chain: ChainId
  amount: number          // in human units
  amountUsd: number
  sourcePositionId?: string  // set if token came from a position (supply/borrow), else undefined (wallet)
  positionType?: 'wallet' | 'supply' // what type of holding this token represents at this point
}

export type BuilderStep =
  | { kind: 'source';         tokenOut: TokenState }
  | { kind: 'action-select';  tokenIn: TokenState }
  | { kind: 'deposit';        tokenIn: TokenState; destination: DepositDestination }
  | { kind: 'repay';          tokenIn: TokenState; targetPositionId: string }
  | { kind: 'withdraw';       tokenIn: TokenState; sourcePositionId: string; tokenOut: TokenState }
  | { kind: 'repayAndWithdraw'; tokenIn: TokenState; targetPositionId: string; tokenOut: TokenState }
  | { kind: 'bridge';         tokenIn: TokenState; toChain: ChainId; bridgeId: BridgeId; feeUsd: number; tokenOut: TokenState }
  | { kind: 'swap';           tokenIn: TokenState; toToken: string; feeUsd: number; tokenOut: TokenState }

export type DepositDestination = {
  protocol: ProtocolId
  chain: ChainId
  token: string
  apy: number
  apyLabel: string        // e.g. '6.8% APY'
  displayName: string     // e.g. 'Morpho Gauntlet USDC'
  outputTokenLabel: string // e.g. 'gauntletUSDC' or 'aUSDC'
  outputTokenSymbol: string
}
```

**Termination rule:** A step is terminal when its `kind` is `'deposit'` or `'repay'`. The chain is complete and can be submitted. Transit steps (`withdraw`, `repayAndWithdraw`, `bridge`, `swap`) always append an `action-select` card after them so the user can optionally continue or submit.

---

### Source registry — `lib/sequenceBuilder/destinations.ts`

This is the key new data file. It defines every supported deposit destination across all chains and assets. This is what populates the Deposit dropdown. It is a static registry for now — APYs will be live-fetched in a future milestone.

```ts
export interface DepositDestination {
  id: string              // unique — e.g. 'morpho-gauntlet-usdc-base'
  protocol: ProtocolId
  chain: ChainId
  token: string           // input token symbol
  apy: number             // decimal, e.g. 0.068 for 6.8%
  displayName: string     // e.g. 'Morpho — Gauntlet USDC Vault'
  outputTokenSymbol: string // e.g. 'gauntletUSDC'
  apyType: 'variable' | 'fixed'
}

export const DEPOSIT_DESTINATIONS: DepositDestination[] = [
  // Ethereum
  { id: 'aave-usdc-eth',            protocol: 'aave',   chain: 'ethereum', token: 'USDC',   apy: 0.042, displayName: 'Aave V3 — USDC',              outputTokenSymbol: 'aUSDC',         apyType: 'variable' },
  { id: 'aave-weth-eth',            protocol: 'aave',   chain: 'ethereum', token: 'WETH',   apy: 0.018, displayName: 'Aave V3 — WETH',              outputTokenSymbol: 'aWETH',         apyType: 'variable' },
  { id: 'aave-wbtc-eth',            protocol: 'aave',   chain: 'ethereum', token: 'WBTC',   apy: 0.011, displayName: 'Aave V3 — WBTC',              outputTokenSymbol: 'aWBTC',         apyType: 'variable' },
  { id: 'morpho-gauntlet-usdc-eth', protocol: 'morpho', chain: 'ethereum', token: 'USDC',   apy: 0.071, displayName: 'Morpho — Gauntlet USDC',      outputTokenSymbol: 'gauntletUSDC',  apyType: 'variable' },
  { id: 'morpho-steakhouse-usdc-eth',protocol:'morpho', chain: 'ethereum', token: 'USDC',   apy: 0.065, displayName: 'Morpho — Steakhouse USDC',    outputTokenSymbol: 'steakUSDC',     apyType: 'variable' },
  { id: 'morpho-re7-weth-eth',      protocol: 'morpho', chain: 'ethereum', token: 'WETH',   apy: 0.034, displayName: 'Morpho — Re7 WETH',           outputTokenSymbol: 're7WETH',       apyType: 'variable' },
  { id: 'euler-usdc-eth',           protocol: 'euler',  chain: 'ethereum', token: 'USDC',   apy: 0.059, displayName: 'Euler V2 — USDC',             outputTokenSymbol: 'eUSDC',         apyType: 'variable' },
  { id: 'euler-weth-eth',           protocol: 'euler',  chain: 'ethereum', token: 'WETH',   apy: 0.028, displayName: 'Euler V2 — WETH',             outputTokenSymbol: 'eWETH',         apyType: 'variable' },

  // Arbitrum
  { id: 'aave-usdc-arb',            protocol: 'aave',   chain: 'arbitrum', token: 'USDC',   apy: 0.044, displayName: 'Aave V3 — USDC',              outputTokenSymbol: 'aUSDC',         apyType: 'variable' },
  { id: 'aave-weth-arb',            protocol: 'aave',   chain: 'arbitrum', token: 'WETH',   apy: 0.019, displayName: 'Aave V3 — WETH',              outputTokenSymbol: 'aWETH',         apyType: 'variable' },
  { id: 'morpho-gauntlet-usdc-arb', protocol: 'morpho', chain: 'arbitrum', token: 'USDC',   apy: 0.068, displayName: 'Morpho — Gauntlet USDC',      outputTokenSymbol: 'gauntletUSDC',  apyType: 'variable' },
  { id: 'euler-usdc-arb',           protocol: 'euler',  chain: 'arbitrum', token: 'USDC',   apy: 0.057, displayName: 'Euler V2 — USDC',             outputTokenSymbol: 'eUSDC',         apyType: 'variable' },

  // Base
  { id: 'aave-usdc-base',           protocol: 'aave',   chain: 'base',     token: 'USDC',   apy: 0.041, displayName: 'Aave V3 — USDC',              outputTokenSymbol: 'aUSDC',         apyType: 'variable' },
  { id: 'morpho-gauntlet-usdc-base',protocol: 'morpho', chain: 'base',     token: 'USDC',   apy: 0.068, displayName: 'Morpho — Gauntlet USDC',      outputTokenSymbol: 'gauntletUSDC',  apyType: 'variable' },
  { id: 'morpho-usdc-base',         protocol: 'morpho', chain: 'base',     token: 'USDC',   apy: 0.062, displayName: 'Morpho — USDC Core',          outputTokenSymbol: 'mUSDC',         apyType: 'variable' },
  { id: 'euler-usdc-base',          protocol: 'euler',  chain: 'base',     token: 'USDC',   apy: 0.055, displayName: 'Euler V2 — USDC',             outputTokenSymbol: 'eUSDC',         apyType: 'variable' },
  { id: 'euler-weth-base',          protocol: 'euler',  chain: 'base',     token: 'WETH',   apy: 0.024, displayName: 'Euler V2 — WETH',             outputTokenSymbol: 'eWETH',         apyType: 'variable' },
]

export function getDepositDestinations(token: string, chain: ChainId): DepositDestination[] {
  return DEPOSIT_DESTINATIONS.filter(d => d.token === token && d.chain === chain)
    .sort((a, b) => b.apy - a.apy)  // highest APY first
}
```

---

### Builder logic — `lib/sequenceBuilder/logic.ts`

```ts
// Returns which actions are valid given the current token state
export function getEligibleActions(
  tokenState: TokenState,
  userPositions: Position[]
): ActionType[] {
  const actions: ActionType[] = []

  // Always available if token is a wallet or freely held token
  const isWalletToken =
    tokenState.positionType === 'wallet' ||
    tokenState.sourcePositionId === undefined

  const isSupplyPosition = tokenState.positionType === 'supply'

  if (isSupplyPosition) {
    actions.push('withdraw')
    // No other actions — user must withdraw first
    return actions
  }

  // From wallet/transit token:
  actions.push('bridge')
  actions.push('swap')
  actions.push('deposit')
  actions.push('repay')
  actions.push('repayAndWithdraw')

  // Filter repay/repayAndWithdraw if no matching borrow positions
  const hasBorrowMatch = userPositions.some(
    p => p.positionType === 'borrow' &&
         p.chain === tokenState.chain &&
         p.asset === tokenState.token
  )
  if (!hasBorrowMatch) {
    return actions.filter(a => a !== 'repay' && a !== 'repayAndWithdraw')
  }

  return actions
}

// Returns true if the sequence can be submitted at this point
export function canSubmit(steps: BuilderStep[]): boolean {
  if (steps.length < 2) return false  // need at least source + one action
  const last = steps[steps.length - 1]
  return last.kind === 'deposit' || last.kind === 'repay'
}

// Returns true if the sequence is in a valid intermediate state
// where the user can optionally add more steps or submit
export function canAddMore(steps: BuilderStep[]): boolean {
  if (steps.length < 2) return false
  const last = steps[steps.length - 1]
  return (
    last.kind === 'withdraw' ||
    last.kind === 'repayAndWithdraw' ||
    last.kind === 'bridge' ||
    last.kind === 'swap'
  )
}

// Computes the net token delta for the summary bar
export function computeTokenDelta(steps: BuilderStep[]): {
  input: { token: string; amount: number; chain: ChainId } | null
  output: { token: string; amount: number; chain: ChainId; label: string } | null
  totalFeeUsd: number
  feeBreakdown: { label: string; feeUsd: number }[]
} {
  const source = steps[0]
  if (!source || source.kind !== 'source') return { input: null, output: null, totalFeeUsd: 0, feeBreakdown: [] }

  const input = {
    token: source.tokenOut.token,
    amount: source.tokenOut.amount,
    chain: source.tokenOut.chain,
  }

  let totalFeeUsd = 0
  const feeBreakdown: { label: string; feeUsd: number }[] = []

  let outputLabel = ''
  let outputToken = ''
  let outputAmount = source.tokenOut.amount
  let outputChain = source.tokenOut.chain

  for (const step of steps) {
    if (step.kind === 'bridge') {
      totalFeeUsd += step.feeUsd
      feeBreakdown.push({ label: 'Bridge fee', feeUsd: step.feeUsd })
      outputChain = step.toChain
      outputAmount = step.tokenOut.amount
    } else if (step.kind === 'swap') {
      totalFeeUsd += step.feeUsd
      feeBreakdown.push({ label: 'Swap fee', feeUsd: step.feeUsd })
      outputToken = step.tokenOut.token
      outputAmount = step.tokenOut.amount
    } else if (step.kind === 'deposit') {
      outputToken = step.destination.outputTokenSymbol
      outputLabel = step.destination.displayName
    } else if (step.kind === 'repay') {
      outputToken = 'debt repaid'
      outputLabel = 'Debt repaid'
    } else if (step.kind === 'repayAndWithdraw') {
      outputToken = step.tokenOut.token
      outputAmount = step.tokenOut.amount
      outputChain = step.tokenOut.chain
    } else if (step.kind === 'withdraw') {
      outputToken = step.tokenOut.token
      outputAmount = step.tokenOut.amount
    }
  }

  // Gas is not yet computed in builder — shown as "+ gas" placeholder
  const output = outputToken ? {
    token: outputToken,
    amount: outputAmount,
    chain: outputChain,
    label: outputLabel,
  } : null

  return { input, output, totalFeeUsd, feeBreakdown }
}
```

---

### Components

#### `components/sequenceBuilder/SequenceBuilderModal.tsx`

The outer modal shell. Replaces `SequenceModal` as the primary entry point.

**Props:**
```ts
interface SequenceBuilderModalProps {
  isOpen: boolean
  onClose: () => void
  /** Pre-seed with a source position (e.g. from a position card's "Sequence" button) */
  initialPositionId?: string
}
```

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Build a Sequence                                    [×]         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [SourceCard] → [ActionCard] → [DepositCard]                     │
│                                                                   │
│  [BridgeCard] → [ActionCard]                                     │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│  [SummaryBar]                          [Cancel]  [Execute →]     │
└─────────────────────────────────────────────────────────────────┘
```

The step area scrolls vertically if the chain grows past two rows. Cards wrap
at 4 per row on desktop, 3 on tablet, 2 on mobile using CSS grid with
`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` and `gap-3`.

Between each completed step and the next, render a right-arrow connector
`→` (`text-verdant-text-muted text-lg self-center mt-4`). At the end of
each row before wrapping, the arrow drops to the start of the next row.
Arrows are purely decorative — rendered as `<span>` between grid items.

The modal itself: `max-w-5xl w-full bg-verdant-surface rounded-2xl
shadow-organic-lg border border-[#E5E0D8] flex flex-col max-h-[90vh]`.
Header `border-b border-[#E5E0D8] px-6 py-4`. Step area
`flex-1 overflow-y-auto px-6 py-6`. Footer
`border-t border-[#E5E0D8] px-6 py-4`.

---

#### `components/sequenceBuilder/SourceCard.tsx`

The first card. The user selects what they are starting from.

**Two tabs inside the card:**
- **"My Positions"** — lists the user's current positions from `usePositions()`, filtered to `positionType === 'wallet' | 'supply'` (borrow positions are not starting points — those go to LoopModal). Each entry shows token, chain, USD value.
- **"Wallet Balance"** — same list filtered to `positionType === 'wallet'` only.

Actually there's no need for two tabs — just show all wallet and supply positions together, since that covers both examples from the spec. Group them with a subtle divider: "Protocol Positions" and "Wallet" as inline labels.

Each position row in the list:
```
[USDC icon]  USDC on Arbitrum (Aave)     $180,000
             4.2% APY · supply
```

Clicking a position row sets it as the source and appends an `action-select`
card.

The user also inputs an amount beneath the position selector:
```
Amount: [________] USDC    MAX
```
Amount defaults to the full position size. The `MAX` button fills it.

**Card dimensions:** `w-56 min-h-48` — all step cards use this fixed width so
the grid is uniform. Content scrolls within the card if needed.

**Card style when active (being filled):**
`bg-verdant-surface border-2 border-verdant-moss rounded-xl p-4 shadow-organic`

**Card style when complete (locked in):**
`bg-verdant-surface-accent border border-[#D5E8E0] rounded-xl p-4`

**Card header:** small label `text-[10px] text-verdant-text-muted uppercase
tracking-wider font-semibold mb-2` reading `SOURCE`.

**Completed summary view:**
```
SOURCE
USDC · Arbitrum
Aave supply
$180,000
```
All values `font-mono`.

---

#### `components/sequenceBuilder/ActionSelectCard.tsx`

Appears after every transit step (and as the second card in any sequence).
Shows the valid actions for the current token state.

**Props:**
```ts
{ tokenIn: TokenState; userPositions: Position[]; onSelect: (action: ActionType) => void }
```

Calls `getEligibleActions(tokenIn, userPositions)` and renders each as a
selectable pill/button.

**Action display names and descriptions:**
| Action | Label | Description |
|---|---|---|
| `deposit` | Deposit | Earn yield in a protocol |
| `repay` | Repay | Pay down existing debt |
| `repayAndWithdraw` | Repay & Withdraw | Repay debt, free collateral |
| `bridge` | Bridge | Move to another chain |
| `swap` | Swap | Exchange for another token |
| `withdraw` | Withdraw | Exit protocol position |

Each option is a card-within-a-card:
```
┌──────────────────┐
│  Bridge          │  ← label in text-verdant-text-primary font-semibold
│  Move to another │  ← description in text-verdant-text-muted text-xs
│  chain           │
└──────────────────┘
```

Hover: `hover:border-verdant-moss hover:bg-verdant-surface-accent`.
The entire action option card is clickable.

Unavailable actions are not shown — the list is already filtered by
`getEligibleActions`.

**Card header label:** `ACTION`.

---

#### `components/sequenceBuilder/DepositCard.tsx`

Terminal step. Shows the available deposit destinations for the current
token/chain.

**Props:**
```ts
{ tokenIn: TokenState; onSelect: (dest: DepositDestination) => void }
```

Calls `getDepositDestinations(tokenIn.token, tokenIn.chain)` and renders
each destination as a selectable row:

```
┌─────────────────────────────────────────────────┐
│  Morpho — Gauntlet USDC          6.8% APY  [●]  │
│  Morpho — Steakhouse USDC        6.5% APY       │
│  Aave V3 — USDC                  4.2% APY       │
│  Euler V2 — USDC                 5.9% APY       │
└─────────────────────────────────────────────────┘
```

APY in `text-verdant-profit font-mono font-semibold`. Protocol name in
`text-verdant-text-primary text-sm`. Selected row gets
`bg-verdant-surface-accent border-l-2 border-verdant-moss`.

If no destinations match: `text-verdant-text-muted text-sm text-center py-4`
reading "No supported destinations for [TOKEN] on [CHAIN]."

**Completed summary view:**
```
DEPOSIT
Morpho Gauntlet USDC
Arbitrum · 6.8% APY
→ gauntletUSDC
```

**Card header label:** `DEPOSIT`.

---

#### `components/sequenceBuilder/RepayCard.tsx`

Terminal step. Shows the user's existing borrow positions that match
the current token and chain.

**Props:**
```ts
{ tokenIn: TokenState; userPositions: Position[]; onSelect: (positionId: string) => void }
```

Filters `userPositions` where `positionType === 'borrow'` and
`chain === tokenIn.chain` and `asset === tokenIn.token`.

Each borrow position row:
```
Aave V3 — USDC debt
Ethereum · $42,000 owed
5.1% borrow APY
```

Amount owed in `text-verdant-loss font-mono`. If no matching borrows:
`"No matching debt positions on [CHAIN]."` in `text-verdant-text-muted`.

**Card header label:** `REPAY`.

---

#### `components/sequenceBuilder/RepayAndWithdrawCard.tsx`

Transit step. Same borrow position selector as RepayCard, but after
selecting, the card also shows the collateral that will be freed:

```
REPAY & WITHDRAW
Aave USDC debt · $42,000
→ Frees: 0.8 WETH (~$1,920)
```

The collateral information comes from the matched borrow position's
corresponding supply position (find the supply on the same protocol/chain —
same logic as `BorrowCard.tsx` already does). If no collateral position
is found, show: `"Collateral position not found — proceed manually."`

On selection, calls `onSelect(positionId)` and emits `tokenOut` as the
freed collateral token state.

**Card header label:** `REPAY & WITHDRAW`.

---

#### `components/sequenceBuilder/BridgeCard.tsx`

Transit step. User selects destination chain and bridge.

**Layout:**
```
BRIDGE
To chain:  [Arbitrum ▾]
Via:       [Across — $1.20, ~45s      ]
           [LayerZero CCTP — $0.80, ~2m]
```

Chain selector: dropdown of `ALL_CHAINS` excluding the current chain.

Bridge options: in demo mode, show static fixture bridge quotes
(match the format of `DEMO_COST_RESULT.steps`). In real mode, these
would be live quotes. For the design, show 2-3 options per destination:

```ts
// lib/sequenceBuilder/fixtures.ts
export const DEMO_BRIDGE_QUOTES: Record<string, { bridgeId: BridgeId; label: string; feeUsd: number; timeSeconds: number }[]> = {
  'arbitrum': [
    { bridgeId: 'across',    label: 'Across V3',       feeUsd: 1.20, timeSeconds: 45 },
    { bridgeId: 'layerzero', label: 'LayerZero CCTP',  feeUsd: 0.80, timeSeconds: 120 },
  ],
  'base': [
    { bridgeId: 'across',    label: 'Across V3',       feeUsd: 0.90, timeSeconds: 30 },
    { bridgeId: 'chainlink', label: 'Chainlink CCIP',  feeUsd: 1.50, timeSeconds: 900 },
  ],
  'ethereum': [
    { bridgeId: 'across',    label: 'Across V3',       feeUsd: 3.40, timeSeconds: 120 },
    { bridgeId: 'layerzero', label: 'LayerZero CCTP',  feeUsd: 2.90, timeSeconds: 180 },
  ],
}
```

Bridge row display: name in `text-verdant-text-primary text-sm`, fee in
`text-verdant-text-primary font-mono`, time in `text-verdant-text-muted text-xs`.
Selected row: `bg-verdant-surface-accent border-l-2 border-verdant-moss`.

On selection of both chain and bridge, emits the completed bridge step with
`tokenOut` = same token, new chain, amount adjusted for bridge fees.

**Completed summary:**
```
BRIDGE
Ethereum → Arbitrum
Across V3 · $1.20
~45s
```

**Card header label:** `BRIDGE`.

---

#### `components/sequenceBuilder/SwapCard.tsx`

Transit step. User selects destination token.

**Layout:**
```
SWAP
From:  USDC (current, locked)
To:    [WETH         ▾]
Via:   1inch
Fee:   ~$0.40 (0.04%)
```

The "To" token selector shows all tokens in `SUPPORTED_TOKENS` that are
available on the current chain, excluding the current token. Selecting a
token shows a stub swap quote (demo mode: 0.04% fee of the USD value,
capped at $5 for small amounts).

```ts
// Demo swap fee stub
function estimateDemoSwapFee(amountUsd: number): number {
  return Math.min(amountUsd * 0.0004, 20)
}
```

On token selection, emits `tokenOut` = new token, same chain, amount
adjusted by swap fee.

**Completed summary:**
```
SWAP
USDC → WETH
1inch · $0.40
```

**Card header label:** `SWAP`.

---

#### `components/sequenceBuilder/WithdrawCard.tsx`

Transit step. The source position was already selected in `SourceCard` (or
is the collateral from `RepayAndWithdrawCard`). This card just confirms
what is being withdrawn.

When triggered as the first action from a supply position, it shows:
```
WITHDRAW
Aave USDC · Ethereum
$180,000 → 180,000 USDC
```

No further user input needed — clicking "Confirm Withdraw" locks it in
and appends the next `action-select` card.

**Card header label:** `WITHDRAW`.

---

#### `components/sequenceBuilder/SummaryBar.tsx`

Fixed at the bottom of the modal, above the footer buttons. Updates live
as each step is completed.

```
−1,000 USDC (Ethereum)  →  +998.1 gauntletUSDC (Arbitrum)
Est. fees: $3.30   (Bridge $1.20 · Swap $0.80 · Gas ~$1.30)
```

Left side: token delta. Right side: fee breakdown.

Token amounts in `font-mono`. Negative value (`−1,000 USDC`) in
`text-verdant-text-primary` (neutral — it's not a loss, it's a movement).
Positive output (`+998.1 gauntletUSDC`) in `text-verdant-profit font-mono`.

Fee total in `text-verdant-text-primary font-mono font-semibold`. Fee
breakdown items in `text-verdant-text-muted text-sm`.

If the sequence is not yet complete (no terminal step), show:
`"Complete your sequence to see the full summary."` in
`text-verdant-text-muted text-sm italic`.

Gas is shown as `~$X` (estimated, not exact) when the sequence is complete.
In demo mode use a flat `$1.30` per non-bridge step.

**Footer buttons:**

Left: `Cancel` — `text-verdant-text-muted hover:text-verdant-loss text-sm
transition-colors` — calls `onClose()` without navigating.

Right: `Execute Sequence →` — primary moss button, `disabled` and
`opacity-50` until `canSubmit(steps) === true`.

---

### Entry points

**Dashboard header "Sequence" button** → opens `SequenceBuilderModal` with
no `initialPositionId`. User starts from the SourceCard picking any position.

**PositionCard "Sequence" button** → opens `SequenceBuilderModal` with
`initialPositionId` pre-set to that position's `id`. The SourceCard is
pre-filled and locked; the modal opens directly at the `ActionSelectCard`.

**BorrowCard** → does NOT open `SequenceBuilderModal`. It opens `LoopModal`
(see Part 2). The "De-leverage" button remains on `BorrowCard` and triggers
`LoopModal` in unloop mode.

The `useSequenceModal` hook gains a new method:
```ts
openBuilder: (opts?: { positionId?: string }) => void
```

---

## Part 2 — LoopModal

A dedicated modal for leveraged loop and deleverage (unloop) flows. Triggered
exclusively from `BorrowCard`. Has two tabs: **Deleverage** (unloop) and
**Leverage** (loop).

### Layout

```
┌─────────────────────────────────────────────────┐
│  Manage Position                      [×]        │
│  [Deleverage ●]  [Leverage]                      │
├─────────────────────────────────────────────────┤
│  [Tab content]                                   │
├─────────────────────────────────────────────────┤
│  [SummaryPanel]                                  │
│                        [Cancel]  [Execute →]     │
└─────────────────────────────────────────────────┘
```

Modal: `max-w-xl w-full`. Smaller than the builder — this flow is linear,
not compositional.

**Props:**
```ts
interface LoopModalProps {
  isOpen: boolean
  onClose: () => void
  position: Position           // the borrow position from BorrowCard
  collateralPosition?: Position // matched supply position
}
```

---

### Deleverage tab

Pre-filled from the borrow position. Shows the current state and lets the
user confirm or adjust cycles.

```
Position
  Debt:        42,000 USDC    (5.1% APY)
  Collateral:  18.2 WETH      ($43,600)
  Health Factor: 1.82

Unwind Settings
  Cycles:  [3 ▾]   (auto-computed, adjustable)
  Est. gas: ~$8.40 (3 × $2.80)

After unwind
  Freed: ~17.8 WETH  (~$42,720)
  Remaining debt: $0
  Net gain vs. instant: +$120 (fewer liquidation risk events)
```

Cycles selector: a simple `<select>` with options 1–10, defaulting to
`computeOptimalCycles(totalDebtUsd, totalCollateralUsd, lt)` — same as the
current `BorrowCard` logic.

The "After unwind" panel is a `SummaryPanel` styled like `SummaryBar`:
`bg-verdant-surface-accent border border-[#D5E8E0] rounded-lg p-4`.

**Execute button:** `Execute Deleverage →` — primary moss. On click, creates
a plan using the existing `deleverageAave` template (same as before, routed
through `useSequencer.createPlan`), then navigates to `/sequence/[planId]`.

---

### Leverage tab

Kept simple for now per spec. User specifies target leverage multiplier.

```
Position
  Collateral:  18.2 WETH   ($43,600)
  Protocol:    Aave V3 · Ethereum

Leverage Settings
  Target multiplier:  [2.0×  ▾]   (1.5× / 2× / 2.5× / 3×)
  Borrow asset:       [USDC  ▾]

After leverage
  New collateral:  ~$87,200
  New debt:        ~$43,600 USDC
  Est. health factor: ~1.85
  Est. gas:        ~$5.60
```

The "After leverage" numbers are estimates from simple arithmetic:
- New collateral = current collateral × multiplier
- New debt = new collateral − current collateral
- Health factor estimate = (new collateral × 0.82) / new debt
  (0.82 = conservative LTV)

**Execute button:** `Execute Leverage →` — primary moss. In demo mode this
is wired to a stub that creates a plan using `crossChainRebalance` as a
placeholder (the real loop template is future work). In real mode it will
use a future `leverageAave` template.

The tab is clearly marked with a `Badge` variant `warning`:
`"Leverage increases liquidation risk"` — shown inline below the tab header,
not as an alert that blocks interaction.

---

### Connecting `BorrowCard` to `LoopModal`

`BorrowCard` currently calls `onSequence('deleverageAave', params)` or
`router.push('/sequence?...')`. Change this so the "De-leverage" button
opens `LoopModal` directly:

```ts
// BorrowCard.tsx — new prop
interface BorrowCardProps {
  position: Position
  onSequence?: (template: TemplateId, params: Record<string, string>) => void
  onOpenLoopModal?: (position: Position, collateralPosition?: Position) => void
}
```

In `handleDeleverage`, call `onOpenLoopModal(position, collateralPosition)`
if provided, else fall back to the existing `onSequence` path.

`app/dashboard/page.tsx` manages both modals:
```ts
const { isBuilderOpen, builderPositionId, openBuilder, closeBuilder } = useSequenceBuilderModal()
const { isLoopOpen, loopPosition, loopCollateral, openLoop, closeLoop } = useLoopModal()
```

Both modals are mounted at the dashboard level. `PositionList` receives
`onOpenBuilder` and `onOpenLoop` callbacks and threads them to the cards.

---

## New files summary

```
lib/sequenceBuilder/types.ts          — BuilderStep, TokenState, ActionType, DepositDestination
lib/sequenceBuilder/logic.ts          — getEligibleActions, canSubmit, canAddMore, computeTokenDelta
lib/sequenceBuilder/destinations.ts   — DEPOSIT_DESTINATIONS, getDepositDestinations
lib/sequenceBuilder/fixtures.ts       — DEMO_BRIDGE_QUOTES, estimateDemoSwapFee

hooks/useSequenceBuilderModal.ts      — isOpen, open(opts?), close, builderPositionId
hooks/useLoopModal.ts                 — isOpen, open(position, collateral?), close

components/sequenceBuilder/SequenceBuilderModal.tsx
components/sequenceBuilder/SourceCard.tsx
components/sequenceBuilder/ActionSelectCard.tsx
components/sequenceBuilder/DepositCard.tsx
components/sequenceBuilder/RepayCard.tsx
components/sequenceBuilder/RepayAndWithdrawCard.tsx
components/sequenceBuilder/BridgeCard.tsx
components/sequenceBuilder/SwapCard.tsx
components/sequenceBuilder/WithdrawCard.tsx
components/sequenceBuilder/SummaryBar.tsx

components/loop/LoopModal.tsx
```

---

## Files modified

```
components/positions/BorrowCard.tsx        — add onOpenLoopModal prop
components/positions/PositionCard.tsx      — add onOpenBuilder prop, thread to non-borrow cards
components/positions/PositionList.tsx      — thread onOpenBuilder and onOpenLoop callbacks
app/dashboard/page.tsx                     — mount both modals, manage both modal states
hooks/useSequenceModal.ts                  — add openBuilder method (or replace with useSequenceBuilderModal)
```

`SequenceModal.tsx` is NOT deleted — kept as fallback for the full-page
`app/sequence/page.tsx` route.

---

## What is explicitly not built

- No real swap quote fetching (1inch integration is future work) — use the stub fee
- No live APY fetching for `DEPOSIT_DESTINATIONS` — static registry only
- No real bridge quote fetching in the builder — use `DEMO_BRIDGE_QUOTES` fixtures
- No `buildTx` wiring for any builder-composed sequence — the "Execute" button
  creates a plan using the closest matching existing template where one exists
  (deposit → `bridgeAndDeposit`, repay → `repayAndWithdraw`), or is a no-op stub
  in demo mode for sequences without a template equivalent
- No Solana positions as starting points in the builder — EVM only for now
- No loop template (`leverageAave`) — Leverage tab stubs to a placeholder plan

---

## Acceptance checklist

- [ ] `DEPOSIT_DESTINATIONS` covers Ethereum, Arbitrum, Base for USDC and WETH
- [ ] `getEligibleActions` returns only `withdraw` for supply positions
- [ ] `getEligibleActions` excludes repay/repayAndWithdraw when no matching borrow exists
- [ ] `canSubmit` returns false until a terminal step is added
- [ ] Builder modal opens from dashboard header button (no pre-fill)
- [ ] Builder modal opens from PositionCard with source pre-filled
- [ ] SourceCard groups wallet and supply positions, excludes borrow positions
- [ ] Completed step cards render in compact summary view
- [ ] Cards wrap at 4/3/2 per row on desktop/tablet/mobile
- [ ] Arrow connectors render between cards
- [ ] SummaryBar updates on each completed step
- [ ] SummaryBar shows fee breakdown with bridge, swap, gas as line items
- [ ] Execute button disabled until `canSubmit === true`
- [ ] BorrowCard opens LoopModal, not SequenceBuilderModal
- [ ] LoopModal Deleverage tab pre-fills from borrow position
- [ ] LoopModal cycles selector defaults to `computeOptimalCycles` result
- [ ] LoopModal Leverage tab shows "increases liquidation risk" warning badge
- [ ] No `<form>` tags
- [ ] No `as any`
- [ ] All monetary values in `font-mono`
- [ ] Design tokens used throughout — no `zinc`, `emerald`, or raw hex colours