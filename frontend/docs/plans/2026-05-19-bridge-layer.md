# Bridge Layer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement production-grade bridge plugins for Across, NEAR Intents, LayerZero V2 (CCTP), and Chainlink CCIP, including parallel quoting and caching.

**Architecture:** Plugins live in `lib/plugins/bridges/`, registered in `index.ts`. Quoting is proxied through `/api/bridges/quote` with Supabase caching.

**Tech Stack:** Next.js (App Router), viem, @across-protocol/app-sdk, @defuse-protocol/intents-sdk, @layerzerolabs/lz-v2-sdk, @chainlink/ccip-sdk, Supabase.

---

### Task 1: Shared Types & Registry Expansion

**Files:**
- Modify: `types/shared.ts`
- Modify: `lib/plugins/bridges/index.ts`

**Step 1: Update BridgeId and types**
Add `layerzero`, `nearIntents`, `chainlink` to `ALL_BRIDGES`.

**Step 2: Commit**
`git commit -m "types: add layerzero, nearIntents, and chainlink to BridgeId"`

---

### Task 2: Across Protocol Integration (Refactor)

**Files:**
- Modify: `lib/plugins/bridges/across.ts`
- Test: `lib/plugins/bridges/__tests__/across.test.ts`

**Step 1: Implement real getQuote using Across API/SDK**
Fetch suggested fees from `https://app.across.to/api/suggested-fees`.

**Step 2: Implement buildBridgeTx**
Build the `deposit` transaction to the SpokePool contract.

**Step 3: Refine pollStatus**
Ensure it correctly handles Across status responses.

**Step 4: Commit**
`git commit -m "feat: implement Across bridge plugin"`

---

### Task 3: NEAR Intents (Defuse) Integration

**Files:**
- Modify: `lib/plugins/bridges/nearIntents.ts`
- Test: `lib/plugins/bridges/__tests__/nearIntents.test.ts`

**Step 1: Implement getQuote**
Use `https://bridge.chaindefuser.com/rpc` to fetch quotes for EVM -> Solana.

**Step 2: Implement buildBridgeTx**
Generate deposit address and build transfer transaction.

**Step 3: Commit**
`git commit -m "feat: implement NEAR Intents bridge plugin"`

---

### Task 4: LayerZero V2 (CCTP) Integration

**Files:**
- Create: `lib/plugins/bridges/layerzero.ts`
- Test: `lib/plugins/bridges/__tests__/layerzero.test.ts`

**Step 1: Implement getQuote for USDC CCTP**
Query LayerZero endpoints for CCTP transfer fees.

**Step 2: Implement buildBridgeTx**
Build `depositForBurn` call to Circle TokenMessenger via LayerZero adapter.

**Step 3: Commit**
`git commit -m "feat: implement LayerZero CCTP bridge plugin"`

---

### Task 5: Chainlink CCIP Integration

**Files:**
- Create: `lib/plugins/bridges/chainlink.ts`
- Test: `lib/plugins/bridges/__tests__/chainlink.test.ts`

**Step 1: Implement getQuote**
Use `@chainlink/ccip-sdk` to fetch fees from the Router contract.

**Step 2: Implement buildBridgeTx**
Build `ccipSend` transaction.

**Step 3: Commit**
`git commit -m "feat: implement Chainlink CCIP bridge plugin"`

---

### Task 6: Database & Caching

**Files:**
- Create: `supabase/migrations/007_bridge_quotes_cache.sql`
- Modify: `app/api/bridges/quote/route.ts`

**Step 1: Create Supabase migration**
`CREATE TABLE bridge_quotes_cache (...)`

**Step 2: Implement caching logic in API route**
Check cache before fetching; store new quotes with 30s TTL.

**Step 3: Commit**
`git commit -m "feat: add bridge quote caching in Supabase"`

---

### Task 7: UI Improvements

**Files:**
- Create: `components/bridge/BridgeQuoteSelector.tsx`
- Modify: `components/sequence/SequenceStepCard.tsx`

**Step 1: Create BridgeQuoteSelector**
A component to display and compare quotes (Fee, Time, Provider).

**Step 2: Integrate into SequenceStepCard**
Show selector when a bridge step is active.

**Step 3: Commit**
`git commit -m "ui: add bridge quote selector to sequencer"`
