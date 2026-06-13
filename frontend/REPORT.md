# Verdant Project Handover Report

**Date:** May 20, 2026  
**Status:** Milestones 1-7 complete. Milestones 8-9 partially implemented (logic exists, UI pending). Milestone 10 (Cost Preview) refactored for N-step support.

## 1. Executive Summary
The core infrastructure, plugin architecture, and multi-chain connection layers are stable. However, several components were found to be "vibe coded" (relying on hardcoded mocks and dummy logic) rather than actual implementation. Recent efforts have focused on connecting the "pipes" for the multi-step transaction sequencer and refactoring the cost preview engine to handle real data.

## 2. Key Accomplishments (Recently Fixed)
- **Multi-Step Cost Engine**: `lib/costPreview/calculator.ts` was refactored to support N-step sequences by iterating over `SequencePlan.steps`.
- **Real-Data Cost Preview**: `components/execute/CostPreview.tsx` was rewritten to remove hardcoded $12.50 mocks and now ingests real sequence costs and yield projections.
- **Gas Estimation Refactor**: `lib/simulation/simulate.ts` now uses actual `ChainPlugin` methods for estimation instead of the previous "approve + magic number" hack.
- **Spec Sync**: `SPECS.md` Milestones 8 and 9 were checked off as the underlying protocol logic (Aave/Euler borrow actions and rewards) is already present in the plugins.

## 3. Mock/Stub Remediation — 2026-06-13 update (RESOLVED)
The hardcoded mocks flagged below have been replaced with real integrations. All
changes are covered by unit tests (mocked API responses) but have **not** been
live-tested against mainnet/keys.

- **Aave HF guard (`lib/plugins/protocols/aave.ts`)** — DONE. `buildTx` now refuses
  any `withdraw`/`borrow` that would bring HF below 1.05 (`assertActionKeepsHealthy`
  reads live account data + AaveOracle price; pure `projectHealthFactor` is unit-tested).
  Fails open on RPC errors — the simulation gate is the backstop.
- **LayerZero/CCTP (`lib/plugins/bridges/layerzero.ts`)** — DONE. Real fee via Circle
  IRIS `/v2/burn/USDC/fees`, real status via `/v2/messages` attestation. Also fixed a
  latent v1→v2 `depositForBurn` ABI mismatch (would have reverted on-chain).
- **NEAR Intents (`lib/plugins/bridges/nearIntents.ts`)** — DONE. Real status via 1Click
  `/v0/status` (deposit-address threaded through an extended, backward-compatible
  `pollStatus(_, _, context)` + status route + `useBridges`). Flat $2 fee replaced with a
  size-scaled, priced estimate (the 1Click quote needs an origin refund address that
  `BridgeQuoteParams` does not carry — documented limitation).
- **Chainlink CCIP (`lib/plugins/bridges/chainlink.ts`)** — DONE. Real on-chain `getFee`
  quote priced in USD; honest source-receipt status check (CCIP has no public REST status API).
- **Euler APYs (`lib/plugins/protocols/euler.ts`)** — DONE. Static 0.045/0.055 replaced
  with real supply + borrow APYs from Defillama (`/poolsBorrow` added to the client).
- **Morpho (`lib/plugins/protocols/morpho.ts`)** — DONE. `fetchPositions` via the Morpho
  Blue GraphQL API (`lib/data/morphoApi.ts`); `buildTx` via MetaMorpho ERC-4626 deposit/withdraw.
- **Pendle (`lib/plugins/protocols/pendle.ts`)** — DONE. Zero-address mock builder replaced
  with the real Convert API (`/v2/sdk/{chainId}/convert`); best-effort positions fetcher.
- **1inch (`lib/plugins/swaps/oneinch.ts`)** — DONE. Real v6.0 quote/swap (needs
  `ONEINCH_API_KEY`; returns null when unset so the option is simply unavailable).

### Also hardened
- Rate limiting added (SPECS §19): 60/min positions, 10/min simulate + plan creation.
- `/api/quote` now zod-validated (was an unvalidated cast); `/api/bridges/build` quote
  schema typed (was `z.any()`).
- Removed 5 of 7 `as any`/`as unknown as` casts; the 2 remaining (custom-plan JSON →
  build-param union) are documented and re-validated at execution time.

### Known gaps (not addressed)
- `user_settings` and `execution_history` tables exist in the schema but have no repository
  or writer. Left as-is rather than adding repositories nothing calls (avoid speculative dead code).
- `app/execute/page.tsx` has no internal navigation (a dev sandbox). Left in place — removing a
  URL-reachable route is a product decision.
