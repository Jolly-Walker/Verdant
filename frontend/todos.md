# Verdant — M10 Completion Tickets

Branch: `m10` | PR: #7 | All changes go to `m10`, not `main`.

These tickets are ordered by execution sequence. Complete them in order — M10-BUG
patches first, then M10-02, M10-03, M10-01, M10-04.

---

## M10-BUG — Fix three code bugs (bugs #1, #2, #4 from handover doc)

**Scope:** Three isolated fixes across two files. No new logic, no new types.
Do all three in a single commit.

---

### Bug #1 — Stale hardcoded `$1,000` error string

**File:** `frontend/app/api/sequencer/plan/route.ts`  
**Line:** 196

`DEFAULT_MIN_USD_THRESHOLD` is already imported at line 13 of this file. The
error string in the `else` branch of the minimum size validation block still
hardcodes `$1,000`.

**Current:**
```ts
error: `Minimum transaction size of $1,000 USD required. Current: $${validation.amountUsd.toFixed(2)}`
```

**Fix:**
```ts
error: `Minimum transaction size of $${DEFAULT_MIN_USD_THRESHOLD} USD required. Current: $${validation.amountUsd.toFixed(2)}`
```

Note: the `deleverageAave` branch directly above it (line ~175) already uses
`DEFAULT_MIN_USD_THRESHOLD` correctly. This fix makes the `else` branch
consistent.

---

### Bug #2 — `as any` on `templateId` in `sequencePlans.ts`

**File:** `frontend/lib/data/sequencePlans.ts`  
**Lines:** 30 and 57

Both `createSequencePlan` and `getSequencePlan` cast `data.template_id as any`.
`TemplateId` is defined in `@/types/sequencer` and covers all valid values.

**Fix — add import at top of file:**
```ts
import { SequencePlan, SerializedSequenceStep, TemplateId } from '@/types/sequencer'
```
(Replace existing import of `SequencePlan, SerializedSequenceStep` from that
module.)

**Fix — line 30** (inside `createSequencePlan`):
```ts
templateId: data.template_id as TemplateId
```

**Fix — line 57** (inside `getSequencePlan`):
```ts
templateId: data.template_id as TemplateId
```

---

### Bug #4 — Hardcoded 130% collateral ratio in break-even calculation

**File:** `frontend/lib/costPreview/calculator.ts`  
**Line:** 187

`computeDeleverageBreakEven` is called with `collateralUnwoundUsd: amountUsd *
1.3`. This is wrong — the actual collateral is available on the plan's template
params.

The `deleverageAave` template builder already receives `totalCollateralUsd` in
its params and stores it on `params.totalCollateralUsd`. Thread it through
`SequencePlanCostInput`.

**Step 1 — Add `totalCollateralUsd` to `SequencePlanCostInput`** in
`calculator.ts`:
```ts
export interface SequencePlanCostInput {
  plan: SequencePlan
  currentApy?: number
  targetApy?: number
  borrowApy?: number
  supplyApy?: number
  totalCollateralUsd?: number  // ADD THIS
}
```

**Step 2 — Use it in the break-even call** (line ~187):
```ts
deleverageBreakEven = computeDeleverageBreakEven({
  totalCostUsd,
  debtUnwoundUsd: amountUsd,
  collateralUnwoundUsd: input.totalCollateralUsd ?? amountUsd * 1.3,
  borrowApy: input.borrowApy,
  supplyApy: input.supplyApy,
})
```

The `?? amountUsd * 1.3` fallback keeps the legacy estimate for any caller that
doesn't supply the collateral value. This is safe — no callers currently pass
`totalCollateralUsd`, so no existing behaviour changes.

**Step 3 — Pass `totalCollateralUsd` from the cost route**  
**File:** `frontend/app/api/sequencer/cost/route.ts`

Add `totalCollateralUsd` to the Zod schema and pass it through:

```ts
const CostRequestSchema = z.object({
  planId: z.string().uuid(),
  walletAddress: z.string(),
  currentApy: z.number().optional(),
  targetApy: z.number().optional(),
  borrowApy: z.number().optional(),
  supplyApy: z.number().optional(),
  totalCollateralUsd: z.number().optional(),  // ADD THIS
})
```

