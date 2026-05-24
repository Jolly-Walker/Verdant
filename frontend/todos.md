# Verdant — Sequence Builder Wiring Tickets

Branch: `demo`

These tickets complete the execution path for custom sequences built in
`SequenceBuilderModal`, and add the swap infrastructure needed to make the
Swap step work end-to-end. Execute in order — each ticket depends on the
previous.

---

## WIRE-01 — Fix demo sequencer custom plan path

**Problem:** In `useDemoSequencer`, the `custom` template path calls
`fetchWithTimeout('/api/sequencer/plan', ...)` — a real network call. In
demo mode there is no live Supabase, so the plan either fails to persist or
returns a plan that cannot be fetched by the execution page. All other
non-custom template paths in demo mode bypass the network entirely.

**File:** `frontend/hooks/useDemoSequencer.ts`

Replace the entire `if (templateId === 'custom')` block inside `createPlan`:

```ts
if (templateId === 'custom') {
  await delay(600)
  const customPlan = (params as { customPlan: SequencePlan }).customPlan
  const newPlan: SequencePlan = {
    ...customPlan,
    id: crypto.randomUUID(),
    walletAddress: DEMO_WALLET_ADDRESS,
    createdAt: new Date(),
    status: 'draft',
  }
  setPlan(newPlan)
  return newPlan
}
```

Add the `SequencePlan` import if not already present.

**Acceptance:**
- [ ] Opening `SequenceBuilderModal` in demo mode, completing a sequence, and
      clicking "Execute Sequence →" navigates to `/sequence/[planId]`
- [ ] The plan execution page loads with the correct steps from the builder
- [ ] No network request to `/api/sequencer/plan` is made in demo mode for
      custom plans (verify in browser Network tab)
- [ ] The existing non-custom path (fixture plan) is unaffected

---

## WIRE-02 — Persist custom plans through the API route correctly

**Problem:** In the API route `POST /api/sequencer/plan`, the `custom` branch
constructs `plan` in-memory but skips the minimum size validation that all
other templates run. It then falls through to `createSequencePlan(plan,
templateId)` at line 229, which persists it — so persistence works. But the
custom plan object passed in has already had its `id` set by
`builderStepsToSequencePlan` on the client. `createSequencePlan` inserts it
into Supabase and the DB assigns a new UUID, then returns the DB-assigned ID.
The client receives the correct ID. This flow is actually correct.

However, the custom plan's `steps` array uses `buildParams` typed as
`TxBuildParams | BridgeQuoteParams`. When Supabase serialises this via
`serializeSequenceStep`, it JSON-stringifies `bigint` values. Custom plans
have no `unsignedTx` yet so there are no `bigint` values to serialize at plan
creation time — this is fine.

**The one real issue:** `createdAt: new Date()` is set both by the client in
`builderStepsToSequencePlan` and overwritten in the route. The route's
overwrite is correct — use the server timestamp. No code change needed here.

**What does need fixing:** `z.any()` is used for `customPlan` in
`CreatePlanSchema`. This bypasses all validation. Add a minimal Zod shape:

**File:** `frontend/app/api/sequencer/plan/route.ts`

Replace:
```ts
customPlan: z.any().optional(),
```

With:
```ts
customPlan: z.object({
  steps: z.array(z.object({
    id: z.string(),
    label: z.string(),
    chain: z.enum(ALL_CHAINS),
    pluginId: z.string(),
    dependsOn: z.array(z.string()),
    status: z.enum(['pending', 'simulating', 'ready', 'signing', 'confirmed', 'failed']),
    buildParams: z.record(z.string(), z.unknown()),
  })),
  description: z.string(),
  positionSizeUsd: z.number().optional(),
  totalCostUsd: z.number().optional(),
}).optional(),
```

Import `ALL_CHAINS` from `@/types/shared` if not already imported.

**Acceptance:**
- [ ] `POST /api/sequencer/plan` with `templateId: 'custom'` and a valid
      `customPlan` returns 200 with a persisted plan
- [ ] `POST /api/sequencer/plan` with `templateId: 'custom'` and a malformed
      `customPlan` (missing `steps`) returns 400
