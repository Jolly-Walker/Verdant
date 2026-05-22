# Verdant — Demo Sandbox

Branch: `demo` (branch from `m10` after it merges)

---

## What this is

A demo mode that runs the full Verdant UI flow — positions dashboard, sequence
modal, plan creation, simulate, sign — without touching any wallet, blockchain,
or external API. Everything is in-memory. No Supabase writes. No Alchemy calls.
No RPC. No bridge quotes. Fake tx hashes.

The goal is to let someone experience the complete product flow: see a realistic
portfolio, open the sequence modal, configure a cross-chain rebalance, step
through simulation and signing, and reach the completion screen.

---

## Entry point

`NEXT_PUBLIC_DEMO_MODE=true` in `.env.local`.

One env var. The whole app switches mode. No URL params to thread. No UI toggle
to build. If the var is set, demo mode is active from the moment the app loads.

When `NEXT_PUBLIC_DEMO_MODE=true`:
- The landing page shows a "Try Demo" button instead of (or alongside) the
  wallet connect buttons. Clicking it navigates directly to `/dashboard`.
- `useWallet` returns a hardcoded demo identity — no real wallet needed.
- `usePositions` returns fixture positions — no `/api/positions` call.
- The sequencer API routes (`/api/sequencer/*`) are intercepted client-side
  and return mock responses — no Supabase, no simulation, no RPC.

---

## Architecture: where the mock boundary sits

The mock boundary is entirely client-side. No API routes are modified. Instead,
the hooks that call those routes are replaced in demo mode with local
implementations that return realistic fixture data after a short artificial
delay (to preserve the loading state UX).

```
Real mode:                          Demo mode:
usePositions → /api/positions       usePositions → DEMO_POSITIONS fixture
useSequencer → /api/sequencer/*     useSequencer → in-memory demo sequencer
useSequenceCost → /api/sequencer/cost  useSequenceCost → fixture cost data
useBridges → /api/bridges/*         (not called — bridge step is mocked)
```

This means:
- Zero changes to any API route
- Zero changes to any component
- Zero changes to any type
- All mock logic lives in three new files + one modified hook entry point each

---

## Files to create

### 1. `lib/demo/positions.ts` — fixture positions

A static array of `Position[]` that represents a realistic whale portfolio.
Design for the demo flow: the user will bridge USDC from Arbitrum Aave supply
into Morpho on Base, so the fixtures must include a supply position that makes
that sequence sensible.

```
Portfolio composition (realistic for a $500K whale):

1. Aave V3 — USDC supply — Arbitrum — $180,000 — 4.2% APY
   (this is the position the demo sequence starts from)

2. Aave V3 — WETH supply — Ethereum — $95,000 — 1.8% APY

3. Aave V3 — USDC borrow — Ethereum — $42,000 — 5.1% APY
   health factor: 1.82, liquidation price: $1,420
   (triggers BorrowCard with De-leverage button)

4. Morpho — USDC supply — Base — $67,000 — 6.8% APY
   (the destination in the demo sequence)

5. Pendle PT-stETH — Ethereum — $38,000 — 8.3% fixed APY
   maturityDate: ~60 days from now (so it shows but doesn't trigger
   the <30d maturity warning)

6. Wallet — ETH — Ethereum — $22,000
   (plain wallet balance, no protocol)

7. Euler — USDC supply — Base — $31,000 — 5.9% APY
   small claimable reward: 12.4 EULER ≈ $87
```

Populate all required `Position` fields. Use plausible token amounts and
addresses. `assetAddress` can be the real USDC contract address on each chain
(these are static strings, not fetched).

Export a single constant:
```ts
export const DEMO_POSITIONS: Position[] = [...]
```

Also export summary helpers that `usePositions` needs:
```ts
export const DEMO_TOTAL_VALUE_USD = 475000
export const DEMO_TOTAL_REWARDS_USD = 87
```

---

### 2. `lib/demo/sequencer.ts` — in-memory demo sequencer

This file exports a function `createDemoSequencer()` that returns an object
with the same shape as `useSequencer()`'s return value, but backed entirely
by local state (passed in via React state setters, or self-contained with
`useState` if implemented as a hook).

Actually implement this as a hook: `useDemoSequencer()`, in
`hooks/useDemoSequencer.ts` (see below). This file contains only the fixture
plan data and mock helpers.

**Demo plan fixture:**

When `createPlan` is called with `templateId === 'crossChainRebalance'`
(or any template — the demo only shows one flow), return a pre-built
`SequencePlan` using the real template builder
(`buildCrossChainRebalancePlan`). This gives a real plan structure with real
step IDs, real dependency chains, and correct serialization — the only thing
mocked is the external I/O.