And in the `calculateCostPreview` call:
```ts
const costResult = await calculateCostPreview({
  plan,
  currentApy,
  targetApy,
  borrowApy,
  supplyApy,
  totalCollateralUsd,  // ADD THIS
})
```

`useSequenceCost` will pass this value in a later ticket (M10-01). For now the
field is optional and defaults to the conservative estimate.

---

## M10-02 — Call `detectWarnings` in the N-step calculator path

**File:** `frontend/lib/costPreview/calculator.ts`

**Problem:** The N-step `SequencePlan` path returns `warnings: []` hardcoded.
`detectWarnings` is already imported at the top of `calculator.ts` and is
called correctly in the legacy path. It just isn't called in the `'plan' in
input` branch.

**Where to add the call:**  
After the break-even variables are computed and before the `return` statement in
the N-step path (around line 165, after `deleverageBreakEven` is set).

Add this block immediately before the `return`:
```ts
const warnings = detectWarnings(
  {
    steps,
    totalCostUsd,
    dailyYieldGainUsd,
    breakEvenDays,
    currentApyDecimal,
    targetApyDecimal,
  },
  amountUsd
)
```

Then in the return object, replace `warnings: []` with `warnings`.

**Notes:**
- `pendleMaturityMs` is not passed here — the N-step path doesn't have it in
  scope. That is acceptable; Pendle maturity warnings are already surfaced on
  `PendleCard` directly. Do not invent a way to pass it.
- `amountUsd` at this point in the N-step path is still `plan.totalCostUsd > 0
  ? plan.totalCostUsd : 10_000` (the bug from M10-03 below). That is fine — fix
  the amountUsd bug separately in M10-03. The call to `detectWarnings` will
  automatically benefit from the corrected value once M10-03 is done.

---

## M10-03 — Fix `amountUsd` in N-step cost calculator

**Problem:** In `calculator.ts` line 136, `amountUsd` (used as the position
size for proportional bridge fee estimates and break-even calculations) reads
`plan.totalCostUsd`. That field holds the sum of all transaction fees, not the
user's position size. For a $10,000 USDC bridge with $50 in fees,
`plan.totalCostUsd = 50`, making all proportional calculations 200× too small.

**Fix: add `positionSizeUsd` to `SequencePlan`**

### Step 1 — Add field to type

**File:** `frontend/types/sequencer.ts`

Add `positionSizeUsd` as an optional field on `SequencePlan`:
```ts
export interface SequencePlan {
  id: string
  walletAddress: string
  createdAt: Date
  steps: SequenceStep[]
  status: 'draft' | 'in-progress' | 'complete' | 'failed'
  totalCostUsd: number
  positionSizeUsd?: number   // ADD: user's position size, not fee total
  description: string
  templateId?: TemplateId
}
```

### Step 2 — Populate it in all five template builders

Each builder constructs the initial `SequencePlan` object with `totalCostUsd:
0`. Add `positionSizeUsd` to each, sourced from the relevant `amountUsd` param.

**`frontend/lib/sequencer/templates/bridgeAndDeposit.ts`**  
Source: `params.amountUsd`
```ts
const plan: SequencePlan = {
  ...
  totalCostUsd: 0,
  positionSizeUsd: params.amountUsd,
  ...
}
```

**`frontend/lib/sequencer/templates/repayAndWithdraw.ts`**  
Source: `params.amountUsd`
```ts
positionSizeUsd: params.amountUsd,
```

**`frontend/lib/sequencer/templates/crossChainRebalance.ts`**  
Source: `params.amountUsd`
```ts
positionSizeUsd: params.amountUsd,
```

**`frontend/lib/sequencer/templates/deleverageAave.ts`**  
Source: `params.totalDebtUsd` (the debt being unwound is the position size for
cost proportionality purposes)
```ts
positionSizeUsd: params.totalDebtUsd,
```

**`frontend/lib/sequencer/templates/exitPendle.ts`**  
Source: `params.amountUsd`
```ts
positionSizeUsd: params.amountUsd,
```

### Step 3 — Use it in the calculator

**File:** `frontend/lib/costPreview/calculator.ts`, line 136

Replace:
```ts
const amountUsd = plan.totalCostUsd > 0 ? plan.totalCostUsd : 10_000
```

With:
```ts
const amountUsd = plan.positionSizeUsd ?? (plan.totalCostUsd > 0 ? plan.totalCostUsd : 10_000)
```

The fallback chain keeps backwards compatibility: if `positionSizeUsd` is
somehow absent (e.g. plans created before this change), it falls through to the
old (broken) behaviour rather than crashing.

### Step 4 — Persist `positionSizeUsd` to Supabase

**File:** `frontend/lib/data/sequencePlans.ts`, function `createSequencePlan`

Add `position_size_usd` to the insert:
```ts
.insert({
  wallet_address: plan.walletAddress,
  template_id: templateId,
  description: plan.description,
  status: plan.status,
  total_cost_usd: plan.totalCostUsd,
  position_size_usd: plan.positionSizeUsd ?? null,   // ADD
  steps: serializedSteps
})
```

And read it back in `getSequencePlan`:
```ts
return {
  ...
  totalCostUsd: Number(data.total_cost_usd || 0),
  positionSizeUsd: data.position_size_usd ? Number(data.position_size_usd) : undefined,  // ADD
  ...
}
```

### Step 5 — Add DB migration

**File:** `frontend/supabase/migrations/010_add_position_size_usd.sql`

```sql
ALTER TABLE sequence_plans
  ADD COLUMN IF NOT EXISTS position_size_usd numeric(18,2);