- [ ] Existing template paths are unaffected

---

## WIRE-03 — Handle unknown `pluginId` gracefully in simulate route

**Problem:** The simulate route at `POST /api/sequencer/simulate` checks if
`step.pluginId` is in `PROTOCOL_REGISTRY` or `BRIDGE_REGISTRY`. If it is in
neither (e.g. `'1inch'` for swap steps, or any future plugin not yet
registered), it falls through to:

```ts
return NextResponse.json({ error: 'Step has no transaction to simulate and failed to build one' }, { status: 400 })
```

This is the right failure mode for swap steps today — 1inch is not yet
implemented. But the error message is confusing. Change it to be explicit:

**File:** `frontend/app/api/sequencer/simulate/route.ts`

After the two plugin lookup blocks and before the stub-data check, replace the
generic error:

```ts
if (!step.unsignedTx) {
  // Check if plugin is known but has no tx built
  const isKnownProtocol = !!PROTOCOL_REGISTRY[step.pluginId as keyof typeof PROTOCOL_REGISTRY]
  const isKnownBridge = !!BRIDGE_REGISTRY[step.pluginId as keyof typeof BRIDGE_REGISTRY]

  if (!isKnownProtocol && !isKnownBridge) {
    return NextResponse.json({
      error: `Plugin '${step.pluginId}' is not registered. This action type is not yet supported for on-chain execution.`
    }, { status: 400 })
  }

  return NextResponse.json({
    error: 'Step has no transaction to simulate and failed to build one'
  }, { status: 400 })
}
```

**Acceptance:**
- [ ] Simulating a swap step returns 400 with the message containing `'1inch'`
      and `'not registered'`
- [ ] Simulating a valid Aave deposit step is unaffected

---

## WIRE-04 — Add swap plugin interface and 1inch stub

**Problem:** Swap steps use `pluginId: '1inch'` but `'1inch'` is not in
`PROTOCOL_REGISTRY` or `BRIDGE_REGISTRY`. When the real simulate route is
called, WIRE-03 returns a clear error. But for swap to work end-to-end in
future, the plugin must exist. This ticket adds the stub — it will be wired
to a real 1inch API in a future milestone.

### Step 1 — Add swap plugin type

**File:** `frontend/lib/plugins/types/swap-plugin.ts` (new file)

```ts
import 'server-only'
import { ChainId, UnsignedTx } from '@/types/shared'

export interface SwapQuoteParams {
  fromChain: ChainId
  fromToken: string
  toToken: string
  amount: string        // in human units
  userAddress: string
  slippagePercent: number
}

export interface SwapQuote {
  aggregator: string
  fromToken: string
  toToken: string
  fromAmount: string
  toAmount: string      // expected output in human units
  feeUsd: number
  priceImpactPercent: number
  expiresAt: Date
  rawQuote: unknown
}

export interface SwapPlugin {
  id: string
  displayName: string
  supportedChains: ChainId[]
  getQuote(params: SwapQuoteParams): Promise<SwapQuote | null>
  buildSwapTx(quote: SwapQuote, userAddress: string): Promise<UnsignedTx>
}
```

### Step 2 — Add 1inch stub plugin

**File:** `frontend/lib/plugins/swaps/oneinch.ts` (new file)

```ts
import 'server-only'
import { SwapPlugin, SwapQuote, SwapQuoteParams } from '../types/swap-plugin'
import { UnsignedTx } from '@/types/shared'

export const oneinchPlugin: SwapPlugin = {
  id: '1inch',
  displayName: '1inch',
  supportedChains: ['ethereum', 'arbitrum', 'base'],

  async getQuote(params: SwapQuoteParams): Promise<SwapQuote | null> {
    // STUB: 1inch API integration not yet implemented
    // Real implementation will call https://api.1inch.dev/swap/v6.0/{chainId}/quote
    throw new Error('1inch swap quote not yet implemented')
  },

  async buildSwapTx(quote: SwapQuote, userAddress: string): Promise<UnsignedTx> {
    // STUB: 1inch API integration not yet implemented
    // Real implementation will call https://api.1inch.dev/swap/v6.0/{chainId}/swap
    throw new Error('1inch swap tx build not yet implemented')
  }
}
```