The plan params for the demo:
```ts
{
  asset: 'USDC',
  amount: '180000000000',   // 180,000 USDC in base units (6 decimals)
  fromProtocol: 'aave',
  fromChain: 'arbitrum',
  toProtocol: 'morpho',
  toChain: 'base',
  slippagePercent: 0.5,
  walletAddress: DEMO_WALLET_ADDRESS,
  amountUsd: 180000,
}
```

Export:
```ts
export const DEMO_WALLET_ADDRESS = '0xdemo0000000000000000000000000000000000001'

export function buildDemoPlan(walletAddress: string): SequencePlan {
  return buildCrossChainRebalancePlan({
    asset: 'USDC',
    amount: '180000000000',
    fromProtocol: 'aave',
    fromChain: 'arbitrum',
    toProtocol: 'morpho',
    toChain: 'base',
    slippagePercent: 0.5,
    walletAddress,
    amountUsd: 180000,
  })
}

export const DEMO_SIMULATION_RESULT: SimulationResult = {
  success: true,
  gasEstimate: BigInt(185000),
  gasCostUsd: 3.40,
  simulatedAt: new Date(),
  stateChanges: [
    {
      type: 'balance',
      token: 'USDC',
      address: DEMO_WALLET_ADDRESS,
      before: '180000000000',
      after: '0',
      decimals: 6,
    }
  ],
  warnings: [],
}

export const DEMO_COST_RESULT: CostPreviewResult = {
  steps: [
    {
      stepId: 'withdraw',
      stepLabel: 'Withdraw USDC from Aave',
      gasCostUsd: 3.40,
      bridgeFeeUsd: 0,
      slippageUsd: 0,
      totalCostUsd: 3.40,
    },
    {
      stepId: 'bridge',
      stepLabel: 'Bridge USDC via Across',
      gasCostUsd: 1.20,
      bridgeFeeUsd: 54.00,    // 0.03% of $180k
      slippageUsd: 9.00,      // 0.005%
      totalCostUsd: 64.20,
      quoteExpiresAt: new Date(Date.now() + BRIDGE_QUOTE_TTL_MS),
    },
    {
      stepId: 'deposit',
      stepLabel: 'Deposit USDC into Morpho',
      gasCostUsd: 2.80,
      bridgeFeeUsd: 0,
      slippageUsd: 0,
      totalCostUsd: 2.80,
    },
  ],
  totalCostUsd: 70.40,
  currentApyPercent: 4.2,
  targetApyPercent: 6.8,
  dailyYieldGainUsd: 12.82,   // ($180k × 2.6%) / 365
  breakEvenDays: 5.5,
  warnings: [],
}
```

---

### 3. `hooks/useDemoSequencer.ts` — demo version of useSequencer

Same return signature as `useSequencer`. All API calls replaced with
in-memory operations + artificial delays.

