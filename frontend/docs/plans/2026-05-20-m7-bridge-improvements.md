# M7 Bridge Layer Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address Milestone 7 tickets to improve security, precision, and reliability of the bridge layer.

**Architecture:** Updates across bridge plugins (`lib/plugins/bridges/`), API routes (`app/api/bridges/quote/route.ts`), and shared types.

**Tech Stack:** TypeScript, Next.js, viem, Supabase, Zod.

---

### Task 1: Fix Quote Expiry (M7-01)

**Files:**
- Modify: `frontend/lib/plugins/bridges/across.ts`
- Modify: `frontend/lib/plugins/bridges/layerzero.ts`
- Modify: `frontend/lib/plugins/bridges/nearIntents.ts`
- Modify: `frontend/lib/plugins/bridges/chainlink.ts`
- Modify: `frontend/lib/plugins/bridges/__tests__/across.test.ts`
- Modify: `frontend/lib/plugins/bridges/__tests__/layerzero.test.ts`
- Modify: `frontend/lib/plugins/bridges/__tests__/nearIntents.test.ts`
- Modify: `frontend/lib/plugins/bridges/__tests__/chainlink.test.ts`

**Step 1: Update Across plugin expiry**
Change `expiresAt` to `new Date(Date.now() + 90 * 1000)`.

**Step 2: Update LayerZero plugin expiry**
Change `expiresAt` to `new Date(Date.now() + 90 * 1000)`.

**Step 3: Update NEAR Intents plugin expiry**
Change `expiresAt` to `new Date(Date.now() + 90 * 1000)`.

**Step 4: Update Chainlink plugin expiry**
Change `expiresAt` to `new Date(Date.now() + 90 * 1000)`.

**Step 5: Update tests and verify**
Ensure tests assert that `expiresAt` is within 90-91 seconds of `Date.now()`.

**Step 6: Commit**
`git commit -m "fix(m7-01): set bridge quote expiry to 90 seconds across all plugins"`

---

### Task 2: Fix Sort Precision (M7-02)

**Files:**
- Modify: `frontend/app/api/bridges/quote/route.ts`
- Modify: `frontend/lib/plugins/bridges/index.ts`

**Step 1: Update route.ts sorting**
Use `BigInt` comparison for `expectedOutputAmount`.

**Step 2: Update index.ts sorting**
Use `BigInt` comparison for `expectedOutputAmount`.

**Step 3: Add verification test**
Add a test case with amounts > `Number.MAX_SAFE_INTEGER`.

**Step 4: Commit**
`git commit -m "fix(m7-02): use BigInt for bridge quote sort precision"`

---

### Task 3: Add Fetch Timeout (M7-03)

**Files:**
- Modify: `frontend/lib/plugins/bridges/across.ts`
- Modify: `frontend/lib/plugins/bridges/nearIntents.ts`

**Step 1: Update Across plugin fetch**
Use `fetchWithTimeout(url, { timeout: 8000 })`.

**Step 2: Update NEAR Intents plugin fetch**
Use `fetchWithTimeout(url, { timeout: 8000 })`.

**Step 3: Update tests**
Verify that timeout/network errors return `null`.

**Step 4: Commit**
`git commit -m "fix(m7-03): add fetch timeouts to Across and NEAR Intents plugins"`

---

### Task 4: Fix LINK Support (M7-04)

**Files:**
- Modify: `frontend/constants/tokens.ts`

**Step 1: Add LINK to SUPPORTED_TOKENS**
Add LINK with mainnet, Arbitrum, and Base addresses.

**Step 2: Verify Chainlink plugin**
Ensure `supportedTokens` includes 'LINK'.

**Step 3: Add test case**
Verify `getQuote` with 'LINK' does not throw.

**Step 4: Commit**
`git commit -m "fix(m7-04): add LINK token to supported tokens list"`

---

### Task 5: Chainlink CCIP Native Fee (M7-05)

**Files:**
- Modify: `frontend/lib/plugins/bridges/chainlink.ts`

**Step 1: Implement getFee call**
Add `GET_FEE_ABI` and call `router.getFee` in `buildBridgeTx`.

**Step 2: Include fee in value**
Update `value` to include the native fee.

**Step 3: Update tests**
Mock `readContract` and assert non-zero value for USDC transfer.

**Step 4: Commit**
`git commit -m "fix(m7-05): fetch and include native fee in Chainlink CCIP transactions"`

---

### Task 6: Add Tracking URLs (M7-06)

**Files:**
- Modify: `frontend/types/shared.ts`
- Modify: `frontend/lib/plugins/bridges/layerzero.ts`
- Modify: `frontend/lib/plugins/bridges/chainlink.ts`
- Modify: `frontend/lib/plugins/bridges/across.ts`
- Modify: `frontend/lib/plugins/bridges/nearIntents.ts`
- Modify: `frontend/components/execute/StepOneBridge.tsx`

**Step 1: Update BridgeStatus type**
Add `trackingUrl?: string` to `BridgeStatus` in `types/shared.ts`.

**Step 2: Update LayerZero pollStatus**
Return `trackingUrl`.

**Step 3: Update Chainlink pollStatus**
Return `trackingUrl`.

**Step 4: Update Across and NEAR Intents pollStatus**
Return `trackingUrl` when destination TX is known.

**Step 5: Update StepOneBridge UI**
Render tracking link if available.

**Step 6: Commit**
`git commit -m "feat(m7-06): add transaction tracking URLs to bridge status"`

---

### Task 7: Supabase Security & Lazy Init (M7-07)

**Files:**
- Modify: `frontend/lib/data/supabase.ts`
- Modify: `frontend/app/api/bridges/quote/route.ts`

**Step 1: Add server-only guard**
`import 'server-only'` at the top of `supabase.ts`.

**Step 2: Implement getSupabaseAdmin**
Replace `supabaseAdmin` export with lazy getter.

**Step 3: Update callers**
Update `route.ts` and others to use `getSupabaseAdmin()`.

**Step 4: Commit**
`git commit -m "refactor(m7-07): secure and lazy initialize Supabase admin client"`

---

### Task 8: Improve Test Coverage (M7-08)

**Files:**
- Modify: `frontend/lib/plugins/bridges/__tests__/*.test.ts`

**Step 1: Add missing test cases**
Unsupported tokens, routes, API failures, etc. across all plugins.

**Step 2: Verify coverage**
Ensure total test count increases as specified.

**Step 3: Commit**
`git commit -m "test(m7-08): improve unit test coverage for bridge plugins"`

---

### Task 9: Remove Dead Export (M7-09)

**Files:**
- Modify: `frontend/lib/plugins/bridges/index.ts`

**Step 1: Delete getBridgeQuotes**
Remove the unused export.

**Step 2: Commit**
`git commit -m "refactor(m7-09): remove unused getBridgeQuotes export"`

---

### Task 10: Recipient Address Validation (M7-10)

**Files:**
- Modify: `frontend/app/api/bridges/quote/route.ts`

**Step 1: Implement Zod superRefine**
Add validation for `recipientAddress` based on `toChain`.

**Step 2: Add route tests**
Test validation rejection for invalid addresses.

**Step 3: Commit**
`git commit -m "fix(m7-10): validate recipient address format in bridge quote route"`