```

---

## M10-01 — Wire `useSequenceCost` into the execution page

**Problem:** `useSequenceCost` is fully built but called nowhere. The execution
page (`app/sequence/[planId]/page.tsx`) does not fetch cost data, and
`CostPreview` in the plan view has no data to show. The Sign button in
`SequenceStepCard` is not gated on quote expiry.

### What to build

**1. Wire `useSequenceCost` in `app/sequence/[planId]/page.tsx`**

After the plan loads, call `useSequenceCost` with the plan and wallet address.
Pass the result down to `SequencePlanView`.

```ts
// After plan loads:
const {
  result: costResult,
  isLoading: costLoading,
  staleStepIds,
  expiredStepIds,
  hasExpiredQuotes,
  refetch: refetchCost,
} = useSequenceCost({
  plan,          // null until loaded — hook handles this
  walletAddress: address,
})
```

For `borrowApy` and `supplyApy`: pass `undefined` for now. These are only
relevant for `deleverageAave` plans; they would need to come from a future Aave
data fetch that is out of scope for this ticket.

**2. Update `SequencePlanView` props to accept cost data**

**File:** `frontend/components/sequence/SequencePlanView.tsx`

Add optional props:
```ts
{
  plan: SequencePlan
  currentStepId: string | null
  onSimulate: (stepId: string) => void
  onSign: (stepId: string) => void
  onEdit: () => void
  costResult?: CostPreviewResult | null          // ADD
  costLoading?: boolean                          // ADD
  staleStepIds?: Set<string>                     // ADD
  expiredStepIds?: Set<string>                   // ADD
  hasExpiredQuotes?: boolean                     // ADD
  onRefetchCost?: () => void                     // ADD
}
```

Inside `SequencePlanView`:

- Render `<CostPreview>` in the view, passing the external result props:
  ```tsx
  <CostPreview
    result={costResult}
    isLoading={costLoading}
    staleStepIds={staleStepIds}
    expiredStepIds={expiredStepIds}
    stepIds={plan.steps.map(s => s.id)}
    refetch={onRefetchCost}
  />
  ```
  Place this below `<SequenceProgress>` and above the step list.

- Gate the "Cancel and return" button area: if `hasExpiredQuotes` is true, also
  render a prominent warning and a refresh button:
  ```tsx
  {hasExpiredQuotes && (
    <div className="mt-4 p-3 bg-red-900/20 border border-red-900/50 rounded-lg flex justify-between items-center">
      <p className="text-red-400 text-sm">Bridge quote expired — refresh before signing</p>
      <button onClick={onRefetchCost} className="text-sm text-white bg-red-800 hover:bg-red-700 px-3 py-1 rounded">
        Refresh Quotes
      </button>
    </div>
  )}
  ```

**3. Gate the Sign button in `SequenceStepCard`**

**File:** `frontend/components/sequence/SequenceStepCard.tsx`

Add an optional prop:
```ts
interface SequenceStepCardProps {
  step: SequenceStep
  index: number
  isCurrent: boolean
  onAction: (params?: Record<string, unknown>) => Promise<void>
  isQuoteExpired?: boolean    // ADD
}
```

In `SequencePlanView`, pass `isQuoteExpired` per step:
```tsx
<SequenceStepCard
  key={step.id}
  step={step}
  index={index}
  isCurrent={step.id === currentStepId}
  onAction={async () => onSign(step.id)}
  isQuoteExpired={expiredStepIds?.has(step.id) ?? false}