```ts
export function useDemoSequencer() {
  const [plan, setPlan] = useState<SequencePlan | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const planRef = useRef<SequencePlan | null>(null)
  planRef.current = plan

  const currentStep = useMemo(() => plan ? getActiveStep(plan) : null, [plan])

  const createPlan = useCallback(async (_templateId: TemplateId, _params: TemplateParams) => {
    // Ignore the actual params — always build the demo plan
    await delay(600)
    const newPlan = buildDemoPlan(DEMO_WALLET_ADDRESS)
    setPlan(newPlan)
    return newPlan
  }, [])

  const simulateStep = useCallback(async (stepId: string): Promise<SimulationResult> => {
    const currentPlan = planRef.current
    if (!currentPlan) throw new Error('No active plan')

    setIsSimulating(true)
    setPlan(prev => prev ? {
      ...prev,
      steps: prev.steps.map(s => s.id === stepId ? { ...s, status: 'simulating' } : s)
    } : null)

    await delay(1400)  // feel like a real simulation

    const updatedSteps = currentPlan.steps.map(s =>
      s.id === stepId
        ? { ...s, status: 'ready' as const, simulation: DEMO_SIMULATION_RESULT }
        : s
    )

    setPlan(prev => prev ? { ...prev, steps: updatedSteps } : null)
    setIsSimulating(false)
    return DEMO_SIMULATION_RESULT
  }, [])

  const executeStep = useCallback(async (stepId: string): Promise<string> => {
    const currentPlan = planRef.current
    if (!currentPlan) throw new Error('No active plan')

    const step = currentPlan.steps.find(s => s.id === stepId)
    if (!step || step.status !== 'ready') throw new Error('Step not ready')

    // Signing state
    setPlan(prev => prev ? {
      ...prev,
      steps: prev.steps.map(s => s.id === stepId ? { ...s, status: 'signing' } : s)
    } : null)

    await delay(800)  // fake wallet confirmation delay

    const fakeTxHash = `0xdemo${stepId.replace(/-/g, '')}${Date.now().toString(16)}`

    setPlan(prev => prev ? {
      ...prev,
      steps: prev.steps.map(s =>
        s.id === stepId ? { ...s, status: 'confirmed', txHash: fakeTxHash } : s
      )
    } : null)

    return fakeTxHash
  }, [])

  const signStep = useCallback(async (stepId: string, txHash: string): Promise<void> => {
    setPlan(prev => prev ? {
      ...prev,
      steps: prev.steps.map(s => s.id === stepId ? { ...s, status: 'confirmed', txHash } : s)
    } : null)
  }, [])

  const reset = useCallback(() => setPlan(null), [])

  const stableSetPlan = useCallback((newPlan: SequencePlan | SerializedSequencePlan | null) => {
    if (!newPlan) {
      setPlan(null)
    } else if ('createdAt' in newPlan && typeof newPlan.createdAt === 'string') {
      setPlan(deserializeSequencePlan(newPlan as SerializedSequencePlan))
    } else {
      setPlan(newPlan as SequencePlan)
    }
  }, [])

  return { plan, currentStep, isSimulating, createPlan, simulateStep, executeStep, signStep, reset, setPlan: stableSetPlan }
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

---

### 4. `hooks/useDemoPositions.ts` — demo version of usePositions

Same return signature as `usePositions`.

```ts
export function useDemoPositions() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate a fetch delay so loading skeletons are visible
    const t = setTimeout(() => setIsLoading(false), 900)
    return () => clearTimeout(t)
  }, [])

  return {
    positions: isLoading ? [] : DEMO_POSITIONS,
    isLoading,
    error: null,
    refetch: () => {},
    totalValueUsd: DEMO_TOTAL_VALUE_USD,
    totalRewardsUsd: DEMO_TOTAL_REWARDS_USD,
  }
}
```

---

### 5. `hooks/useDemoSequenceCost.ts` — demo version of useSequenceCost

Same return signature as `useSequenceCost`.

```ts
export function useDemoSequenceCost(_input: { plan: SequencePlan | null; walletAddress?: string }) {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 700)
    return () => clearTimeout(t)
  }, [])

  return {
    result: isLoading ? null : DEMO_COST_RESULT,
    isLoading,
    error: null,
    staleStepIds: new Set<string>(),
    expiredStepIds: new Set<string>(),
    hasExpiredQuotes: false,
    refetch: () => {},
  }
}
```

---

### 6. `lib/demo/wallet.ts` — demo wallet identity

```ts
export const DEMO_WALLET_ADDRESS = '0xdemo0000000000000000000000000000000000001' as `0x${string}`
export const DEMO_EVM_ADDRESS = DEMO_WALLET_ADDRESS
```

This is the address returned by `useWallet` in demo mode. It must match the
address used to build demo plans, so `plan.walletAddress === address` is always
true.

---

## Files to modify

### `hooks/useWallet.ts`

Add demo mode identity. When `NEXT_PUBLIC_DEMO_MODE === 'true'`, bypass the
wagmi and Solana wallet checks entirely:

```ts
const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// Inside the hook, before the existing return:
if (isDemo) {
  return {
    address: DEMO_WALLET_ADDRESS,
    evmAddress: DEMO_WALLET_ADDRESS,
    solanaAddress: undefined,
    isConnected: true,
    isEvmConnected: true,
    isSolanaConnected: false,
    isMounted: true,
    enableDebug: () => {},
    disconnect: () => { window.location.href = '/' },
  }
}
```

The existing debug mode (`localStorage.getItem('verdant_debug')`) stays
unchanged. Demo mode and debug mode are separate concepts: debug mode is a
developer tool for testing with a real spoof address; demo mode is a
sandboxed experience for showing the product.

---

### `hooks/usePositions.ts`

Add a demo mode branch at the top of the function:

```ts
const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
if (isDemo) return useDemoPositions()
```

Wait — React hooks cannot be called conditionally. The correct pattern is:

At the module level, export a wrapper:
```ts
export function usePositions() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useDemoPositions()
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useRealPositions()
}

function useRealPositions(): UsePositionsReturn {
  // ... existing implementation, renamed
}
```

This is safe because `process.env.NEXT_PUBLIC_DEMO_MODE` is a build-time
constant — it never changes between renders. The lint suppression is correct
and documented. Add a comment explaining this.

Apply the same pattern to `useSequencer.ts` and `useSequenceCost.ts`.

---

### `hooks/useSequencer.ts`

Same pattern as `usePositions`:

```ts
export function useSequencer() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useDemoSequencer()
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useRealSequencer()
}

