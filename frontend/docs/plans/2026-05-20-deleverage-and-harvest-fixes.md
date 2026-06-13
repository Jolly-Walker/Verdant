# Aave De-leverage & Harvest Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable Aave de-leverage sequences with optimal cycle calculation and subgraph-enriched data, while hardening the Harvest flow with mandatory simulation and timeouts.

**Architecture:**
- **Protocol Plugins:** Extend Aave and Euler plugins to support `repay` and `withdraw` actions.
- **Sequencer Templates:** Update `deleverageAave` to use BigInt for precision and automatically compute the minimum cycles required.
- **Data Layer:** Add a server-only Aave subgraph client for rich position data.
- **UI:** Connect the "De-leverage" entry point on the dashboard and improve simulation feedback.

**Tech Stack:** Next.js (App Router), viem/wagmi, BigInt, The Graph (Aave Subgraph).

---

### Task 1: Fix `Number()` precision bug and implement `computeOptimalCycles`

**Files:**
- Modify: `frontend/lib/sequencer/templates/deleverageAave.ts`
- Test: `frontend/lib/sequencer/__tests__/deleverageAave.test.ts` (Update existing or create if missing)

**Step 1: Write failing tests for precision and cycle calculation**
- Test with amounts > `Number.MAX_SAFE_INTEGER`.
- Test `computeOptimalCycles` with a low HF position (should return > 1 cycle).

**Step 2: Implement BigInt precision fix**
- Replace `Number()` calls on `params.totalDebt` and `params.totalCollateral` with `BigInt()`.
- Use scaled integer arithmetic for fraction calculation.

**Step 3: Implement `computeOptimalCycles`**
- Add the simulation loop to find the minimum cycles where HF stays > 1.05.
- Export it for use in the UI.

**Step 4: Verify and Commit**
- Run tests: `npm test deleverageAave.test.ts`
- Commit: `fix: precision and optimal cycle calculation for Aave de-leverage`

---

### Task 2: Aave Subgraph Integration

**Files:**
- Create: `frontend/lib/data/aaveSubgraph.ts`
- Modify: `frontend/lib/plugins/protocols/aave.ts`

**Step 1: Implement `fetchAaveUserData`**
- Add `server-only` subgraph client using `fetchWithTimeout`.
- Define `AAVE_SUBGRAPH_URLS` for Ethereum, Arbitrum, and Base.

**Step 2: Update Aave Plugin `fetchPositions`**
- Call subgraph for HF and per-reserve collateral data.
- Fallback to RPC data if subgraph returns null.

**Step 3: Verify and Commit**
- Mock subgraph response in unit tests.
- Commit: `feat: Aave subgraph integration for enriched position data`

---

### Task 3: Wire "De-leverage" Button in BorrowCard

**Files:**
- Modify: `frontend/components/positions/BorrowCard.tsx`
- Modify: `frontend/types/position.ts`

**Step 1: Update `Position` type**
- Ensure `collateralAsset` and `collateralAmount` are present in `RawPosition` or `Position` interface.

**Step 2: Add handleDeleverage logic to BorrowCard**
- Use `useRouter` to navigate to `/sequence?template=deleverageAave` with pre-filled query params.

**Step 3: Verify and Commit**
- Manual smoke test: Click button, verify URL params.
- Commit: `feat: wire de-leverage button to sequence planner`

---

### Task 4: Hardening useHarvest and useRewards

**Files:**
- Modify: `frontend/hooks/useHarvest.ts`
- Modify: `frontend/hooks/useRewards.ts`

**Step 1: Fix simulation soft-fail in `useHarvest`**
- Throw error if simulation request fails or returns `success: false`.

**Step 2: Add `fetchWithTimeout`**
- Update all calls to `/api/rewards`, `/api/rewards/claim`, and `/api/simulate` with 12s timeout.

**Step 3: Verify and Commit**
- Run: `npm run lint`
- Commit: `security: enforce simulation gate and timeouts in harvest flow`

---

### Task 5: End-to-end de-leverage plan creation test

**Files:**
- Create: `frontend/lib/sequencer/__tests__/deleverage.e2e.test.ts`

**Step 1: Write E2E test suite**
- Exercise `buildDeleverageAavePlan` with complex mock positions.
- Verify dependency chain and final state (debt approaches zero).

**Step 2: Verify and Commit**
- Run tests: `npm test deleverage.e2e.test.ts`
- Commit: `test: e2e plan creation for de-leverage sequences`