/>
```

In `SequenceStepCard`, disable the Sign button when `isQuoteExpired` is true:
```tsx
} : step.status === 'ready' && isCurrent ? (
  <button
    onClick={handleAction}
    disabled={isSimulating || isQuoteExpired}
    title={isQuoteExpired ? 'Bridge quote expired — refresh cost preview' : undefined}
    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
  >
    {isSimulating ? (
      <div className="flex items-center">
        <Spinner size="sm" className="mr-2" />
        <span>Simulating...</span>
      </div>
    ) : isQuoteExpired ? (
      'Quote Expired'
    ) : (
      'Sign Transaction'
    )}
  </button>
```

**Important invariants — do not regress:**
- The Sign button must only appear when `step.simulation?.success === true`
  (enforced by `step.status === 'ready'`). This ticket adds a second disable
  condition; it must not remove or bypass the existing status check.
- Steps without a bridge (no `quoteExpiresAt` in their `StepCost`) will never
  appear in `expiredStepIds`. Only bridge steps are ever gated by this.

**4. Update the call site in `app/sequence/[planId]/page.tsx`**

Pass the new props down:
```tsx
<SequencePlanView
  plan={plan}
  currentStepId={currentStep?.id || null}
  onSimulate={simulateStep}
  onSign={executeStep}
  onEdit={() => router.back()}
  costResult={costResult}
  costLoading={costLoading}
  staleStepIds={staleStepIds}
  expiredStepIds={expiredStepIds}
  hasExpiredQuotes={hasExpiredQuotes}
  onRefetchCost={refetchCost}
/>
```

---

## M10-04 — Sequencer modal

**Problem:** Position cards link to `/sequence?template=...` (a full page route)
and `app/execute/page.tsx` is a dead placeholder. The goal is a modal that
wraps the existing sequence setup flow, launched from position cards and the
dashboard, with the full-page route kept as fallback.

### What to build

**1. Create `components/sequence/SequenceModal.tsx`**

A modal wrapper around the existing template selector and param form. It should
reuse the same state and logic from `app/sequence/page.tsx` — do not rewrite
the param form logic, extract or import it.

The component accepts:
```ts
interface SequenceModalProps {
  isOpen: boolean
  onClose: () => void
  /** Pre-select a template on open */
  initialTemplate?: TemplateId
  /** Pre-fill params from a position card */
  initialParams?: Partial<Record<string, string>>
}
```

Behaviour:
- On open with `initialTemplate` and `initialParams`, hydrate the form state
  exactly as `app/sequence/page.tsx` does today via `useEffect` on
  `searchParams`. Mirror that logic using the `initialParams` prop instead.
- On "Create Sequence Plan" success, call `router.push(`/sequence/${plan.id}`)`,
  then call `onClose()`.
- On cancel or backdrop click, call `onClose()` without navigating.
- Use a `dialog`-style overlay: fixed full-screen backdrop
  (`bg-black/60 backdrop-blur-sm`), centred card, max width `max-w-2xl`, scrollable
  content area for the param form.
- Architecture rule: no `<form>` tags. Use `onClick` handlers, same as the
  existing page.

**2. Create a modal context/hook for dashboard use**

**File:** `hooks/useSequenceModal.ts`

```ts
'use client'

import { useState, useCallback } from 'react'
import { TemplateId } from '@/types/sequencer'

interface OpenModalOptions {
  template?: TemplateId
  params?: Partial<Record<string, string>>
}

export function useSequenceModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<OpenModalOptions>({})

  const openModal = useCallback((opts: OpenModalOptions = {}) => {
    setOptions(opts)
    setIsOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setIsOpen(false)
    setOptions({})
  }, [])

  return { isOpen, options, openModal, closeModal }
}
```

**3. Mount the modal in `app/dashboard/page.tsx`**

```tsx
const { isOpen, options, openModal, closeModal } = useSequenceModal()

