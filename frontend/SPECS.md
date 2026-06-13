# Verdant — Full Product Specification & Milestones (v3)

> **Spec version:** 3 — Expanded scope: Base chain, Solana, full position type coverage, complex
> transaction sequences, modular plugin architecture, sequential transaction execution with simulation.  
> **Based on:** Existing SPECS.md (v2), AGENTS.md, codebase analysis.  
> **Intended consumers:** AI coding agents generating GitHub tickets and tasks.  
> **Rev 2026-06-06:** Database access migrated to Drizzle ORM (typed schema + repositories);
> request validation consolidated into shared zod helpers. See §2.6, §14, §15, §18.  
> **Rev 2026-06-13:** Reconciled spec with implementation. Added the swap-aggregator plugin
> subsystem (1inch / `SWAP_REGISTRY`, §3.5) and Chainlink CCIP bridge (§10.2, §10.5); corrected
> the CCTP bridge to Circle CCTP v2 + IRIS (§10.3) and NEAR Intents to Defuse/1Click (§10.4);
> corrected shared/sequencer type paths to `types/` (§3, §9.1); refreshed env vars (§18),
> rate-limit store options (§19), page/component inventory (§16), and milestone status (§20).

---

## Table of Contents

1. [Product Vision & Scope](#1-product-vision--scope)
2. [Architecture Principles](#2-architecture-principles)
3. [Plugin System — The Extensibility Core](#3-plugin-system--the-extensibility-core)
4. [Supported Networks](#4-supported-networks)
5. [Supported Position Types](#5-supported-position-types)
6. [Supported Protocols (MVP)](#6-supported-protocols-mvp)
7. [Wallet & Connection Layer](#7-wallet--connection-layer)
8. [Position Aggregation Layer](#8-position-aggregation-layer)
9. [Transaction Sequencer](#9-transaction-sequencer)
10. [Bridge & Cross-Chain Routing](#10-bridge--cross-chain-routing)
11. [Transaction Simulation](#11-transaction-simulation)
12. [Cost Preview Engine](#12-cost-preview-engine)
13. [Data Sources & APIs](#13-data-sources--apis)
14. [Database Schema](#14-database-schema)
15. [API Routes](#15-api-routes)
16. [Frontend Pages & Components](#16-frontend-pages--components)
17. [Error Handling Standards](#17-error-handling-standards)
18. [Environment Variables](#18-environment-variables)
19. [Security Constraints](#19-security-constraints)
20. [Milestones & Build Order](#20-milestones--build-order)
21. [Out of Scope](#21-out-of-scope)
22. [Definition of Done](#22-definition-of-done)

---

## 1. Product Vision & Scope

**Verdant** is a discretionary multi-chain DeFi portfolio manager for power users managing
$100K–$10M. It surfaces all of a wallet's positions across every major position type (tokens, LP,
vault deposits, lending, staking, Pendle, borrows), and lets the user construct and execute
multi-step transaction sequences — such as de-leveraging an Aave loop, bridging proceeds, and
re-depositing into Morpho on another chain — with full cost transparency and mandatory simulation
before any signature is requested.

**The user retains custody and control at all times.** Verdant constructs, simulates, and sequences
transactions; the user signs each one individually. No autonomous execution. No custodial
infrastructure.

### v3 Expanded Goals vs. v2

| Area | v2 (Existing) | v3 (This Spec) |
|---|---|---|
| EVM chains | Ethereum, Arbitrum | + Base |
| Non-EVM | None | + Solana |
| Position types | Supply/deposit only | All types (LP, vault, borrow, staking, Pendle, wallet tokens) |
| Tx model | 2-step bridge+deposit | N-step sequencer for complex flows |
| Transaction signing | One by one (already planned) | One by one, with simulation gate before each |
| Wallet support | MetaMask, WalletConnect | + Phantom, Ledger |
| Code extensibility | Implicit | Explicit plugin registry for chains and protocols |

---

## 2. Architecture Principles

### 2.1 Plugin Registry Pattern

Every chain and every protocol is a **plugin** — a self-contained module that conforms to a
standard interface. Adding a new chain means adding one plugin file and registering it. Adding a
new protocol means adding one plugin file and registering it. No core code changes required.

See Section 3 for the full plugin interface specification.

### 2.2 No Novel Smart Contracts

Verdant deploys zero custom smart contracts in this phase. All on-chain interactions use official,
audited ABIs from each protocol's own repository. This eliminates audit risk.

### 2.3 Sequential Signing, Never Batched

Transactions are executed one at a time. The user signs each step individually. The sequencer
tracks state and enables the next step only after the previous transaction confirms on-chain. This
is a deliberate safety and compatibility choice — no custom smart contract batch executor needed.

### 2.4 Simulate Before Every Signature

Every transaction must pass a simulation gate before the sign prompt is shown to the user.
Simulation failures surface the revert reason in plain English. The sign button is never shown if
simulation fails.

### 2.5 API Key Safety

All third-party API keys (Zerion, Alchemy, etc.) are server-side only. They are never included in
client bundles. All sensitive data fetches are proxied through Next.js API routes.

### 2.6 Separation of Concerns

```
Position Layer   — Read wallet state (Zerion, protocol SDKs, Solana RPC)
Sequencer Layer  — Plan and track multi-step transaction flows
Simulation Layer — Validate each step before signing
Bridge Layer     — Cross-chain routing (Across, Circle CCTP, NEAR Intents, Chainlink CCIP)
Swap Layer       — Same-chain DEX-aggregator quotes/tx (1inch) via plugins
Protocol Layer   — Per-protocol tx builders (Aave, Morpho, etc.) via plugins
Data Layer       — Typed DB access via Drizzle ORM (lib/db) + repositories (lib/data)
Validation Layer — Shared zod schemas + request helpers (lib/validation)
UI Layer         — Display, cost preview, step-by-step signing flow
```

---

## 3. Plugin System — The Extensibility Core

This section defines the interfaces that all chain and protocol plugins must implement. Every
agent writing protocol or chain code must conform to these interfaces exactly.

### 3.1 Chain Plugin Interface

```typescript
// lib/plugins/types/chain-plugin.ts

export interface ChainPlugin {
  /** Unique identifier used throughout the codebase */
  id: ChainId
  /** Human-readable name */
  displayName: string
  /** EIP-155 chain ID for EVM; 'solana-mainnet' string for Solana */
  chainIdOrNetwork: number | string
  /** Chain family — determines which wallet adapters apply */
  family: 'evm' | 'solana'
  /** Block explorer base URL */
  explorerUrl: string
  /** Native currency */
  nativeCurrency: { symbol: string; decimals: number }
  /** Supported bridgeable tokens on this chain */
  bridgeableTokens: TokenSymbol[]
  /**
   * Returns a viem PublicClient (EVM) or Connection (Solana).
   * RPC URL is constructed server-side only.
   */
  getRpcClient(): Promise<PublicClient | Connection>
  /** Estimate gas cost in USD for a given tx */
  estimateGasCostUsd(tx: unknown): Promise<number>
}
```

**Registering a new chain:**

```typescript
// lib/plugins/chains/index.ts
import { ethereumPlugin } from './ethereum'
import { arbitrumPlugin } from './arbitrum'
import { basePlugin } from './base'
import { solanaPlugin } from './solana'

export const CHAIN_REGISTRY: Record<ChainId, ChainPlugin> = {
  ethereum: ethereumPlugin,
  arbitrum: arbitrumPlugin,
  base: basePlugin,
  solana: solanaPlugin,
}
```

To add a new chain: create `lib/plugins/chains/{chainName}.ts`, implement `ChainPlugin`, add to
`CHAIN_REGISTRY`. No other files change.

### 3.2 Protocol Plugin Interface

```typescript
// lib/plugins/types/protocol-plugin.ts

export interface PositionFetcher {
  /**
   * Given a wallet address and chain, return all positions for this protocol
   * on that chain. Return empty array if protocol not deployed on chain.
   */
  fetchPositions(address: string, chain: ChainId): Promise<RawPosition[]>
}

export interface TxBuilder {
  /**
   * Build an unsigned transaction for a given action.
   * Returns array because some actions require multiple steps
   * (e.g., approve + deposit).
   */
  buildTx(params: TxBuildParams): Promise<UnsignedTx[]>
  /** Human-readable description of what this tx does */
  describeAction(params: TxBuildParams): string
}

export interface RewardFetcher {
  /** Returns claimable rewards for a given position */
  fetchRewards(address: string, chain: ChainId): Promise<Reward[]>
  /** Build claim transaction */
  buildClaimTx(params: ClaimParams): Promise<UnsignedTx[]>
}

export interface ProtocolPlugin {
  id: ProtocolId
  displayName: string
  /** Chains this protocol is deployed on */
  supportedChains: ChainId[]
  /** Position types this protocol supports */
  supportedPositionTypes: PositionType[]
  /** Defillama slug for APY lookups */
  defillamaSlug: string
  /** Pool/vault addresses per chain */
  addresses: Partial<Record<ChainId, ProtocolAddresses>>
  fetcher: PositionFetcher
  builder: TxBuilder
  rewards?: RewardFetcher
}
```

**Registering a new protocol:**

```typescript
// lib/plugins/protocols/index.ts
export const PROTOCOL_REGISTRY: Record<ProtocolId, ProtocolPlugin> = {
  aave:    aavePlugin,
  morpho:  morphoPlugin,
  pendle:  pendlePlugin,
  euler:   eulerPlugin,
  // Add new protocols here only
}
```

### 3.3 Bridge Plugin Interface

```typescript
// lib/plugins/types/bridge-plugin.ts

export interface BridgePlugin {
  id: BridgeId
  displayName: string
  /** Token symbols this bridge supports */
  supportedTokens: TokenSymbol[]
  /** Chain pairs this bridge supports */
  supportedRoutes: Array<{ from: ChainId; to: ChainId }>
  /** Get a quote. Returns null if route unsupported. */
  getQuote(params: BridgeQuoteParams): Promise<BridgeQuote | null>
  /** Build the bridge initiation transaction */
  buildBridgeTx(quote: BridgeQuote): Promise<UnsignedTx>
  /**
   * Poll for bridge completion. `context` carries bridge-specific data threaded from the
   * status route — e.g. NEAR Intents needs the `depositAddress`.
   */
  pollStatus(txHash: string, fromChain: ChainId, context?: BridgeStatusContext): Promise<BridgeStatus>
}
```

### 3.4 Shared Types

> Shared types live in `types/shared.ts` (imported as `@/types/shared`); sequencer types in
> `types/sequencer.ts`. The plugin **interfaces** above live in `lib/plugins/types/`.

```typescript
// types/shared.ts

export type ChainId = 'ethereum' | 'arbitrum' | 'base' | 'solana'
export type ProtocolId = 'aave' | 'morpho' | 'pendle' | 'euler' | string
export type BridgeId = 'across' | 'layerzero' | 'nearIntents' | 'chainlink'
export type TokenSymbol = 'ETH' | 'USDC' | 'USDT' | 'WBTC' | 'wstETH' | 'SOL' | string

export type PositionType =
  | 'wallet'      // Plain token balance
  | 'supply'      // Lending supply / vault deposit
  | 'borrow'      // Active borrow
  | 'lp'          // Liquidity provider position
  | 'stake'       // Staking (single-asset or veToken)
  | 'pendle-pt'   // Pendle Principal Token
  | 'pendle-yt'   // Pendle Yield Token
  | 'farm'        // LP + staked in farm/gauge

export interface RawPosition {
  id: string
  protocol: ProtocolId
  chain: ChainId
  asset: string
  assetAddress: string
  amount: number
  amountUsd: number
  currentApy: number
  positionType: PositionType
  claimableRewards: Reward[]
  metadata: Record<string, unknown>
}

export interface UnsignedTx {
  chainId: ChainId
  to: string
  data: string
  value: bigint
  /** Human-readable description for UI */
  description: string
  /** Estimated gas limit */
  gasLimit?: bigint
}

export interface TxBuildParams {
  action: 'supply' | 'withdraw' | 'borrow' | 'repay' | 'stake' | 'unstake' | 'claim'
  protocol: ProtocolId
  chain: ChainId
  asset: string
  amount: string    // in token units as string (no float)
  userAddress: string
  extraParams?: Record<string, unknown>
}

export interface BridgeQuoteParams {
  fromChain: ChainId
  toChain: ChainId
  token: TokenSymbol
  amount: string
  recipientAddress: string
}

export interface BridgeQuote {
  bridgeId: BridgeId
  feeUsd: number
  estimatedTimeSeconds: number
  expectedOutputAmount: string
  slippagePercent: number
  expiresAt: Date
  rawQuote: unknown
}

export interface BridgeStatus {
  status: 'pending' | 'complete' | 'failed'
  destinationTxHash?: string
  errorMessage?: string
}
```

### 3.5 Swap Plugin Interface

Same-chain token swaps (e.g. swapping bridged ETH into USDC before a deposit) are handled by
DEX-aggregator plugins, parallel to the bridge plugins.

```typescript
// lib/plugins/types/swap-plugin.ts

export interface SwapQuoteParams {
  fromChain: ChainId
  fromToken: string
  toToken: string
  amount: string            // human units
  userAddress: string
  slippagePercent: number
}

export interface SwapQuote {
  aggregator: string
  fromToken: string
  toToken: string
  fromAmount: string
  toAmount: string          // expected output, human units
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

**Registering a swap aggregator:**

```typescript
// lib/plugins/swaps/index.ts
import { oneinchPlugin } from './oneinch'

export const SWAP_REGISTRY: Record<string, SwapPlugin> = {
  '1inch': oneinchPlugin,
}
```

The only aggregator in MVP is **1inch v6.0** (`lib/plugins/swaps/oneinch.ts`, server-side Bearer
auth via `ONEINCH_API_KEY`; the swap option is simply unavailable when the key is unset). Swap
steps are added through the freeform custom builder (`components/sequenceBuilder/SwapCard.tsx`) and
their unsigned txs are resolved against `SWAP_REGISTRY` during sequencer step simulation.

---

## 4. Supported Networks

### 4.1 EVM Chains

| Chain | Chain ID | Family | RPC | Added |
|---|---|---|---|---|
| Ethereum Mainnet | 1 | EVM | Alchemy | v2 |
| Arbitrum One | 42161 | EVM | Alchemy | v2 |
| Base | 8453 | EVM | Alchemy | **v3 new** |

Plugin files: `lib/plugins/chains/ethereum.ts`, `arbitrum.ts`, `base.ts`

### 4.2 Solana

| Network | Family | RPC | Added |
|---|---|---|---|
| Solana Mainnet | Solana | Alchemy RPC (or Helius free tier) | **v3 new** |

Plugin file: `lib/plugins/chains/solana.ts`

Solana uses `@solana/web3.js` `Connection` instead of viem `PublicClient`. The chain plugin
interface accommodates both via the union return type on `getRpcClient()`.

### 4.3 wagmi Config Update

```typescript
// lib/wagmi.ts
import { mainnet, arbitrum, base } from 'viem/chains'

export const wagmiConfig = getDefaultConfig({
  appName: 'Verdant',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '<fallback id>',
  chains: [mainnet, arbitrum, base],   // Base added
  ssr: true,
})
// The config is cached on a typed globalThis reference to survive Fast Refresh.
```

---

## 5. Supported Position Types

All position types must be surfaced in the dashboard. Each position card adapts its display based
on `positionType`.

| Position Type | Description | Display Fields | Protocols |
|---|---|---|---|
| `wallet` | Plain token balance | Token, amount, USD value | N/A (Zerion) |
| `supply` | Lending supply or vault deposit | Protocol, asset, APY, USD value | Aave, Morpho, Euler |
| `borrow` | Active borrow | Protocol, asset, debt amount, borrow APY, health factor | Aave, Euler |
| `lp` | Liquidity provider | Pool pair, USD value, fees earned, IL estimate | Uniswap V3 (read-only v3) |
| `stake` | Single-asset or veToken stake | Asset, locked amount, unlock date if applicable | (future) |
| `pendle-pt` | Pendle Principal Token | Fixed APY, maturity date, underlying | Pendle |
| `pendle-yt` | Pendle Yield Token | Implied APY, maturity date | Pendle |
| `farm` | LP deposited in gauge/farm | Pool pair, farm APR, pending rewards | (future) |

In v3 MVP the focus is on: `wallet`, `supply`, `borrow`, `pendle-pt`, `pendle-yt`. LP read display
is a stretch goal. Stake and farm are future.

---

## 6. Supported Protocols (MVP)

### 6.1 Protocol Table

| Protocol | Chains | Position Types | SDK / Integration | v3 Notes |
|---|---|---|---|---|
| Aave V3 | Ethereum, Arbitrum, Base | supply, borrow | `@aave/contract-helpers`, `@aave/math-utils` | Add Base |
| Morpho | Ethereum, Arbitrum, Base | supply | `@morpho-org/morpho-ts`, subgraph | Add Base |
| Pendle | Ethereum, Arbitrum | pendle-pt, pendle-yt | Pendle Hosted SDK (`api-v2.pendle.finance`) | Unchanged |
| Euler | Ethereum, Arbitrum | supply, borrow | Euler EVK SDK, official ABIs | Unchanged |

### 6.2 Borrow Position Requirements (new in v3)

Borrow positions must display:
- Debt amount in token and USD
- Borrow APY
- **Health factor** with colour coding: green >2.0, amber 1.2–2.0, red <1.2
- **Liquidation price** for the collateral asset
- Warning banner if health factor <1.5

The transaction sequencer must support repay actions. A "de-leverage" sequence for an Aave loop
involves: `repay → withdraw collateral → repay → withdraw collateral → ...` repeated until
fully unwound.

### 6.3 Aave Leverage Loop Unwind Sequence (Example)

A user with a recursive ETH/USDC loop on Aave needs the sequencer to automatically compute the
minimum number of repay/withdraw cycles to fully exit. The sequencer:

1. Reads current health factor and collateral/debt positions via Aave subgraph
2. Calculates how much can be repaid in each cycle without triggering liquidation
3. Emits a `SequencePlan` listing each step: `[repay USDC, withdraw ETH, repay USDC, ...]`
4. User reviews the plan
5. Each step is simulated and signed individually

---

## 7. Wallet & Connection Layer

### 7.1 EVM Wallets

**Library:** RainbowKit v2 + wagmi v2 + viem v2

| Wallet | Connection Method | Priority |
|---|---|---|
| MetaMask | Injected | P0 |
| WalletConnect v2 | WalletConnect | P0 |
| Ledger | WalletConnect / Ledger Live | P0 |
| Rabby | Injected | P1 |
| Coinbase Wallet | WalletConnect / Injected | P1 |

### 7.2 Solana Wallets

**Library:** `@solana/wallet-adapter-react`, `@solana/wallet-adapter-wallets`

| Wallet | Priority |
|---|---|
| Phantom | P0 |
| Ledger (Solana) | P0 |
| Solflare | P1 |

### 7.3 Multi-Chain Session

A user may connect both an EVM wallet and a Solana wallet in the same session. The dashboard
aggregates positions from both. The session stores:

```typescript
interface WalletSession {
  evm?: { address: `0x${string}`; chainId: number }
  solana?: { publicKey: string }
}
```

Positions are fetched for whichever wallets are connected. If only EVM is connected, Solana
positions section shows a "Connect Solana wallet" prompt.

---

## 8. Position Aggregation Layer

### 8.1 Overview

Position data comes from two primary sources, merged and normalised into the unified `RawPosition`
type:

1. **Zerion API** — wallet tokens + high-level protocol positions for EVM chains
2. **Protocol Plugin fetchers** — protocol-specific SDK calls for richer data (health factor,
   exact debt, claimable rewards, Pendle maturity)
3. **Solana RPC** — SPL token balances + Solana DeFi positions (via protocol plugins for Solana)

The aggregation layer merges these, deduplicates, and enriches with USD prices from Defillama.

### 8.2 Zerion Integration (EVM)

**Endpoint:** `GET /v1/wallets/{address}/positions/?include=fungible`

**Supported position types via Zerion filter:**

```
filter[position_types]=wallet,deposited,borrowed,staked
filter[chain_ids]=ethereum,arbitrum,base
filter[dapp_ids]=aave-v3,morpho,pendle,euler-v2
```

Note: Zerion coverage is used as a fast starting point. Protocol SDK fetchers are run in parallel
to enrich with data Zerion doesn't surface (health factors, exact claimable rewards, Pendle PT/YT
metadata, borrow APY).

### 8.3 Solana Position Fetching

Solana positions are fetched by Solana protocol plugins. MVP scope:

- SPL token balances via `getParsedTokenAccountsByOwner`
- No Solana DeFi protocol plugins in v3 MVP — infrastructure only, positions show wallet tokens

This means the Solana plugin infra is built and functional, but protocol-level positions
(e.g., MarginFi, Kamino, Raydium LP) are post-MVP. The architecture makes adding them trivial.

### 8.4 Position Normalisation Pipeline

```
Zerion raw positions
      │
      ▼
zerionNormaliser()     → RawPosition[]
      │
Protocol SDK fetchers  → RawPosition[] (enriched)
      │
Solana RPC fetcher     → RawPosition[] (SPL tokens)
      │
      ▼
deduplicatePositions() → removes positions covered by both Zerion and protocol SDK
      │
enrichWithPrices()     → adds USD values using Defillama Coins API
      │
      ▼
Position[]             → returned to client via /api/positions
```

### 8.5 Unified Position Type

```typescript
// types/position.ts  (v3 — extends v2)

export interface Position extends RawPosition {
  // Enriched fields added by aggregation pipeline
  priceUsd: number           // current token price
  percentChange24h?: number  // from Defillama
  // Borrow-specific
  healthFactor?: number
  liquidationPrice?: number
  borrowApy?: number
  // Pendle-specific
  maturityDate?: Date
  fixedApy?: number          // for PT
  impliedApy?: number        // for YT
  underlyingAsset?: string
  // LP-specific (future)
  token0?: string
  token1?: string
  feeTier?: number
}
```

---

## 9. Transaction Sequencer

This is the core new feature of v3. It replaces the simple 2-step execute flow with a general
N-step sequencer capable of handling complex position migrations.

### 9.1 SequencePlan Type

```typescript
// types/sequencer.ts  (imported as @/types/sequencer)

export type StepStatus = 'pending' | 'simulating' | 'ready' | 'signing' | 'confirmed' | 'failed'

export interface SequenceStep {
  id: string
  /** Human-readable label e.g. "Repay 5,000 USDC on Aave" */
  label: string
  /** Which chain this step executes on */
  chain: ChainId
  /** The unsigned transaction (populated after simulation) */
  unsignedTx?: UnsignedTx
  /** Simulation result */
  simulation?: SimulationResult
  status: StepStatus
  txHash?: string
  /** Steps that must complete before this step can start */
  dependsOn: string[]
  /** The plugin that builds this tx */
  pluginId: ProtocolId | BridgeId
  buildParams: TxBuildParams | BridgeQuoteParams
}

export interface SequencePlan {
  id: string
  walletAddress: string
  createdAt: Date
  steps: SequenceStep[]
  status: 'draft' | 'in-progress' | 'complete' | 'failed'
  totalCostUsd: number
  /** Summary for display e.g. "De-leverage Aave ETH loop → Morpho Base" */
  description: string
}
```

### 9.2 Sequence Templates

Pre-built sequence templates the user can select from:

| Template | Steps | Chains |
|---|---|---|
| Bridge & Deposit | Bridge → Deposit | Any 2 EVM chains |
| De-leverage Aave Loop | Repay × N → Withdraw → Bridge → Deposit | EVM → EVM |
| Exit Pendle PT | Redeem PT → Bridge (optional) → Deposit | EVM → EVM |
| Aave Repay & Withdraw | Repay borrow → Withdraw collateral | Same chain |
| Cross-chain Rebalance | Withdraw → Bridge → Deposit | Any 2 EVM chains |

Templates are defined in `lib/sequencer/templates/` as functions that take user inputs and return
a `SequencePlan`.

### 9.3 Sequencer State Machine

```
DRAFT
  │ (user reviews plan)
  ▼
SIMULATING step[0]
  │ (simulation passes)
  ▼
READY (sign button enabled for step[0])
  │ (user signs)
  ▼
SIGNING step[0]
  │ (tx submitted)
  ▼
CONFIRMED step[0]
  │ (simulate step[1])
  ▼
SIMULATING step[1]
  │ ...
  ▼
COMPLETE (all steps confirmed)
```

On simulation failure: step moves to `failed`, user sees revert reason, can edit parameters or
abort.

On tx failure (on-chain revert): step moves to `failed`, sequencer pauses, user sees error and
recovery options.

### 9.4 Sequencer Hook

```typescript
// hooks/useSequencer.ts

interface UseSequencerReturn {
  plan: SequencePlan | null
  currentStep: SequenceStep | null
  createPlan(template: TemplateId, params: TemplateParams): Promise<SequencePlan>
  simulateStep(stepId: string): Promise<SimulationResult>
  executeStep(stepId: string): Promise<string> // returns txHash
  reset(): void
}
```

### 9.5 Sequencer API Routes

See **§15.3** for the authoritative request/response contracts (all ownership-checked and
DB-backed): `POST /api/sequencer/plan` (template **and** custom-plan bodies),
`POST /api/sequencer/simulate` (`{ planId, stepId, walletAddress }`), `POST /api/sequencer/cost`,
`GET /api/sequencer/plan/{planId}`, and `PATCH /api/sequencer/plan/{planId}/step/{stepId}`.

---

## 10. Bridge & Cross-Chain Routing

### 10.1 Supported Bridges

| Bridge | Supported Tokens | Supported Routes | Notes |
|---|---|---|---|
| Across Protocol | ETH, USDC, USDT, WBTC | ETH↔ARB, ETH↔Base, ARB↔Base | Primary EVM bridge |
| Circle CCTP v2 (`layerzero` id) | USDC | ETH↔ARB, ETH↔Base, ARB↔Base | Canonical USDC, EVM-only; fees/status via Circle IRIS (§10.3) |
| NEAR Intents | ETH, USDC, SOL | ETH↔SOL, ARB↔SOL, Base↔SOL | EVM→Solana primary (Defuse/1Click) |
| Chainlink CCIP | LINK, USDC, ETH | ETH↔ARB, ETH↔Base, ARB↔Base | Secure institutional-grade EVM bridge |

**Token bridge matrix:**

| Token | ETH→ARB | ETH→Base | ARB→Base | Any→Solana |
|---|---|---|---|---|
| ETH/WETH | Across | Across | Across | NEAR Intents |
| USDC | Across / CCTP / CCIP | Across / CCTP / CCIP | Across / CCTP / CCIP | NEAR Intents |
| USDT | Across | Across | Across | — |
| WBTC | Across | Across | — | — |
| SOL | — | — | — | N/A (native) |

### 10.2 Bridge Selection Logic

When a user needs to bridge, the system:

1. Queries all eligible bridges for the route+token simultaneously
2. Returns quotes sorted by net output (after fees)
3. User sees all options with fees, time, and provider
4. User selects preferred bridge (default: best net output)

```typescript
// lib/plugins/bridges/index.ts
export const BRIDGE_REGISTRY: Record<BridgeId, BridgePlugin> = {
  across:      acrossBridgePlugin,
  nearIntents: nearIntentsBridgePlugin,
  layerzero:   layerzeroBridgePlugin,   // Circle CCTP v2 for USDC (see §10.3)
  chainlink:   chainlinkBridgePlugin,   // Chainlink CCIP (see §10.5)
}
```

### 10.3 USDC Bridge — Circle CCTP v2 (`layerzero` plugin)

Plugin file: `lib/plugins/bridges/layerzero.ts` (registry id `layerzero`, retained for compatibility)

- Implements **Circle CCTP v2** for canonical USDC transfers across EVM chains — it builds a
  `depositForBurn` against the `TokenMessengerV2` contract (same canonical address on each chain),
  using Circle CCTP **domain IDs** (Ethereum 0, Arbitrum 3, Base 6), not EVM chain IDs.
- **Fees and attestation/status** come from Circle's **IRIS API** (`iris-api.circle.com`), not a
  LayerZero endpoint.
- `@layerzerolabs/*` packages remain installed but the live USDC path is Circle CCTP.

### 10.4 NEAR Intents Integration (EVM → Solana)

Plugin file: `lib/plugins/bridges/nearIntents.ts`

- Handles EVM-to-Solana (and EVM↔EVM) token transfers; recipient must be valid for the dest chain.
- Uses the **Defuse** solver RPC (`bridge.chaindefuser.com/rpc`) for quotes/deposit and the
  **1Click** REST API (`1click.chaindefuser.com`) for swap status.
- SDK: `@defuse-protocol/intents-sdk` (key via `NEAR_INTENTS_API_KEY`).

### 10.5 Chainlink CCIP Integration

Plugin file: `lib/plugins/bridges/chainlink.ts` (registry id `chainlink`)

- Chainlink CCIP for cross-chain transfers across the supported EVM chains.
- Quotes the bridge fee on-chain via the CCIP router's `getFee` (no off-chain quote API key).
- Positioned as the secure/institutional-grade EVM↔EVM option in `getBridgeQuotes()`.

---

## 11. Transaction Simulation

### 11.1 Simulation Gate

Every step in a sequence must be simulated before the sign button appears. This is enforced in the
sequencer state machine — the `ready` state is only reached after a successful simulation.

### 11.2 Simulation Methods

**EVM Simulation:**

Primary: `eth_call` via Alchemy RPC (free tier)
- Simulates the transaction and returns success or revert data
- Decodes revert reason using ABI error selectors where possible
- Returns state diffs for display (optional enhancement)

Fallback: Tenderly Simulation API (if `TENDERLY_ACCESS_KEY` is set)
- Richer state diffs and human-readable revert reasons
- Optional — system works without it

**Solana Simulation:**

`simulateTransaction` via Solana RPC
- Returns logs and error message on failure

### 11.3 SimulationResult Type

```typescript
// lib/simulation/types.ts

export interface SimulationResult {
  success: boolean
  revertReason?: string       // human-readable if decoding succeeded
  revertData?: string         // raw hex
  gasEstimate?: bigint        // EVM only
  gasCostUsd?: number
  stateChanges?: StateChange[] // token balance changes
  simulatedAt: Date
}

export interface StateChange {
  token: string
  address: string
  balanceDelta: string  // positive = receive, negative = send
  balanceDeltaUsd: number
}
```

### 11.4 Simulation API Route

```
POST /api/simulate
Body: {
  chain: ChainId
  tx: UnsignedTx
  fromAddress: string
}
Returns: SimulationResult
```

### 11.5 Simulation Display

Before showing the sign button, display:

```
┌─────────────────────────────────────────────┐
│  Simulation: ✓ Passed                        │
│                                              │
│  You will send:   5,000 USDC                 │
│  You will receive: 5,000 aUSDC (Aave)        │
│  Gas cost:        $0.42                      │
│                                              │
│  [Sign Transaction]                          │
└─────────────────────────────────────────────┘
```

On failure:

```
┌─────────────────────────────────────────────┐
│  Simulation: ✗ Failed                        │
│                                              │
│  "Insufficient allowance"                    │
│                                              │
│  This transaction would revert. Check your   │
│  token approval and try again.               │
│                                              │
│  [Edit Parameters]                           │
└─────────────────────────────────────────────┘
```

---

## 12. Cost Preview Engine

This is the hero feature. Displayed before any step in a sequence is signed.

### 12.1 For Cross-Chain Sequences

```
┌─────────────────────────────────────────────┐
│  De-leverage Aave ETH/USDC → Morpho Base     │
│  3 EVM transactions + 1 bridge               │
├─────────────────────────────────────────────┤
│  COSTS                                       │
│  Step 1: Repay USDC (Ethereum)    $1.20 gas  │
│  Step 2: Withdraw ETH (Ethereum)  $0.80 gas  │
│  Step 3: Bridge ETH (Eth→Base)    $8.40 fee  │
│  Step 4: Deposit (Base)           $0.05 gas  │
│  ──────────────────────────────────────────  │
│  Total cost                       $10.45     │
├─────────────────────────────────────────────┤
│  YIELD                                       │
│  Current net APY (leveraged)       12.4%     │
│  Target APY (Morpho Base USDC)      8.2%     │
│  Note: De-leveraging reduces net APY         │
├─────────────────────────────────────────────┤
│  Quotes refreshed 12s ago  [Refresh]         │
│                    [Cancel]  [Begin Sequence]│
└─────────────────────────────────────────────┘
```

### 12.2 CostPreviewResult Type

```typescript
// lib/costPreview/types.ts  (v3 extension)

export interface StepCost {
  stepLabel: string
  chain: ChainId
  gasCostUsd: number
  bridgeFeeUsd?: number
  slippageUsd?: number
}

export interface CostPreviewResult {
  steps: StepCost[]
  totalCostUsd: number
  currentApyDecimal: number
  targetApyDecimal: number
  netUpliftDecimal: number | null    // null if de-leveraging (complex comparison)
  dailyYieldGainUsd: number | null
  breakEvenDays: number | null
  quoteFetchedAt: Date
  warnings: Warning[]
  bridgeOptions?: BridgeQuote[]     // shown when bridge step exists
}
```

### 12.3 Warning Conditions

| Condition | Warning Text | Severity |
|---|---|---|
| Bridge fee > 0.5% of tx value | "Bridge fee is {X}% of transaction" | amber |
| Slippage > 0.5% | "Estimated slippage is {X}%" | amber |
| Break-even > 30 days | "You need {X} days to recover switching costs" | amber |
| Pendle PT maturity < 30 days | "PT matures in {X} days" | red |
| Target protocol utilisation > 90% | "Pool is {X}% utilised — withdraw may be slow" | red |
| Aave health factor would drop below 1.5 | "This sequence brings health factor to {X}" | red |
| Bridge quote expired | "Quotes have expired. Please refresh." | red |

---

## 13. Data Sources & APIs

| Data | Provider | Endpoint | Free Tier | Fallback |
|---|---|---|---|---|
| EVM positions (high-level) | Zerion API | `/v1/wallets/{addr}/positions/` | 3,000 req/day | viem direct read |
| Solana token balances | Alchemy / Helius | `getParsedTokenAccountsByOwner` | Free (Alchemy) | Solana public RPC |
| Protocol APYs | Defillama Yields | `yields.llama.fi/pools` | Free, unlimited | Protocol subgraphs |
| Token prices | Defillama Coins | `coins.llama.fi/prices/current` | Free, unlimited | CoinGecko free |
| EVM RPC | Alchemy | Chain-specific URL | 300M CU/month | Public RPC (fallback) |
| Bridge quotes/status | Across API | `app.across.to/api/suggested-fees`, `/api/deposits/status` | Free | — |
| USDC bridge (CCTP) fees/attestation | Circle IRIS | `iris-api.circle.com` | Free | — |
| Bridge quotes/status | NEAR Intents | Defuse RPC `bridge.chaindefuser.com/rpc` + 1Click `1click.chaindefuser.com` | Free | — |
| EVM↔EVM bridge fee | Chainlink CCIP | Router `getFee` (on-chain) | Free | — |
| Same-chain swap quotes/tx | 1inch v6.0 | `api.1inch.dev` (Bearer `ONEINCH_API_KEY`) | Key required | swap unavailable if unset |
| Tx simulation | Alchemy (`eth_call`) | RPC method | Included in free | Tenderly (optional) |
| Gas prices | Alchemy Gas API | `eth_gasPrice` / `eth_maxPriorityFeePerGas` | Included in free | `eth_gasPrice` RPC |
| Aave positions | Aave subgraph | `api.thegraph.com/subgraphs/name/aave/...` | Free | `@aave/contract-helpers` |
| Morpho positions | Morpho subgraph | Blue API | Free | `@morpho-org/morpho-ts` |
| Pendle markets | Pendle Hosted SDK | `api-v2.pendle.finance/core` | Free | — |

---

## 14. Database Schema

The database is **Supabase Postgres**, accessed server-side through **Drizzle ORM** (over
`postgres-js`). The SQL migrations in `supabase/migrations/` are the canonical applied schema; the
Drizzle schema in `lib/db/schema.ts` mirrors them and is the **typed source of truth** for all
queries. New migrations use a sequential 3-digit prefix — when you add one, reflect the change in
`lib/db/schema.ts`.

### 14.1 Data Access Layer

- `lib/db/client.ts` — lazy, server-only Drizzle client. Requires `DATABASE_URL` (the Supabase
  Postgres connection-pooler URI; see §18). `@supabase/supabase-js` is no longer a dependency of the
  Next app.
- `lib/db/schema.ts` — Drizzle table definitions for every table below.
- `lib/data/*` — typed repositories that own all queries; route handlers contain **no** raw DB
  access. Modules: `sequencePlans`, `executionHistory`, `autoCompoundSettings`, `harvestHistory`,
  `bridgeQuotesCache`.
- Postgres `numeric` columns are returned by the driver as strings; repositories convert them to
  `number` at their boundary.
- `npm run db:generate | db:migrate | db:push | db:studio` wire `drizzle-kit` (`drizzle.config.ts`).

> The Supabase Edge Function `supabase/functions/auto-compound/index.ts` runs on Deno and uses its
> own `@supabase/supabase-js` import via esm.sh — independent of the Drizzle layer above.

### 14.2 Tables

| Migration(s) | Table | Purpose |
|---|---|---|
| `001`, `009` | `user_settings` | wallet → preferences (incl. `min_usd_threshold`) |
| `002` | `auto_compound_settings` | per-position auto-compound prefs (unique per wallet+protocol+chain+asset) |
| `003`, `006` | `execution_history` | executed sequences (`plan_id` → `sequence_plans`) |
| `004`, `008` | `harvest_history` | harvested rewards (incl. `reward_token_address`) |
| `005`, `010` | `sequence_plans` | persisted `SequencePlan`s (incl. `position_size_usd`) |
| `007` | `bridge_quotes_cache` | short-TTL cache of bridge quotes per route |

Key table definitions:

```sql
-- 005_sequence_plans.sql (+ 010 adds position_size_usd)
CREATE TABLE sequence_plans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address      TEXT NOT NULL,
  template_id         TEXT NOT NULL,
  description         TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'draft',  -- draft|in-progress|complete|failed
  total_cost_usd      NUMERIC,
  position_size_usd   NUMERIC(18,2),
  steps               JSONB NOT NULL,                 -- serialised SequenceStep[]
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ
);

CREATE INDEX idx_sequence_plans_wallet ON sequence_plans(wallet_address);
CREATE INDEX idx_sequence_plans_status ON sequence_plans(status);

-- 007_bridge_quotes_cache.sql
CREATE TABLE bridge_quotes_cache (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_chain          TEXT NOT NULL,
  to_chain            TEXT NOT NULL,
  token               TEXT NOT NULL,
  amount_wei          TEXT NOT NULL,
  recipient           TEXT NOT NULL,
  quotes              JSONB NOT NULL,                 -- BridgeQuote[]
  fetched_at          TIMESTAMPTZ DEFAULT NOW(),
  expires_at          TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_bridge_quotes_cache_lookup
  ON bridge_quotes_cache(from_chain, to_chain, token, amount_wei, recipient);
```

---

## 15. API Routes

> **Input validation:** every route validates inputs with zod through shared helpers in
> `lib/validation/` — `parse` / `parseQuery` / `parseJson` (each returns a ready `400` response on
> failure or the typed data) plus reusable primitives (`evmAddressSchema`, `chainSchema`). Validation
> failures respond with `{ error: <first message> }` and status `400`; malformed JSON bodies respond
> with `{ error: 'Invalid JSON body' }`.

### 15.1 Positions, Simulation & Data

**`GET /api/positions?address={wallet}&solana={solanaAddress}`**

Both query params optional. Returns merged EVM (Zerion + protocol plugins) + Solana positions.

**`POST /api/simulate`**

Body: `{ chain: ChainId, to, from, data?, value? }` (`chain` includes `'solana'`). Routes to the
appropriate simulation method and returns the serialised `SimulationResult`.

**`POST /api/quote`**

Single-move **cost preview** (not bridge quotes). Body:
`{ asset, amountUsd, sourceProtocol, sourceChain, destProtocol, destChain }`. Returns a
`CostPreviewResult` with `quoteFetchedAt` serialised to an ISO string. Rejects no-op moves
(same source and destination). Bridge quotes live at `GET /api/bridges/quote` (§15.2).

**`GET /api/apys?protocol={protocol}&chain={chain}&asset={asset}`**

Defillama pool APY lookup via the protocol/chain registries. Unchanged.

**`GET /api/destinations?token={token}&chain={chain}`**

Candidate deposit destinations (protocol/chain/APY) for the sequence builder. Both params optional.
CDN-cached (5 min, stale-while-revalidate 15 min).

### 15.2 Bridge Routes

**`GET /api/bridges/quote`**

```typescript
// Query: fromChain, toChain, token, amount, recipientAddress, slippagePercent? (default 0.5)
// Response: { quotes: BridgeQuote[], recommended: BridgeQuote }   // sorted best net output first
```

Served from a 30s DB cache (`bridge_quotes_cache`) on a warm hit; otherwise queries all eligible
bridge plugins in parallel (10s timeout) and caches the result.

**`POST /api/bridges/build`**

```typescript
// Body: { bridgeId, quote, walletAddress }
// Response: { unsignedTx: SerializedUnsignedTx }
```

Verifies `quote.rawQuote.recipientAddress === walletAddress`, resolves the origin chain, and
simulates before returning the unsigned tx.

**`GET /api/bridges/status?txHash={hash}&fromChain={chain}&bridgeId={bridge}`**

Returns `BridgeStatus` by polling the selected bridge plugin.

### 15.3 Sequencer Routes

**`POST /api/sequencer/plan`**

```typescript
// Body (template): { templateId: TemplateId, params: TemplateParams, walletAddress }
// Body (custom):   { templateId: 'custom', customPlan, walletAddress }
// Response: { plan: SequencePlan }
```

**`POST /api/sequencer/simulate`**

```typescript
// Body: { planId, stepId, walletAddress }
// Response: { simulation: SimulationResult, updatedStep: SequenceStep }   // ownership-checked
```

**`POST /api/sequencer/cost`**

```typescript
// Body: { planId, walletAddress, currentApy?, targetApy?, borrowApy?, supplyApy?, totalCollateralUsd? }
// Response: multi-step CostPreviewResult (quoteFetchedAt as ISO string)   // ownership-checked
```

**`GET /api/sequencer/plan/{planId}`**

Returns the full `SequencePlan` from the DB.

**`PATCH /api/sequencer/plan/{planId}/step/{stepId}`**

```typescript
// Body: { status: StepStatus, walletAddress, txHash?, simulation?, acknowledged? }
// Enforces valid status transitions and plan ownership.
```

### 15.4 Rewards & Harvest Routes

**`GET /api/rewards?address={wallet}&chain={chain}`**

Aggregates claimable rewards across all protocol plugins implementing `RewardFetcher`. `chain`
optional (defaults to all supported EVM chains). Returns `{ rewards, totalUsd }`.

**`POST /api/rewards/claim`**

Body: `{ protocol, chain, address }`. Returns `{ txs: UnsignedTx[] }`.

**`GET /api/harvest/settings?address={wallet}`** / **`POST /api/harvest/settings`**

Read all auto-compound settings for a wallet, or upsert one
(`{ address, protocol, chain, asset, enabled, min_threshold_usd? }`).

**`GET /api/harvest/history?address={wallet}`**

Returns the 50 most recent harvest events for the wallet, newest first.

---

## 16. Frontend Pages & Components

### 16.1 Page Structure

```
app/
├── layout.tsx                  # Root layout + providers
├── page.tsx                    # Landing / connect wallet
├── dashboard/
│   └── page.tsx                # Portfolio overview — ALL position types
├── execute/
│   └── page.tsx                # Single-move execute flow (asset → destination → cost preview)
├── sequence/
│   ├── page.tsx                # Template selector
│   └── [planId]/
│       └── page.tsx            # Plan review + step-by-step sign/simulate (no separate step route)
├── harvest/
│   └── page.tsx                # Harvest rewards flow (existing)
└── api/
    ├── positions/route.ts
    ├── quote/route.ts
    ├── apys/route.ts
    ├── destinations/route.ts
    ├── simulate/route.ts
    ├── rewards/
    │   ├── route.ts
    │   └── claim/route.ts
    ├── harvest/
    │   ├── settings/route.ts
    │   └── history/route.ts
    ├── bridges/
    │   ├── quote/route.ts
    │   ├── build/route.ts
    │   └── status/route.ts
    └── sequencer/
        ├── plan/route.ts
        ├── plan/[planId]/route.ts
        ├── plan/[planId]/step/[stepId]/route.ts
        ├── simulate/route.ts
        └── cost/route.ts
```

### 16.2 Component Structure

There are **two distinct sequence UIs**, both POSTing to `/api/sequencer/plan`: `components/sequence/`
is the pre-built **template** flow (launched via `SequenceModal`), and `components/sequenceBuilder/`
is the freeform **custom** builder (launched via `SequenceBuilderModal`, includes the swap step).
Position type is rendered inline by a type-aware `PositionCard` (there is no separate `BorrowCard`/
`PendleCard`).

```
components/
├── wallet/
│   ├── ConnectButton.tsx           # EVM connect
│   ├── SolanaConnectButton.tsx     # Solana wallet connect
│   └── WalletProvider.tsx          # Wraps both EVM + Solana providers
├── positions/
│   ├── PositionList.tsx            # Groups by chain, shows all types
│   ├── PositionCard.tsx            # Type-aware display (supply/borrow/Pendle/wallet)
│   ├── PositionSkeleton.tsx
│   ├── PositionTypeFilter.tsx      # Filter by position type
│   └── TokenIcon.tsx
├── sequence/                       # Pre-built TEMPLATE flow
│   ├── SequenceModal.tsx           # Entry point — pick template + params
│   ├── TemplateSelector.tsx
│   ├── SequencePlanView.tsx        # Review steps; step-by-step simulate/sign
│   ├── SequenceStepCard.tsx
│   ├── SequenceProgress.tsx
│   └── SequenceComplete.tsx
├── sequenceBuilder/                # Freeform CUSTOM builder
│   ├── SequenceBuilderModal.tsx
│   ├── ActionSelectCard.tsx
│   ├── SourceCard.tsx
│   ├── BridgeCard.tsx
│   ├── SwapCard.tsx                # 1inch same-chain swap step
│   ├── DepositCard.tsx
│   ├── WithdrawCard.tsx
│   ├── RepayCard.tsx
│   ├── RepayAndWithdrawCard.tsx
│   └── SummaryBar.tsx
├── loop/
│   └── LoopModal.tsx               # Leverage-loop builder entry point
├── execute/
│   ├── AssetSelector.tsx
│   ├── BridgeQuoteSelector.tsx     # Compare bridge options
│   ├── CostPreview.tsx             # Multi-step cost breakdown
│   ├── SimulationResult.tsx        # Simulation pass/fail + state changes
│   └── StepOneBridge.tsx
├── harvest/
│   ├── RewardsList.tsx
│   └── HarvestButton.tsx
└── ui/
    ├── Badge.tsx
    ├── Card.tsx
    ├── Spinner.tsx
    ├── Tooltip.tsx
    ├── WarningBanner.tsx
    └── HealthFactor.tsx            # Colour-coded health factor display
```

### 16.3 Dashboard Position Display

Positions are grouped by chain, then by position type within each chain. Sort order within group:
highest USD value first. Borrow positions are shown in a separate "Liabilities" section with a red
accent.

```
Ethereum                        Total: $142,300
  [Supply]  Aave USDC           $80,000   7.2% APY
  [Supply]  Morpho wstETH       $50,000   4.1% APY
  [PT]      Pendle eETH         $12,300   5.8% fixed  (matures Jun 28)
  ─ Liabilities ─
  [Borrow]  Aave USDT           $30,000   5.1% borrow  HF: 2.1 ✓

Arbitrum                        Total: $25,000
  [Supply]  Euler USDC          $25,000   8.4% APY

Solana                          Total: $5,200
  [Wallet]  SOL                  $4,000
  [Wallet]  USDC                 $1,200
```

---

## 17. Error Handling Standards

Every error must be specific, actionable, and non-blocking.

| Scenario | Message | Action |
|---|---|---|
| Zerion API unavailable | "Could not load positions. Using cached data from {time}." | Show cached; retry button |
| Bridge quote fetch failed | "Could not get bridge quote. Network may be congested." | Retry button |
| Bridge tx rejected by user | "Transaction cancelled." | Return to cost preview |
| Bridge stuck / timeout | "Bridge is taking longer than expected." | Link to bridge status page |
| Simulation failed | "This transaction would fail: {revertReason}" | Show error; edit params option |
| Deposit tx rejected by user | "Transaction cancelled." | Return to step |
| Aave health factor warning | "This action brings your health factor to {X}. Liquidation risk." | Require checkbox confirmation |
| Pendle maturity warning | "This PT matures in {X} days. Ensure you can exit before maturity." | Require checkbox |
| Solana wallet not connected | "Connect a Solana wallet to see Solana positions." | Connect button |
| Unsupported chain | "Switch to Ethereum, Arbitrum, or Base to continue." | Switch network button |
| Amount below minimum | "Minimum transaction is $1 to cover fees." | Inline validation |
| Quote expired | "Quotes have expired. Please refresh before signing." | Disable sign; refresh button |
| Bridge quote: no route | "No bridge supports this route for {token}. Try USDC instead." | Suggest alternative |

---

## 18. Environment Variables

```bash
# Alchemy
ALCHEMY_API_KEY_ETHEREUM=
ALCHEMY_API_KEY_ARBITRUM=
ALCHEMY_API_KEY_BASE=
ALCHEMY_API_KEY_SOLANA=        # Server-side Solana RPC (via Alchemy)

# Solana
NEXT_PUBLIC_SOLANA_RPC_URL=     # Client-side Solana RPC (e.g. Helius, Alchemy, or Public)

# Zerion
ZERION_API_KEY=

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

# Bridge providers
NEAR_INTENTS_API_KEY=
# Across: no API key needed — public endpoint
# Circle CCTP (the `layerzero` plugin): no API key — public IRIS endpoint + contracts
# Chainlink CCIP: no API key — fees quoted on-chain

# Protocol / swap data
PENDLE_HOSTED_SDK_API_KEY=      # Pendle Convert/Hosted SDK (api-v2.pendle.finance)
ONEINCH_API_KEY=                # 1inch v6.0 swaps (server-side Bearer). Swap option hidden if unset.

# Database
DATABASE_URL=                   # Postgres connection string for Drizzle ORM (server-side DB access).
                                # Supabase: use the Transaction pooler URI (port 6543). This is the
                                # ONLY DB var the Next app uses — there is no @supabase/supabase-js dep.

# Supabase JS keys — used ONLY by the Deno auto-compound Edge Function, not the Next app.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Upstash Redis (optional) — activates the shared, global rate-limit store (§19).
# When either is unset, rate limiting falls back to the in-memory per-instance default.
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Tenderly (optional — for enriched simulation)
TENDERLY_ACCESS_KEY=
TENDERLY_ACCOUNT_SLUG=
TENDERLY_PROJECT_SLUG=

# App
NEXT_PUBLIC_APP_URL=
NODE_ENV=
```

All keys prefixed `NEXT_PUBLIC_` are safe for the client bundle. All others are server-only and
must only be accessed inside `app/api/` routes or `lib/server/` utilities.

---

## 19. Security Constraints

- **Never** request, store, or log private keys or seed phrases
- **Never** hold user funds in any Verdant-controlled address or smart contract
- All transaction construction must be simulated before the sign button is shown
- All API keys must be server-side only — never in client bundles
- Rate limit all API routes: 60 req/min per IP for position fetches, 10 req/min per IP for
  simulation and sequencer plan creation. `lib/server/rateLimit.ts` uses an in-memory per-instance
  sliding window by default; setting `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` switches
  `enforceRateLimit` to a shared Upstash Redis store that enforces the limit globally across
  serverless instances
- Display health factor warnings prominently; require explicit checkbox confirmation for actions
  that reduce health factor below 1.5
- Display Pendle maturity warnings prominently; require checkbox for PT positions maturing <30 days
- Validate all user inputs server-side (not just client-side)
- No autonomous execution — every on-chain action requires an explicit wallet signature

---

## 20. Milestones & Build Order

### Milestone 1 — Core Infrastructure (Enhanced for Security)

- [x] Next.js 14 + TypeScript + Tailwind setup
- [x] RainbowKit + wagmi + viem — EVM wallet connection
- [x] Alchemy RPC for Ethereum + Arbitrum
- [x] Supabase project + schema migrations 001–004
- [x] Zerion API proxy — `/api/positions`
- [x] **Zod input validation** on all API routes (security hardening)
- [x] **Server-side proxying** for all external protocol/bridge APIs
- [x] Basic dashboard with position list (supply positions only)
- [x] Environment variable configuration


---

### 🔄 Milestone 2 — Plugin Architecture Refactor

**Goal:** Establish the plugin registry pattern so all subsequent work lands in plugin files.

**Tasks:**
- [x] Define `ChainPlugin`, `ProtocolPlugin`, `BridgePlugin` interfaces in `lib/plugins/types/`
- [x] Define shared types in `lib/plugins/types/shared.ts`
- [x] Migrate existing chain config (`constants/chains.ts`) to `lib/plugins/chains/ethereum.ts` and `arbitrum.ts`
- [x] Migrate existing protocol config (`constants/protocols.ts`) to `lib/plugins/protocols/aave.ts`, `morpho.ts`, `pendle.ts`, `euler.ts`
- [x] Create `lib/plugins/chains/index.ts` with `CHAIN_REGISTRY`
- [x] Create `lib/plugins/protocols/index.ts` with `PROTOCOL_REGISTRY`
- [x] Create `lib/plugins/bridges/index.ts` with `BRIDGE_REGISTRY`
- [x] Write `getBridgeQuotes()` utility in bridge registry
- [x] Update all existing imports to use registry lookups
- [x] Write plugin unit tests: each plugin implements interface, registry lookup works

**Definition of done:** Adding a mock chain plugin to `CHAIN_REGISTRY` makes it appear in the
dashboard chain selector without any other code changes.

---

### Milestone 3 — Base Chain + Full Position Type Display

**Goal:** Add Base, show all position types (supply, borrow, Pendle PT/YT) in dashboard.

**Tasks:**
- [x] `lib/plugins/chains/base.ts` — Base chain plugin with Alchemy RPC
- [x] Update `wagmiConfig` to include Base
- [x] Update Zerion filter to include `base` chain
- [x] Extend `PROTOCOL_REGISTRY`: add Base to Aave + Morpho `supportedChains`
- [x] Add Aave V3 pool address for Base to `aavePlugin`
- [x] Add Morpho address for Base
- [x] `types/position.ts` — extend `Position` with borrow + Pendle fields
- [x] Update `PositionCard.tsx` to be type-aware (render different UI per `positionType`)
- [x] Borrow display with health factor + colour coding (folded into type-aware `PositionCard`, not a separate `BorrowCard`)
- [x] `components/ui/HealthFactor.tsx` — reusable health factor badge
- [x] Pendle display — maturity date + APY type (rendered by `PositionCard`, not a separate `PendleCard`)
- [x] `components/positions/PositionTypeFilter.tsx` — filter bar
- [x] Update dashboard `page.tsx` — group by chain, then by type; separate liabilities section
- [x] Update `/api/positions` — include borrow positions in Zerion filter
- [x] Write position aggregation tests

---

### 📋 Milestone 4 — Solana Infrastructure

**Goal:** Connect Solana wallet, display SOL + SPL token balances. No Solana DeFi protocols yet.

**Tasks:**
- [x] Add dependencies: `@solana/web3.js`, `@solana/wallet-adapter-react`, `@solana/wallet-adapter-wallets`, `@solana/wallet-adapter-phantom`
- [x] `lib/plugins/chains/solana.ts` — Solana chain plugin, wraps `@solana/web3.js` Connection
- [x] `components/wallet/SolanaConnectButton.tsx` — Phantom + Ledger Solana
- [x] `components/wallet/WalletProvider.tsx` — wrap both EVM and Solana context providers
- [x] `hooks/useWallet.ts` — extend to expose `evmAddress` and `solanaPublicKey`
- [x] `lib/server/solana.ts` — server-side Solana RPC with Alchemy API key
- [x] `lib/data/solana.ts` — `fetchSolanaTokenBalances(publicKey)` using `getParsedTokenAccountsByOwner`
- [x] Update `/api/positions` — accept `?solana={publicKey}`, merge SPL balances
- [x] Update dashboard — show Solana section if Solana wallet connected
- [x] Update position aggregation pipeline — `deduplicatePositions()` skips Solana vs EVM dedupe
- [x] Phantom + Ledger Solana wallet connection tests

---

### 📋 Milestone 5 — Transaction Sequencer Core

**Goal:** Build the sequencer infrastructure. Implement Bridge + Deposit and Repay + Withdraw
templates. Replace existing execute flow with sequencer.

**Tasks:**
- [x] `SequencePlan`, `SequenceStep`, `StepStatus` types (Located at `types/sequencer.ts`, imported as `@/types/sequencer`)
- [x] `lib/sequencer/engine.ts` — state machine: simulate → ready → sign → confirm → next step
- [x] `lib/sequencer/templates/bridgeAndDeposit.ts` — template
- [x] `lib/sequencer/templates/repayAndWithdraw.ts` — template (same-chain)
- [x] `lib/sequencer/templates/deleverageAave.ts` — template (computes N repay/withdraw cycles)
- [x] `lib/sequencer/templates/crossChainRebalance.ts` — template
- [x] `lib/sequencer/templates/exitPendle.ts` — template
- [x] `hooks/useSequencer.ts` — `createPlan`, `simulateStep`, `executeStep`, `reset`
- [x] Supabase migration `005_sequence_plans.sql`
- [x] `POST /api/sequencer/plan` route
- [x] `POST /api/sequencer/simulate` route
- [x] `PATCH /api/sequencer/plan/{planId}/step/{stepId}` route
- [x] `GET /api/sequencer/plan/{planId}` route
- [x] `app/sequence/page.tsx` — template selector
- [x] `app/sequence/[planId]/page.tsx` — plan review
- [x] `app/sequence/[planId]/step/[stepId]/page.tsx` — step execution (Refactored: logic is in `[planId]/page.tsx` using `SequencePlanView`)
- [x] `components/sequence/TemplateSelector.tsx` (Refactored: logic is in `app/sequence/page.tsx`)
- [x] `components/sequence/SequencePlanView.tsx`
- [x] `components/sequence/SequenceStepCard.tsx`
- [x] `components/sequence/SequenceProgress.tsx`
- [x] `components/sequence/SequenceComplete.tsx`
- [x] Update `execution_history` table — reference `plan_id` (Done via `006_update_execution_history.sql`)
- [x] Sequencer state machine unit tests

---

### 📋 Milestone 6 — Simulation Layer

**Goal:** Every step has a mandatory simulation gate. Show state changes to user.

**Tasks:**
- [x] `lib/simulation/simulate.ts` — `simulateTx(chain, tx, fromAddress): SimulationResult`
- [x] EVM simulation via `eth_call` using Alchemy RPC (primary path)
- [x] Error ABI decoder — map common revert selectors to human-readable strings
  (e.g., `0x13be252b` → "Insufficient allowance")
- [x] State change extractor from simulation trace (token balance deltas)
- [x] Tenderly simulation fallback (if env var set)
- [x] Solana `simulateTransaction` path
- [x] `POST /api/simulate` — updated to handle all chains
- [x] `components/execute/SimulationResult.tsx` — pass/fail + state changes display
- [x] Integrate simulation gate into sequencer step state machine
- [x] Simulation unit tests with mock RPC responses

---

### 📋 Milestone 7 — Bridge Layer (Multi-Bridge)

**Goal:** Support Across + LayerZero + NEAR Intents. User can compare and select bridge.

**Tasks:**
- [x] `lib/plugins/bridges/across.ts` — refactor existing `lib/routing/across.ts` into plugin
- [x] `lib/plugins/bridges/nearIntents.ts` — refactor existing `lib/routing/nearIntents.ts` into plugin
- [x] `lib/plugins/bridges/layerzero.ts` — Circle CCTP v2 for USDC (registry id `layerzero`)
- [x] `lib/plugins/bridges/chainlink.ts` — Chainlink CCIP bridge (on-chain `getFee`)
- [x] `GET /api/bridges/quote` — returns all bridge quotes for a route, sorted by net output
- [x] Supabase migration `006_bridge_quotes_cache.sql`
- [x] Bridge quote caching (30s TTL in DB)
- [x] `components/bridge/BridgeQuoteSelector.tsx` — compare bridge options
- [x] Update `BridgePending.tsx` (formerly `StepOneBridge.tsx`) — show selected bridge name + status link
- [x] NEAR Intents: add EVM→Solana route support
- [x] LayerZero: CCTP USDC cross-chain on ETH, ARB, Base routes
- [x] Bridge plugin unit tests (mocked APIs)
- [x] Integration test: quote + build tx for each bridge plugin

---

### Milestone 8 — Protocol Integrations: Borrow Actions

**Goal:** Support repay and withdraw actions on Aave and Euler. Enable de-leverage sequences.

**Tasks:**
- [x] `lib/plugins/protocols/aave.ts` — add `buildRepayTx()`, `buildWithdrawTx()` to `TxBuilder`
- [x] `lib/plugins/protocols/aave.ts` — `fetchPositions()` to include borrow positions with health factor
- [x] `lib/plugins/protocols/euler.ts` — add `buildRepayTx()`, `buildWithdrawTx()`
- [x] Aave subgraph integration — fetch health factor and debt data server-side
- [x] `lib/sequencer/templates/deleverageAave.ts` — compute optimal unwind cycle count
- [x] Health factor guard — `deleverageAave` template targets/keeps HF ≥ 1.05 and throws on
  zero collateral/debt
- [x] "De-leverage" entry point — launched from `PositionCard` via `SequenceModal` / `LoopModal`
  (no separate `BorrowCard`)
- [ ] End-to-end test: de-leverage sequence plan creation with mock positions

---

### Milestone 9 — Harvest Flow & Rewards (Enhance Existing)

**Goal:** Extend harvest to cover all supported protocols and both EVM + Solana.

**Tasks:**
- [x] `lib/plugins/protocols/aave.ts` — add `RewardFetcher` (Aave safety module rewards)
- [x] `lib/plugins/protocols/morpho.ts` — add `RewardFetcher`
- [x] `lib/plugins/protocols/pendle.ts` — add `RewardFetcher` (SY rewards)
- [x] `lib/plugins/protocols/euler.ts` — add `RewardFetcher`
- [x] Update `/api/rewards` — use plugin registry to fetch across all protocols
- [x] Update harvest UI to show per-protocol rewards grouped by chain
- [x] Per-step simulation for harvest transactions
- [x] Harvest history display in dashboard
- [x] Auto-compound settings persist in Supabase (existing schema)
  - *Note: Auto-compound is currently a preference store only. No background executor exists to perform the harvests automatically. This is a known limitation.*

---

### 📋 Milestone 10 — Cost Preview: Multi-Step

**Goal:** Cost preview handles N-step sequences, not just bridge + deposit.

**Tasks:**
- [x] `lib/costPreview/calculator.ts` — accepts a `SequencePlan` (N-step path) and sums costs per step
- [x] Gas estimation for every step via plugin's `estimateGasCostUsd()`
- [ ] Bridge fee pulled from winning `BridgeQuote` in plan
- [x] `components/execute/CostPreview.tsx` — itemised per step with subtotals
- [ ] Quote staleness tracking per bridge step (60s expiry, orange at 30s)
- [ ] Disable "Begin Sequence" if any bridge quote is stale
- [ ] Break-even calculation: accounts for position being partially unwound during de-leverage

---

### 📋 Milestone 11 — Polish, Security & Launch Prep

**Goal:** Production-ready for 10–50 users.

**Tasks:**
- [x] Rate limiting on API routes (`lib/server/rateLimit.ts`; in-memory default, optional shared
  Upstash Redis store — see §19)
- [x] Input validation on all API routes (shared zod helpers in `lib/validation/` — see §15)
- [ ] Error boundary components — prevent full-page crashes
- [ ] Mobile-responsive layout: dashboard read-only on mobile, execution desktop-only
- [ ] Loading skeletons for all async states
- [ ] Empty states: no positions, no sequences
- [ ] Ledger hardware wallet — test EVM + Solana signing paths
- [ ] Terms of service and disclaimer pages (required before first use)
- [ ] Pre-launch security review (at minimum: API key exposure check, input validation audit)
- [ ] Vercel deployment + custom domain
- [ ] Environment variable audit — confirm zero client-side key leakage

---

## 21. Out of Scope

The following are explicitly out of scope for this phase:

- Vault smart contracts, LP deposit infrastructure, or ERC-4626 vaults
- Autonomous rebalancing without user confirmation
- Social features or copy trading
- Token launch or governance
- Admin dashboard or analytics
- Email or push notifications
- iOS or Android mobile app
- Solana DeFi protocol positions (Kamino, MarginFi, Raydium) — infrastructure built, protocols post-milestone
- EVM chains other than Ethereum, Arbitrum, Base
- Yield strategy recommendations or rankings
- Own price oracle or indexer
- NFTs or non-yield assets
- Subscription billing or paywalled features
- KYC or access control whitelisting
- Custom receiver contracts for atomic cross-chain execution

---

## 22. Definition of Done

### Technical

- [ ] Position display covers supply, borrow, Pendle PT/YT, and wallet tokens across ETH, ARB, Base, Solana
- [ ] Every EVM transaction is simulated via `eth_call` before sign prompt is shown
- [ ] Sequencer correctly executes Bridge+Deposit and De-leverage Aave templates end-to-end on mainnet
- [ ] All 3 bridge providers return quotes; user can select preferred bridge
- [ ] USDC (Circle CCTP v2) bridging works ETH↔ARB, ETH↔Base, ARB↔Base
- [ ] NEAR Intents bridging works EVM→Solana for ETH and USDC
- [ ] Phantom and MetaMask are both tested on mainnet for a real sequence
- [ ] Ledger tested on at least one sequence (EVM)
- [ ] Cost preview is accurate within 5% of actual execution cost
- [ ] Zero novel smart contracts deployed
- [ ] All API keys are server-side only (confirmed by client bundle audit)
- [ ] Rate limiting active on all API routes
- [ ] All error scenarios in Section 17 are handled with correct UI
- [ ] Pre-launch security review completed

### Product

- [ ] 10+ unique wallets have completed at least one sequence
- [ ] $500K+ cumulative volume routed through Verdant
- [ ] At least one user has successfully run a de-leverage sequence
- [ ] 0 user funds lost or stuck due to Verdant bugs
- [ ] At least 5 users have provided qualitative feedback on the sequencer UX