### Step 3 — Add swap registry

**File:** `frontend/lib/plugins/swaps/index.ts` (new file)

```ts
import { SwapPlugin } from '../types/swap-plugin'
import { oneinchPlugin } from './oneinch'

export const SWAP_REGISTRY: Record<string, SwapPlugin> = {
  '1inch': oneinchPlugin,
}
```

### Step 4 — Wire swap registry into simulate route

**File:** `frontend/app/api/sequencer/simulate/route.ts`

Add import:
```ts
import { SWAP_REGISTRY } from '@/lib/plugins/swaps'
```

Add swap handling block after the bridge block, before the "plugin not found"
error check:

```ts
} else if (SWAP_REGISTRY[step.pluginId]) {
  // Swap plugin found — not yet implemented, return clear error
  return NextResponse.json({
    error: `Swap via '${step.pluginId}' is not yet available for on-chain execution. This feature is coming soon.`
  }, { status: 400 })
}
```

When 1inch is implemented, this block will call `plugin.getQuote()` and
`plugin.buildSwapTx()` instead of returning the error.

### Step 5 — Add `'swap'` to `TxBuildParams.action`

**File:** `frontend/types/shared.ts`

```ts
export interface TxBuildParams {
  action: 'supply' | 'withdraw' | 'borrow' | 'repay' | 'stake' | 'unstake' | 'claim' | 'swap'
  // ...rest unchanged
}
```

This removes the TypeScript error on the swap step's `buildParams` in
`builderStepsToSequencePlan`.

**Acceptance:**
- [ ] `SWAP_REGISTRY` exports `oneinchPlugin` under key `'1inch'`
- [ ] Simulating a swap step returns 400 with `'coming soon'` message (not
      `'not registered'`)
- [ ] `TxBuildParams.action` accepts `'swap'` without TypeScript error
- [ ] `server-only` is the first import in `oneinch.ts` and `index.ts`
- [ ] No `as any` introduced

---

## WIRE-05 — Validate `buildParams` completeness before simulate

**Problem:** `builderStepsToSequencePlan` populates `buildParams` for each
step, but some steps may have incomplete data if the builder's state machine
allowed a submit before all fields were filled (e.g. a `bridge` step where
`toChain` is empty string). The simulate route calls `plugin.builder.buildTx`
with whatever is in `buildParams` — a malformed call will either throw
uncaught or produce a garbage tx.

Add a validation pass in the simulate route before attempting to build the tx.

**File:** `frontend/app/api/sequencer/simulate/route.ts`

Add a helper and call it before the plugin lookup:

```ts
function validateBuildParams(pluginId: string, buildParams: Record<string, unknown>): string | null {
  // Protocol steps
  if (['aave', 'morpho', 'euler'].includes(pluginId)) {
    if (!buildParams.action) return 'Missing action in buildParams'
    if (!buildParams.chain) return 'Missing chain in buildParams'
    if (!buildParams.asset) return 'Missing asset in buildParams'
    if (!buildParams.amount || buildParams.amount === '0') return 'Missing or zero amount in buildParams'
    if (!buildParams.userAddress) return 'Missing userAddress in buildParams'
  }
  // Bridge steps
  if (['across', 'layerzero', 'nearIntents', 'chainlink'].includes(pluginId)) {
    if (!buildParams.fromChain) return 'Missing fromChain in buildParams'
    if (!buildParams.toChain) return 'Missing toChain in buildParams'
    if (!buildParams.token) return 'Missing token in buildParams'
    if (!buildParams.amount || buildParams.amount === '0') return 'Missing or zero amount in buildParams'
    if (!buildParams.recipientAddress) return 'Missing recipientAddress in buildParams'
  }
  // Swap steps
  if (pluginId === '1inch') {
    if (!buildParams.extraParams) return 'Missing extraParams for swap'
    const ep = buildParams.extraParams as Record<string, unknown>
    if (!ep.toToken) return 'Missing toToken in swap extraParams'
  }
  return null
}
```