// Pass openModal to PositionList/position cards, render modal at page level:
<SequenceModal
  isOpen={isOpen}
  onClose={closeModal}
  initialTemplate={options.template}
  initialParams={options.params}
/>
```

**4. Update `BorrowCard` to open the modal instead of navigating**

`BorrowCard` currently calls `router.push('/sequence?...')`. Change it to
accept an `onSequence` callback prop and call that instead:

```ts
// BorrowCard props
interface BorrowCardProps {
  position: Position
  onSequence?: (template: TemplateId, params: Record<string, string>) => void
}
```

In `handleDeleverage`, instead of `router.push(...)`:
```ts
if (onSequence) {
  onSequence('deleverageAave', Object.fromEntries(query.entries()))
} else {
  router.push(`/sequence?${query.toString()}`)  // fallback
}
```

The fallback keeps the full-page route working for any existing links or direct
URL access.

**5. Update `PendleCard` the same way**

```ts
interface PendleCardProps {
  position: Position
  onSequence?: (template: TemplateId, params: Record<string, string>) => void
}
```

Replace the `<Link href="/sequence?...">` Exit button with a `<button>` that
calls `onSequence('exitPendle', {...})`. Keep a fallback `<Link>` if
`onSequence` is not provided.

**6. Thread `onSequence` through `PositionList`**

`PositionList` renders position cards. Add an `onSequence` prop to `PositionList`
and pass it down to `BorrowCard` and `PendleCard`.

**7. Keep `app/sequence/page.tsx` unchanged**

The full-page flow remains as a valid fallback. Any direct link to
`/sequence?template=...` continues to work. Do not remove or redirect it.

**8. `app/execute/page.tsx` — leave as-is**

This page is not the primary flow and is out of scope. Do not touch it.

---

## Acceptance criteria (all tickets)

Before marking M10 ready to merge, verify:

- [ ] `plan/route.ts` error string references `DEFAULT_MIN_USD_THRESHOLD`, not `$1,000`
- [ ] `sequencePlans.ts` has no `as any` — both instances cast to `TemplateId`
- [ ] `calculator.ts` break-even uses real `totalCollateralUsd` when provided
- [ ] `calculator.ts` N-step path calls `detectWarnings` and returns real warnings
- [ ] `SequencePlan` type has `positionSizeUsd?: number`
- [ ] All five template builders populate `positionSizeUsd`
- [ ] Migration `010_add_position_size_usd.sql` exists
- [ ] `calculator.ts` reads `plan.positionSizeUsd` instead of `plan.totalCostUsd`
- [ ] `useSequenceCost` is called in `app/sequence/[planId]/page.tsx`
- [ ] `CostPreview` renders in `SequencePlanView` with live data
- [ ] Sign button is disabled (not hidden) when `isQuoteExpired` is true
- [ ] Sign button only appears when `step.simulation?.success === true` — not
      regressed
- [ ] `SequenceModal` exists and opens from `BorrowCard` and `PendleCard`
- [ ] Modal closes without navigation on cancel
- [ ] Modal navigates to `/sequence/[planId]` on plan creation
- [ ] `app/sequence/page.tsx` still works via direct URL
- [ ] No `<form>` tags introduced
- [ ] No `as any` introduced
- [ ] `server-only` not removed from any file that had it