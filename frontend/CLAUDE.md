# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Verdant is a discretionary multi-chain DeFi portfolio manager (Next.js 14 App Router, TypeScript) for on-chain power users managing $100K–$10M across Ethereum, Arbitrum, Base, and Solana. The user makes every allocation decision; Verdant makes executing them fast and transparent via an N-step transaction sequencer with mandatory pre-signature simulation. The app and all tooling live in `frontend/` — run every command from there. `SPECS.md` is the product/architecture source of truth. Hard rules that have caused real bugs when ignored live in "Non-negotiable conventions" below; product scope and security guardrails are in "Scope & guardrails".

## Commands

All commands run from `frontend/` (package manager is `bun`):

```bash
bun run dev          # Next dev server (localhost:3000)
bun run build        # production build
bun run lint         # next lint / eslint
bun run check        # Biome lint + format check (read-only); check:fix to apply
bun run format       # Biome format --write
bun run test         # Vitest (run mode)
bun run typecheck    # tsc --noEmit

# Drizzle (DB) — needs DATABASE_URL
bun run db:generate  # generate migration from lib/db/schema.ts
bun run db:migrate   # apply migrations
bun run db:push      # push schema (dev)
bun run db:studio
```

Single test / filtering (do **not** use `bun test` — it bypasses Vitest's config and globals like `vi`):

```bash
bun run test path/to/file.test.ts      # one file
bun run test -t "substring of name"    # by test name
```

CI (`.github/workflows/ci.yml`) runs `bun install --frozen-lockfile`, then lint (ESLint), `check` (Biome), `typecheck`, `test`, and `build` — all five must pass.

Tests mock `server-only` (`vi.mock('server-only', () => ({}))`) and external I/O (`fetch`/`fetchWithTimeout`, RPC `readContract`, data clients). There is no live network in tests.

## Architecture

### Plugin registry pattern — the extensibility core
Every chain, protocol, bridge, and swap aggregator is a self-contained plugin implementing an interface in `lib/plugins/types/`, registered in the matching `lib/plugins/*/index.ts` (`CHAIN_REGISTRY`, `PROTOCOL_REGISTRY`, `BRIDGE_REGISTRY`, `SWAP_REGISTRY`). Core code dispatches through these registries — adding an integration should mean adding one plugin file and one registry line, nothing else.

- **Protocol plugins** expose `fetcher.fetchPositions`, `builder.buildTx`/`describeAction`, and optional `rewards`. They build unsigned txs (viem `encodeFunctionData`) against official protocol ABIs — Verdant deploys **no** custom contracts.
- **Bridge plugins** expose `getQuote` → `buildBridgeTx` → `pollStatus`. `pollStatus(txHash, fromChain, context?)` takes an optional context (e.g. NEAR Intents needs `depositAddress`, threaded from the status route).
- Real integrations call live APIs/RPC (Across, Circle IRIS for CCTP, Chainlink on-chain `getFee`, 1Click for NEAR Intents, Morpho Blue GraphQL, Pendle Convert API, 1inch v6.0, DefiLlama for APYs). Several need server-only keys (e.g. `ONEINCH_API_KEY`) and return `null`/fail-soft when unavailable rather than throwing.

### Request flow & the server-only boundary
Client hooks (`hooks/`) → `app/api/**/route.ts` → `lib/` implementations. **All third-party API keys are server-side only.** Code that touches keys imports `'server-only'` and lives under `app/api/` or `lib/server`/`lib/data`. Only `NEXT_PUBLIC_*` env vars may reach the client bundle.

Server code reads env vars through `lib/server/env.ts` (`getServerEnv()` / `getServerEnvOrWarn()`), never raw `process.env` — it zod-validates, treats blank strings as unset, and logs a one-time warning naming the consequence of a missing key. Exception: `NEXT_PUBLIC_*` vars must stay as literal `process.env.NEXT_PUBLIC_X` reads (Next.js inlines them at build time), so they are deliberately not in the module.

Every route validates input via `lib/validation` helpers (`parse`/`parseQuery`/`parseJson` + primitives like `evmAddressSchema`, `chainSchema`); they return a ready 400 or typed data. Rate limiting (`lib/server/rateLimit.ts`, in-memory **per-instance** — swap for a shared store in multi-instance prod) is applied per SPECS §19 (60/min positions, 10/min simulate + plan).

### Transaction sequencer (the core feature)
A `SequencePlan` is a DAG of `SequenceStep`s (`dependsOn`), persisted in the `sequence_plans` table. `lib/sequencer/engine.ts` owns serialization (BigInt↔string, Date↔ISO), step-selection helpers (`getActiveStep` = next pending step with confirmed deps; `getFocusedStep` = the step the UI should highlight, including simulating/ready/failed), and DAG/cycle validation — put new step-state logic there, not in pages. Templates in `lib/sequencer/templates/` (e.g. `deleverageAave` computes optimal repay/withdraw cycles with BigInt) produce plans. **Template builders must stay client-safe** — no `'server-only'` imports anywhere in their import graph (UI components import them for previews; only `bun run build` catches a violation, not tests or typecheck). Execution is **one step at a time**: a step must pass the mandatory **simulation gate** (`lib/simulation/simulate.ts` — Alchemy `eth_call` + optional Tenderly, Solana via web3.js) before the sign prompt; the next step unlocks only after on-chain confirmation. Cost preview (`lib/costPreview/calculator.ts`) iterates plan steps for itemized gas/bridge/yield breakdown.

There are **two distinct sequence UIs**, both POST `/api/sequencer/plan` — not duplicates: `components/sequence/` is the pre-built **template** flow; `components/sequenceBuilder/` is the freeform **custom** builder.

### Data layer
DB access is Drizzle ORM over `postgres-js` (`lib/db/client.ts` lazy server-only client, `lib/db/schema.ts` typed source of truth). Route handlers contain no raw DB access — typed repositories in `lib/data/*` own all queries. Postgres `numeric` columns arrive as strings; repositories convert to `number` at their boundary. SQL migrations in `supabase/migrations/` are canonical; mirror changes into `lib/db/schema.ts`.

### Positions data flow
`components/positions/PositionsProvider.tsx` owns the single `/api/positions` fetch for a page subtree; `usePositions()` only reads that context and **throws without a provider** — mount `PositionsProvider` above anything that reads positions (the dashboard wraps its whole page, modals included). This exists because `/api/positions` is rate-limited (60/min) and an un-deduped fetch-per-card self-inflicts 429s.

### Demo mode
`NEXT_PUBLIC_DEMO_MODE` is a build-time constant. `useWallet`/`useSequencer`/`useSequenceCost` branch at the top to `useDemo*` variants (fixtures in `lib/demo/`) to avoid conditional-hook violations; for positions the branch lives inside `PositionsProvider`. Demo mocks only wallet + transaction execution; read-only data (APYs, destinations) still hits real APIs.

### Design system ("Field Ledger")
Light-only warm-parchment theme. `tailwind.config.ts` is the **single source of truth for every color token** (`verdant.*`: moss/teak/pine/paper/rule/profit/loss/caution/chain) — raw CSS (`app/globals.css`, `components/sequence/fieldLedger.module.css`) resolves colors via Tailwind's `theme()` function, never literal hexes (Biome's CSS `noUnknownFunction` rule is off for this). Shared recipes live in `globals.css` `@layer components`: buttons (`.btn` + `.btn-primary/secondary/danger/outline/ghost`, sizes `.btn-sm/lg`), form fields (`.field-label`, `.field-input`), and Field Ledger signatures (`.fl-serif`, `.fl-numeral`, `.fl-eyebrow`, `.fl-double-rule` — Fraunces serif for headings/numerals; Geist Mono owns all financial data). Reusable primitives are in `components/ui/` (`Card`, `Modal`, `WarningBanner`, `Spinner` with `tone="onDark"`, `Badge`, `HealthFactor`, `Tooltip`) — use these instead of hand-rolling their styles; past drift between inline copies and the shared versions is exactly what they exist to prevent. `DESIGN.md` predates this system (older palette values, no serif) — trust `tailwind.config.ts` + `globals.css` where they disagree.

