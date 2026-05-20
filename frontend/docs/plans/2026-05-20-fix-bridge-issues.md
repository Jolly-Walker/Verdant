# Fix Bridge Transaction Simulation & Validate quotes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix critical security, simulation, and architectural issues in the bridge build flow and repair pre-existing failing tests in the sequencer.

**Architecture:** We will modify the `/api/bridges/build` Next.js API route to enforce a simulation gate and validate the quote details against the user's wallet address. In the client, the `StepOneBridge` component will be updated to trigger build and simulation asynchronously on quote selection and to disable action until verification passes. Finally, we'll fix the mock payloads in the broken sequencer test files.

**Tech Stack:** Next.js App Router, Zod, Viem, Wagmi, Vitest.

---

### Task 1: Update Bridge Build Route Schema, Validation, and Simulation

**Files:**
- Modify: `frontend/app/api/bridges/build/route.ts`
- Test: `frontend/app/api/bridges/build/__tests__/route.test.ts`

**Step 1: Write the failing tests**
Create `frontend/app/api/bridges/build/__tests__/route.test.ts` with tests for:
- 400 when `walletAddress` is missing.
- 400 when `walletAddress` does not match `recipientAddress` in `rawQuote`.
- 400 when origin chain is unsupported.
- 400 when transaction simulation fails.
- 200 when transaction simulation passes.

**Step 2: Run test to verify they fail**
Run: `npx vitest run app/api/bridges/build`
Expected: FAIL (or missing files)

**Step 3: Modify route implementation**
Implement Zod validation for `walletAddress`, quote comparisons, chain assertions, and simulation using `simulateTransaction`.

**Step 4: Run test to verify they pass**
Run: `npx vitest run app/api/bridges/build`
Expected: PASS

**Step 5: Commit**
```bash
git add frontend/app/api/bridges/build/route.ts frontend/app/api/bridges/build/__tests__/route.test.ts
git commit -m "feat: add simulation and validation to bridge build route"
```

---

### Task 2: Update useBridges hook and StepOneBridge UI component

**Files:**
- Modify: `frontend/hooks/useBridges.ts`
- Modify: `frontend/components/execute/StepOneBridge.tsx`

**Step 1: Update useBridges hook**
Change signature of `buildTransaction` to accept `walletAddress` and pass it to `/api/bridges/build` POST request payload.

**Step 2: Modify StepOneBridge UI component**
- Add comments explaining direct `useSendTransaction` exception.
- Add `serializedTx` and `isSimulating` states.
- Run `buildTransaction` inside a `useEffect` responding to `selectedQuote` and `address` changes.
- Bind the disabled state of the "Approve & Bridge" button to `!serializedTx || isSimulating`.

**Step 3: Verify build**
Run: `npm run build`
Expected: Build passes with no TypeScript errors.

**Step 4: Commit**
```bash
git add frontend/hooks/useBridges.ts frontend/components/execute/StepOneBridge.tsx
git commit -m "feat: enforce simulation gate in StepOneBridge UI"
```

---

### Task 3: Fix pre-existing failing Vitest unit tests in sequencer

**Files:**
- Modify: `frontend/lib/sequencer/__tests__/engine.test.ts`
- Modify: `frontend/app/api/sequencer/plan/[planId]/step/[stepId]/__tests__/route.test.ts`

**Step 1: Run tests to verify failures**
Run: `npx vitest run lib/sequencer app/api/sequencer`
Expected: 3 tests fail.

**Step 2: Fix mock payloads**
- Add `simulation: { success: true }` to the ready step in `engine.test.ts`.
- Add `walletAddress: '0x123'` to PATCH request bodies and mock plans in `route.test.ts`.

**Step 3: Run tests to verify they pass**
Run: `npx vitest run lib/sequencer app/api/sequencer`
Expected: All tests pass.

**Step 4: Commit**
```bash
git add frontend/lib/sequencer/__tests__/engine.test.ts frontend/app/api/sequencer/plan/\[planId\]/step/\[stepId\]/__tests__/route.test.ts
git commit -m "test: fix failing sequencer tests"
```