- NOTE: `StepOneBridge` and `useHarvest` were previously suspected legacy/dead; verified **live**
  (`SequenceStepCard` and `PositionCard`/`HarvestButton` import them). Do not remove.

## 4. UI Design Tasks — 2026-06-13 update (DONE)
The visual-polish pass is complete; all four components are backed by real data. `framer-motion@12.40.0` was added as a dependency for the animation work. Verified together: `tsc --noEmit` clean, `lint` clean, 245/245 tests pass, production build succeeds.
1.  **`HealthFactor.tsx`** — DONE. Now a compact "Risk Meter" gauge (segmented bar + sliding
    indicator, zones <1.2 danger / 1.2–2.0 caution / ≥2.0 healthy; clamps large/∞ HF; `role="meter"`).
    Public API unchanged (`{ value: number }`) and now actually consumed (see PositionCard below).
2.  **`PositionCard.tsx`** (the borrow row — there is no `BorrowCard.tsx`) — DONE. Wired in the new
    `<HealthFactor>` gauge (replacing the inline "Health: X.XX" span + dead `getHealthFactorColor`),
    restyled the De-leverage/Repay buttons (hierarchy, press feedback). **Liquidation price:** real
    Aave positions do NOT carry `liquidationPrice`/`liquidationThreshold`/collateral price (only
    `healthFactor`); the field is set only in the demo fixture. Rather than fabricate a number, the
    card shows a real derived metric — "−X.X% to liquidation" = `(1 − 1/HF)·100` — and prefers a true
    `position.liquidationPrice` only if the pipeline ever supplies one (>0).
3.  **`CostPreview.tsx`** — DONE. Receipt/timeline aesthetic (perforated header, vertical rail with
    markers, mono tabular amounts, promoted Total). All data bindings, conditional sections, and
    stale/expired/loading/error/empty states preserved.
4.  **`SequenceProgress.tsx`** — DONE. Framer Motion transitions (connector-line fill, node pop +
    checkmark draw-in, active-step pulse, label transitions), honors `prefers-reduced-motion`.

## 5. Next Agent Action Items (Priority Order)
Safety/correctness, protocol-coverage (§3) and visual-polish (§4) tracks are complete. Also done this round:
- **Rate-limit store** — DONE. `lib/server/rateLimit.ts` now delegates to a pluggable
  `RateLimitStore` (`lib/server/rateLimitStore.ts`): in-memory by default (single-instance behavior
  and the sync `rateLimit()`/tests unchanged), or a shared Upstash Redis store when
  `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set. Upstash uses an atomic sorted-set
  sliding-window Lua `EVAL` over the REST API via `fetch` (no new npm dependency), and **fails open**
  on error. `enforceRateLimit` is now async; all 4 route callers `await` it.
- **exitPendle amounts** — DONE (Option A: plan-creation preview). The **server route**
  `app/api/sequencer/plan/route.ts` calls the real Pendle Convert API
  (`previewPendleRedemption` → `/v2/sdk/{chainId}/convert`, in the server-only `pendle.ts`) and passes
  the previewed underlying output into `buildExitPendlePlan(params, redemptionOutput)`. The builder
  applies a `slippagePercent` BigInt floor and sizes the downstream bridge/deposit steps off that
  output instead of the raw PT amount (falls back to the PT amount when the preview is `null`); the
  stale TODOs are removed. Also fixed a latent re-scaling bug (`isWei: true` on the redeem step).
  IMPORTANT: the builder stays **pure/synchronous with no `'server-only'` import** — it is re-exported
  through the `templates/index.ts` barrel that the client hook `useSequencer` imports, so importing a
  server-only module into it poisons the client bundle and breaks `next build` (caught here; the
  server-only preview must live in the route, not the template). `tsc`/`lint`/unit tests do NOT catch
  this class of bug — only `bun run build` does, so run it after touching template/plugin imports.

Remaining:
1.  **Live verification** (still pending — needs real RPC/keys): exercise the bridge/protocol/swap
    integrations against Circle IRIS, 1Click, CCIP, Morpho/Pendle APIs, `ONEINCH_API_KEY`.
2.  **exitPendle realized output (Option B)**: the deposit/bridge amount is a *plan-creation-time*
    estimate; if the PT→underlying rate moves between plan creation and execution it can drift (the
    slippage floor + simulation gate mitigate, and it falls back to the PT amount if the Convert API
    returns null). A hard fix needs a post-confirmation realized-balance read plumbed into the
    execution path (`app/api/sequencer/simulate/route.ts`), which the current simulate-only flow lacks.
3.  **Upstash store live-test**: the shared rate-limit store is unit-tested on the in-memory path only;
    exercise the Upstash path against a real instance before relying on it for global limits.