function useRealSequencer() {
  // ... existing implementation, renamed
}
```

---

### `hooks/useSequenceCost.ts`

Same pattern:

```ts
export function useSequenceCost(input: { plan: SequencePlan | null; walletAddress?: string }) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useDemoSequenceCost(input)
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useRealSequenceCost(input)
}

function useRealSequenceCost(...) {
  // ... existing implementation, renamed
}
```

---

### `app/page.tsx` — landing page

When `NEXT_PUBLIC_DEMO_MODE === 'true'`, add a "Try Demo" button that
navigates to `/dashboard` without wallet connection:

```tsx
{process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && (
  <Link
    href="/dashboard"
    className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
  >
    Try Demo
  </Link>
)}
```

Place it above the `<ConnectButton />`. In demo mode, `useWallet` will return
`isConnected: true` immediately, so the `useEffect` redirect in `Home` will
fire and route to `/dashboard` anyway — the button just makes it explicit.

---

### `app/dashboard/page.tsx`

In demo mode, the redirect guard (`if (!isConnected) router.push('/')`) must
not fire, since `isConnected` is always true in demo mode. This already works
correctly because `useWallet` returns `isConnected: true` in demo mode — no
changes needed here.

Add a demo mode banner at the top of the dashboard (inside `<main>`, above
`PositionList`):

```tsx
{process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && (
  <div className="mb-6 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-400 flex items-center gap-2">
    <span className="text-emerald-400 font-semibold">Demo Mode</span>
    — Positions and transactions are simulated. No wallet connected, no real funds.
  </div>
)}
```

---

## What the demo flow looks like end-to-end

1. User visits `/` with `NEXT_PUBLIC_DEMO_MODE=true` set
2. Clicks "Try Demo" → routed to `/dashboard`
3. Dashboard loads with a 900ms fake fetch, then shows the 7-position fixture
4. Demo banner is visible at the top
5. User sees the $180K Aave USDC supply on Arbitrum — clicks "Sequence"
   button on that card → opens `SequenceModal` with `crossChainRebalance`
   pre-selected and params pre-filled
6. Or: user clicks the header "Sequence" button → modal opens blank
7. User configures the template (params are pre-filled in both cases) → clicks
   "Create Sequence Plan"
8. `useSequencer.createPlan` → `useDemoSequencer.createPlan` → 600ms delay →
   returns a real `SequencePlan` object built by the real template builder
9. Modal closes, router pushes to `/sequence/{planId}`
10. Plan execution page loads with `CostPreview` showing the DEMO_COST_RESULT
    (withdraw $3.40, bridge $64.20, deposit $2.80, total $70.40, break-even 5.5 days)
11. Step 1 (Withdraw): user clicks "Sign Transaction" →
    `simulateStep` → 1400ms delay → step turns green with simulation pass →
    "Sign Transaction" button appears → user clicks → `executeStep` → 800ms
    delay → step confirmed with fake tx hash
12. Step 2 (Bridge): same flow
13. Step 3 (Deposit): same flow
14. `SequenceComplete` screen renders

---

## What is explicitly not built

- No demo mode for `/harvest` — that page is out of scope for the demo
- No demo mode for `/api/*` routes — those routes are never called in demo mode
- No persisted demo state — refreshing resets everything, which is fine
- No "reset demo" button — refresh achieves the same
- No Supabase schema changes — nothing is written
- No environment variable validation — if `NEXT_PUBLIC_DEMO_MODE` is missing,
  the app behaves normally

---

## Acceptance criteria

- [ ] `NEXT_PUBLIC_DEMO_MODE=true` in `.env.local` is the only change needed
      to enter demo mode
- [ ] Landing page shows "Try Demo" button in demo mode
- [ ] `/dashboard` loads with 7 fixture positions and correct totals
- [ ] Demo banner is visible on the dashboard
- [ ] No network requests are made to `/api/positions`, `/api/sequencer/*`,
      or any bridge/RPC endpoint during demo mode (verify in browser Network tab)
- [ ] Sequence modal opens from BorrowCard De-leverage button and header
      Sequence button
- [ ] Creating a plan navigates to `/sequence/[planId]` with a valid plan
- [ ] CostPreview renders with the fixture cost breakdown (3 steps, $70.40 total)
- [ ] Simulate → 1.4s delay → step shows green simulation pass
- [ ] Sign → 0.8s delay → step shows confirmed with a `0xdemo...` tx hash
- [ ] All 3 steps can be completed to reach `SequenceComplete`
- [ ] No `as any` introduced
- [ ] No `<form>` tags introduced
- [ ] Existing real mode is completely unaffected when env var is absent
- [ ] `useWallet`, `usePositions`, `useSequencer`, `useSequenceCost` all have
      unchanged external signatures — no call sites modified