## Non-negotiable conventions (these have caused real bugs)

- **Never ship a stubbed route or plugin** that returns fake success. A route must call the real `lib/` implementation; simulation must actually simulate.
- **No `as any` / `as unknown as X`** to silence types. The only allowed cast is to a named type with a comment explaining why (e.g. validated-JSON → build-param union, re-checked at execution).
- **Registries contain only named imports** — never inline plugin object literals.
- **Before deleting any file, grep for importers** (`grep -rn "the-file" --include=*.ts --include=*.tsx`) and fix them in the same change.
- **Adding a new chain requires updating all of:** `lib/plugins/chains/{chain}.ts`, `lib/plugins/chains/index.ts`, `lib/server/rpc.ts`, `lib/simulation/simulate.ts`, `lib/wagmi.ts` (EVM only), `lib/plugins/tokens.ts`. Missing one breaks a different layer silently.
- **Pages render client-side** (wallet-gated pages return `null` until mounted) — the SSR HTML is a shell, so `curl`/grep against a running dev server proves nothing about the UI. Verify rendering in a real browser.

## Scope & guardrails

Verdant is **discretionary** — the user makes every allocation decision. Never build autonomous behavior. **Out of scope (do not build):** vaults / LP deposits / NAV accounting, any novel smart contracts (use only audited protocol ABIs — Verdant deploys none), yield discovery or strategy recommendations, autonomous rebalancing, batched atomic cross-chain execution (all steps are sequential), and a mobile app.

Security constraints:
- **Never request, store, or log** private keys or seed phrases, and never hold user funds in a Verdant-controlled address.
- **Simulate before every signature** — a step reaches the sign prompt only after passing the simulation gate, and the next step unlocks only after on-chain confirmation.
- **Sensitive API keys are server-side only** — never exposed to the client bundle (see the server-only boundary above).