Call it after the step lookup:
```ts
const paramsError = validateBuildParams(step.pluginId, step.buildParams as Record<string, unknown>)
if (paramsError) {
  return NextResponse.json({ error: `Invalid step configuration: ${paramsError}` }, { status: 400 })
}
```

**Acceptance:**
- [ ] Simulating a step with `amount: '0'` returns 400 with a clear message
- [ ] Simulating a bridge step with missing `toChain` returns 400
- [ ] Valid steps are unaffected

---

## WIRE-06 — Thread `repayAndWithdraw` through simulate route

**Problem:** `repayAndWithdraw` steps in the builder produce a single
`SequenceStep` with `action: 'repay'` and `extraParams.collateralAsset` /
`extraParams.collateralAmount`. The Aave plugin's `buildTx` handles `repay`
and produces the repay tx. But the "withdraw collateral" part has no
corresponding `SequenceStep` — the builder collapses both into one step.

This is a known design gap. The options are:

**Option A (current behaviour, acceptable for demo):** The `repayAndWithdraw`
builder step maps to a single repay tx. After signing, the collateral remains
locked until the user manually withdraws in a separate sequence. This is
technically incorrect but safe.

**Option B (correct behaviour):** `builderStepsToSequencePlan` emits *two*
`SequenceStep` entries for a `repayAndWithdraw` builder step: one `repay` step
and one `withdraw` step that depends on the repay.

Implement Option B.

**File:** `frontend/lib/sequenceBuilder/logic.ts`, inside
`builderStepsToSequencePlan`, the `repayAndWithdraw` case:

Replace the single `sequenceSteps.push(...)` call with two pushes:

```ts
case 'repayAndWithdraw': {
  const borrowPos = positions.find(p => p.id === step.targetPositionId)
  const protocol = borrowPos?.protocol || 'aave'
  const potentialCollaterals = positions.filter(
    p => p.chain === step.tokenIn.chain &&
         p.protocol === protocol &&
         p.positionType === 'supply'
  )
  const collateralPos = potentialCollaterals.length > 0
    ? [...potentialCollaterals].sort((a, b) => b.amountUsd - a.amountUsd)[0]
    : undefined

  const repayStepId = `repay-${idx}`
  const withdrawStepId = `withdraw-${idx}`

  // Step 1: Repay
  sequenceSteps.push({
    id: repayStepId,
    label: `Repay ${step.tokenIn.token} debt on ${step.tokenIn.chain}`,
    chain: step.tokenIn.chain,
    pluginId: protocol,
    dependsOn,
    status: 'pending',
    buildParams: {
      action: 'repay',
      protocol,
      chain: step.tokenIn.chain,
      asset: step.tokenIn.token,
      amount: step.tokenIn.amount.toString(),
      userAddress: walletAddress,
    } as unknown as TxBuildParams | BridgeQuoteParams
  })

  // Step 2: Withdraw collateral (depends on repay)
  sequenceSteps.push({
    id: withdrawStepId,
    label: `Withdraw ${collateralPos?.asset || 'collateral'} from ${protocol} on ${step.tokenIn.chain}`,
    chain: step.tokenIn.chain,
    pluginId: protocol,
    dependsOn: [repayStepId],
    status: 'pending',
    buildParams: {
      action: 'withdraw',
      protocol,
      chain: step.tokenIn.chain,
      asset: collateralPos?.asset || 'WETH',
      amount: collateralPos?.amount.toString() || 'max',
      userAddress: walletAddress,
    } as unknown as TxBuildParams | BridgeQuoteParams
  })

  previousStepId = withdrawStepId
  break
}
```

Note: `previousStepId = withdrawStepId` instead of `repayStepId` so that
any subsequent step (if the user added more after `repayAndWithdraw`) depends
on the withdraw completing, not just the repay.

Update the `description` computation at the end of the function — the
`activeStepKinds` filter already skips `source` and `action-select`, so
`repayAndWithdraw` will appear once. That's fine; the description is
informational only.

