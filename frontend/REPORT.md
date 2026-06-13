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

## 4. UI Design Tasks (Pending)
The user has requested a shift toward visual polish. The following components are ready for a design upgrade now that they are backed by real data:
1.  **`HealthFactor.tsx`**: Needs a visual "Risk Meter" or Gauge instead of a simple dot.
2.  **`BorrowCard.tsx`**: Needs "Liquidation Price" display and better tactical button styling.
3.  **`CostPreview.tsx`**: Needs a "Receipt/Timeline" aesthetic for itemized steps.
4.  **`SequenceProgress.tsx`**: Needs Framer Motion animations for state transitions between sequence steps.

## 5. Next Agent Action Items (Priority Order)
Safety/correctness + protocol-coverage tracks are complete (see §3). Remaining:
1.  **Live verification**: exercise the new bridge/protocol/swap integrations against
    real RPC/keys (Circle IRIS, 1Click, CCIP, Morpho/Pendle APIs, `ONEINCH_API_KEY`).
2.  **Visual polish (§4)**: HealthFactor gauge, BorrowCard liquidation price, CostPreview
    receipt aesthetic, SequenceProgress animations — now all backed by real data.
3.  **Rate-limit store**: the in-memory limiter (`lib/server/rateLimit.ts`) is per-instance;
    swap in a shared store (e.g. Upstash Redis) for strict global limits on multi-instance deploys.
4.  **exitPendle amounts**: deposit/bridge steps still use the pre-redemption amount
    (see TODOs in `lib/sequencer/templates/exitPendle.ts`) — recompute between steps.