Also update the test in `logic.test.ts` for `repayAndWithdraw` sequences to
assert two emitted steps instead of one.

**Acceptance:**
- [ ] A `repayAndWithdraw` builder step produces two `SequenceStep` entries:
      `repay-{idx}` and `withdraw-{idx}`
- [ ] `withdraw-{idx}` has `dependsOn: ['repay-{idx}']`
- [ ] Any step after `repayAndWithdraw` depends on `withdraw-{idx}`
- [ ] Logic test for `repayAndWithdraw` updated and passing
- [ ] `computeTokenDelta` in `logic.ts` is unaffected (it reads `BuilderStep[]`,
      not `SequenceStep[]`)

---

## WIRE-07 — End-to-end demo smoke test checklist

This is not a code ticket — it is a manual verification checklist to run
after WIRE-01 through WIRE-06 are complete. Run it with
`NEXT_PUBLIC_DEMO_MODE=true`.

**Flow A — Wallet deposit (Example 1 from spec):**
1. Open dashboard. Confirm 7 fixture positions load.
2. Click "Sequence" in the header. `SequenceBuilderModal` opens with blank
   `SourceCard`.
3. Select the "ETH (wallet, Ethereum)" position. Amount defaults to full
   balance. `ActionSelectCard` appears.
4. Select "Deposit". `DepositCard` appears. Confirms destinations for ETH on
   Ethereum are shown (Aave WETH, Morpho Re7 WETH, Euler WETH).
5. Select "Aave V3 — WETH". `SummaryBar` updates: `−22 ETH (ethereum) →
   +22 aWETH (ethereum)`. Fees: `Gas ~$1.30`.
6. Click "Execute Sequence →". Modal closes, navigates to
   `/sequence/[planId]`.
7. Plan page loads with 1 step: "Deposit WETH into Aave V3 — WETH".
8. Click "Simulate". 1.4s delay. Step turns green. "Sign Transaction" appears.
9. Click "Sign Transaction". 0.8s delay. Step confirmed with `0xdemo...` hash.
10. `SequenceComplete` renders.

**Flow B — Cross-chain rebalance (Example 2 from spec):**
1. Click the "Sequence" button on the Aave USDC supply card (Arbitrum,
   $180,000). `SequenceBuilderModal` opens with source pre-filled and locked.
2. `ActionSelectCard` is the active card. Select "Bridge".
3. Select destination chain "Base". Select "Across V3 — $0.90". Next
   `ActionSelectCard` appears.
4. Select "Deposit". `DepositCard` shows Base USDC destinations.
5. Select "Morpho — Gauntlet USDC". `SummaryBar` updates.
6. Execute → navigate → simulate all steps → sign all steps → complete.

**Flow C — LoopModal deleverage:**
1. On dashboard, click "De-leverage" on the Aave USDC borrow card.
   `LoopModal` opens on Deleverage tab.
2. Cycles default to `computeOptimalCycles` result.
3. Click "Execute Deleverage →". Navigates to `/sequence/[planId]`.
4. Simulate and sign all cycles.

**Flow D — Swap step (should fail gracefully):**
1. Open builder. Select USDC wallet position. Select "Swap". Select WETH.
2. Execute. Navigate to `/sequence/[planId]`.
3. Simulate the swap step. Should return error: `"Swap via '1inch' is not yet
   available..."` rendered in the step card's error state.
4. Step shows failed state. User can see the reason. No crash.

---

## Architecture rules reminder

All new files must follow these invariants — do not regress:

- `server-only` must be the first import in `oneinch.ts`, `swaps/index.ts`,
  and any other server-side plugin or data file
- No `as any` — the `as unknown as TxBuildParams | BridgeQuoteParams` cast
  in `builderStepsToSequencePlan` is the one accepted exception, documented
  with a comment
- No `<form>` tags
- `SWAP_REGISTRY` must follow the same pattern as `PROTOCOL_REGISTRY` and
  `BRIDGE_REGISTRY` — named exports, never inline definitions
- Any new route handler must use `z.enum(ALL_CHAINS)` for chain params, not
  `z.string()`