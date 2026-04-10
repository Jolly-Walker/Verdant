# Verdant — Phase 1 Technical Specification

## Overview

**Product:** Verdant  
**Phase:** 1 — Execution Tool  
**Target user:** On-chain power users managing $100K–$10M  
**Core function:** Discretionary cross-chain yield execution with pre-execution cost transparency  
**Timeline:** 8–16 weeks  
**Deployment:** Vercel (frontend), Supabase (database), Alchemy (RPC)

---

## 1. Project Structure

```
verdant/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout, wallet provider wrapper
│   ├── page.tsx                  # Landing / connect wallet
│   ├── dashboard/
│   │   └── page.tsx              # Main dashboard — positions overview
│   ├── execute/
│   │   └── page.tsx              # Execution flow
│   ├── harvest/
│   │   └── page.tsx              # Harvest rewards flow
│   └── api/
│       ├── positions/
│       │   └── route.ts          # Proxy to DeBank API (server-side, hides API key)
│       ├── quote/
│       │   └── route.ts          # Aggregates bridge + swap quotes
│       ├── apys/
│       │   └── route.ts          # Proxy to Defillama Yields API
│       └── simulate/
│           └── route.ts          # Transaction simulation via Tenderly or eth_call
├── components/
│   ├── wallet/
│   │   ├── ConnectButton.tsx
│   │   └── WalletProvider.tsx    # RainbowKit + wagmi config
│   ├── positions/
│   │   ├── PositionCard.tsx
│   │   ├── PositionList.tsx
│   │   └── PositionSkeleton.tsx
│   ├── execute/
│   │   ├── AssetSelector.tsx
│   │   ├── ProtocolSelector.tsx
│   │   ├── CostPreview.tsx       # Hero component — see section 4
│   │   ├── StepOneBridge.tsx
│   │   └── StepTwoDeposit.tsx
│   ├── harvest/
│   │   ├── RewardsList.tsx
│   │   └── HarvestButton.tsx
│   └── ui/                       # Shared primitives
│       ├── Badge.tsx
│       ├── Card.tsx
│       ├── Spinner.tsx
│       ├── Tooltip.tsx
│       └── WarningBanner.tsx
├── lib/
│   ├── protocols/
│   │   ├── aave.ts               # Aave V3 integration
│   │   ├── morpho.ts             # Morpho integration
│   │   ├── pendle.ts             # Pendle integration
│   │   └── euler.ts              # Euler integration
│   ├── routing/
│   │   ├── nearIntents.ts        # NEAR Intents SDK wrapper
│   │   └── across.ts             # Across Protocol SDK wrapper
│   ├── data/
│   │   ├── debank.ts             # DeBank API client
│   │   ├── defillama.ts          # Defillama API client
│   │   └── prices.ts             # Token price fetching
│   ├── simulation/
│   │   └── simulate.ts           # Pre-execution transaction simulation
│   ├── costPreview/
│   │   └── calculator.ts         # Cost preview calculation engine
│   └── utils/
│       ├── formatting.ts         # USD, token, percentage formatting
│       ├── chains.ts             # Chain configs and constants
│       └── warnings.ts           # Warning condition logic
├── hooks/
│   ├── usePositions.ts           # Fetch and cache user positions
│   ├── useQuote.ts               # Real-time quote fetching
│   ├── useExecute.ts             # Execution flow state machine
│   ├── useHarvest.ts             # Harvest flow
│   └── useApys.ts                # Protocol APY data
├── types/
│   ├── position.ts
│   ├── protocol.ts
│   ├── quote.ts
│   └── chain.ts
├── constants/
│   ├── protocols.ts              # Protocol metadata, addresses, ABIs
│   ├── chains.ts                 # Supported chain configs
│   └── tokens.ts                 # Supported token list
└── supabase/
    └── migrations/               # DB schema migrations
```

---

## 2. Supported Chains and Protocols

### Chains

| Chain | Chain ID | RPC Provider | Role |
|---|---|---|---|
| Ethereum Mainnet | 1 | Alchemy | Source chain, hub |
| Arbitrum One | 42161 | Alchemy | Destination chain, yield |

No other chains in Phase 1.

### Protocols

| Protocol | Chains | Assets | Integration Package |
|---|---|---|---|
| Aave V3 | Ethereum, Arbitrum | USDC, USDT, ETH, WBTC, wstETH | @aave/contract-helpers, @aave/math-utils |
| Morpho | Ethereum, Arbitrum | USDC, ETH, wstETH, WBTC | @morpho-org/morpho-ts, Morpho subgraph |
| Pendle | Ethereum, Arbitrum | PT/YT for wstETH, USDC, eETH | Pendle Hosted SDK / API |
| Euler | Ethereum, Arbitrum | USDC, ETH, WBTC, wstETH | Euler EVK SDK, official ABIs |

### Supported Assets (Phase 1)

USDC, USDT, ETH/WETH, WBTC, wstETH

---

## 3. Wallet Connection

**Library:** RainbowKit v2 + wagmi v2 + viem v2

**Supported wallets:**

- MetaMask
- Rabby
- WalletConnect v2 (covers 300+ wallets)
- Coinbase Wallet
- Injected (any EIP-1193 compatible wallet)

**Configuration:**

```typescript
// lib/wagmi.ts
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { mainnet, arbitrum } from 'wagmi/chains'

export const wagmiConfig = getDefaultConfig({
  appName: 'Verdant',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [mainnet, arbitrum],
  ssr: true,
})
```

**Behaviour:**

- On first visit: full-screen connect wallet prompt, no content shown without connected wallet
- On connection: redirect to /dashboard
- On disconnect: redirect to landing page, clear all position cache
- Persist connection across page refreshes via wagmi's built-in persistence
- Show connected address (truncated) and ENS name if available in header

---

## 4. Position Display

### Data Source

DeBank OpenAPI — all calls proxied through `/api/positions` server route to protect API key.

**Endpoint:** `GET https://pro-openapi.debank.com/v1/user/complex_protocol_list`

**Parameters:**

- `id`: connected wallet address
- `chain_ids`: `eth,arb` (Ethereum and Arbitrum only)

### Position Data Model

```typescript
// types/position.ts
interface Position {
  id: string
  protocol: 'aave' | 'morpho' | 'pendle' | 'euler'
  chain: 'ethereum' | 'arbitrum'
  asset: string              // token symbol
  assetAddress: string
  amount: number             // token amount
  amountUsd: number          // USD value
  currentApy: number         // as decimal e.g. 0.065 = 6.5%
  claimableRewards: Reward[]
  positionType: 'supply' | 'borrow' | 'lp'
  metadata: ProtocolMetadata // protocol-specific data
}

interface Reward {
  token: string
  amount: number
  amountUsd: number
}
```

### Display Requirements

- Show all positions grouped by chain
- Show USD value, APY, claimable rewards per position
- Show total portfolio value in header
- Loading skeleton while fetching
- Refresh button — manual refresh, no auto-polling (avoid DeBank rate limits)
- Empty state if no positions found on supported protocols

---

## 5. Execution Flow — Core Feature

### Step 0: Asset and Destination Selection

User selects:

1. **Source:** Which position or asset to move (from their current positions, or any token in wallet)
2. **Amount:** Full position or custom amount (validated against wallet balance)
3. **Destination protocol:** One of Aave, Morpho, Pendle, Euler
4. **Destination chain:** Ethereum or Arbitrum

Validation rules:

- Minimum transaction: $1,000 USD equivalent (below this, fees make it uneconomical — show warning)
- Cannot move to same protocol + chain as source (no-op detection)
- Pendle destinations: show maturity date prominently, require acknowledgement

---

### Step 1: Cost Preview Screen

This is the most important screen in Verdant. Must be accurate, fast, and clear.

**Display the following, all in USD:**

```
┌─────────────────────────────────────────────┐
│  Moving 50,000 USDC                          │
│  Ethereum → Aave V3 on Arbitrum              │
├─────────────────────────────────────────────┤
│  COSTS                                       │
│  Bridge fee (Across)           $12.40        │
│  Swap slippage (est.)          $8.20         │
│  Gas — Step 1 (Ethereum)       $3.10         │
│  Gas — Step 2 (Arbitrum)       $0.40         │
│  ─────────────────────────────────────────   │
│  Total switching cost          $24.10        │
├─────────────────────────────────────────────┤
│  YIELD                                       │
│  Current APY (Morpho ETH)      5.2%          │
│  Target APY (Aave ARB)         7.8%          │
│  Net uplift                    +2.6%         │
│  Daily yield gain              +$3.56        │
├─────────────────────────────────────────────┤
│  BREAK-EVEN                                  │
│  Recover switching cost in     7 days        │
│  ✓ Worth moving if holding 7+ days           │
├─────────────────────────────────────────────┤
│  Quotes refreshed 8s ago  [Refresh]          │
│                                              │
│  [Cancel]              [Proceed to Step 1]   │
└─────────────────────────────────────────────┘
```

**Calculation logic:**

```typescript
// lib/costPreview/calculator.ts

interface CostPreviewInput {
  asset: string
  amountUsd: number
  sourcProtocol: Protocol
  sourceChain: Chain
  destProtocol: Protocol
  destChain: Chain
}

interface CostPreviewResult {
  bridgeFeeUsd: number        // from Across API quote
  slippageUsd: number         // from NEAR Intents quote (amountIn - amountOut in USD)
  gasStep1Usd: number         // eth_estimateGas × gasPrice × ETH price
  gasStep2Usd: number         // eth_estimateGas on dest × dest gas price × ETH price
  totalSwitchingCostUsd: number
  currentApyDecimal: number   // from Defillama
  targetApyDecimal: number    // from Defillama
  netUpliftDecimal: number
  dailyYieldGainUsd: number
  breakEvenDays: number
  quoteFetchedAt: Date
  warnings: Warning[]
}
```

**Warning conditions** (display as yellow banners above confirm button):

- Bridge fee > 0.5% of transaction value: "High bridge fee relative to transaction size"
- Slippage > 0.5%: "Significant slippage expected — consider splitting into smaller transactions"
- Break-even > 30 days: "Long break-even period — only worthwhile for long-term positions"
- Pendle maturity < 30 days away: "This Pendle position matures in X days"
- Target protocol utilisation > 90%: "High utilisation — APY may compress after your deposit"

**Quote freshness:**

- Quotes expire after 60 seconds
- Show elapsed time since last fetch
- Show orange warning if >30 seconds old
- Disable "Proceed" button if >90 seconds old — require refresh
- On amount change: auto-refetch after 800ms debounce

---

### Step 2: Bridge Transaction (Step 1 of 2)

**Routing:** NEAR Intents SDK for cross-chain intent creation, fulfilled via Across Protocol

**Implementation:**

```typescript
// lib/routing/nearIntents.ts
import { IntentsSDK } from '@near-intents/sdk'

export async function createBridgeIntent(params: {
  tokenIn: string      // e.g. 'usdc.ethereum'
  tokenOut: string     // e.g. 'usdc.arbitrum'
  amountIn: string     // in token units, as string
  slippageTolerance: number  // e.g. 0.005 for 0.5%
  recipientAddress: string   // user's address on destination
}) {
  const sdk = new IntentsSDK({ network: 'mainnet' })
  const quote = await sdk.getQuote({
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    amountIn: params.amountIn,
    slippage: params.slippageTolerance
  })
  return sdk.createIntent({
    tokenIn: { address: params.tokenIn, amount: params.amountIn },
    tokenOut: { address: params.tokenOut, minAmount: quote.amountOut },
    deadline: Date.now() + 300000, // 5 minute deadline
    recipient: params.recipientAddress
  })
}
```

**UI state during bridge:**

- Show progress indicator: "Bridging USDC to Arbitrum..."
- Show estimated time remaining (from Across API estimate, typically 2-5 minutes)
- Transaction hash with Arbiscan link
- Do not allow user to navigate away without confirmation warning
- Poll bridge completion every 15 seconds using Across API status endpoint

**On bridge failure:**

- Show exact error from NEAR Intents / Across
- Offer retry button — recreates intent with fresh quote
- If funds are stuck, show Across bridge recovery link
- Never show a generic error — always show actionable information

---

### Step 3: Protocol Deposit Transaction (Step 2 of 2)

Triggered automatically when bridge completion is confirmed.

**Per-protocol deposit logic:**

```typescript
// lib/protocols/aave.ts
import { Pool } from '@aave/contract-helpers'

export async function buildAaveSupplyTx(params: {
  asset: string        // token address on destination chain
  amount: string       // in token units
  onBehalfOf: string   // user address
  chainId: number
}) {
  const pool = new Pool(provider, {
    POOL: AAVE_V3_POOL_ADDRESS[params.chainId],
    WETH_GATEWAY: WETH_GATEWAY_ADDRESS[params.chainId]
  })
  return pool.supply({
    user: params.onBehalfOf,
    reserve: params.asset,
    amount: params.amount,
    onBehalfOf: params.onBehalfOf,
  })
}
```

**Simulation before presenting to user:**

- Simulate every deposit transaction via `eth_call` before showing sign prompt
- If simulation fails: show exact revert reason, do not show sign button
- If simulation succeeds: show expected output (e.g. "You will receive 49,961 aUSDC")

**On deposit completion:**

- Show success screen with:
  - Confirmation of position opened
  - Current APY
  - Estimated annual yield in USD
  - Transaction hash with explorer link
- Update position display automatically
- Offer "Execute another" or "Go to dashboard"

---

## 6. Harvest Flow

### Reward Detection

- On dashboard load, fetch claimable rewards for each position via protocol SDKs
- Display per-position claimable amounts with USD values
- Show "Total Claimable: $X.XX" in dashboard header if rewards > $1

### Harvest UI

- "Harvest All" button on dashboard header
- Per-position harvest button on each PositionCard
- Batch transactions by chain — one signature per chain with pending rewards
- Show gas cost estimate before signing
- Show USD value of rewards being claimed

### Auto-Compound

- Toggle per position in PositionCard settings
- User sets minimum harvest threshold (default: $10 USD)
- When rewards exceed threshold, show notification badge
- Notification includes one-click "Compound Now" button
- Compound = harvest → immediately re-deposit into same position
- User must sign each compound — never automated without explicit confirmation
- Store auto-compound preferences in Supabase per wallet address

---

## 7. Database Schema (Supabase)

```sql
-- User preferences and settings
CREATE TABLE user_settings (
  wallet_address  TEXT PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-compound preferences per position
CREATE TABLE auto_compound_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address        TEXT NOT NULL,
  protocol              TEXT NOT NULL,
  chain                 TEXT NOT NULL,
  asset                 TEXT NOT NULL,
  enabled               BOOLEAN DEFAULT FALSE,
  min_threshold_usd     NUMERIC DEFAULT 10,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (wallet_address, protocol, chain, asset)
);

-- Transaction history for user reference
CREATE TABLE execution_history (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address        TEXT NOT NULL,
  tx_hash_step1         TEXT,           -- bridge tx
  tx_hash_step2         TEXT,           -- deposit tx
  source_protocol       TEXT,
  source_chain          TEXT,
  dest_protocol         TEXT,
  dest_chain            TEXT,
  asset                 TEXT,
  amount_usd            NUMERIC,
  bridge_fee_usd        NUMERIC,
  slippage_usd          NUMERIC,
  gas_usd               NUMERIC,
  status                TEXT DEFAULT 'pending',  -- pending, step1_complete, complete, failed
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  completed_at          TIMESTAMPTZ
);

-- Harvest history
CREATE TABLE harvest_history (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address        TEXT NOT NULL,
  protocol              TEXT NOT NULL,
  chain                 TEXT NOT NULL,
  reward_token          TEXT,
  reward_amount_usd     NUMERIC,
  tx_hash               TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
```

No user authentication system — wallet address IS the identity. No passwords, no email.

---

## 8. API Routes

All external API calls are proxied through Next.js server routes to protect keys.

### GET /api/positions?address={wallet}

Proxies DeBank OpenAPI. Returns normalised position array.
Cache: 60 seconds per address.

### POST /api/quote

Body: `{ tokenIn, tokenOut, amountIn, destProtocol, destChain }`
Fetches in parallel:

- Across Protocol bridge quote
- NEAR Intents swap quote
- Gas estimates via Alchemy
- Current and target APYs from Defillama
Returns assembled CostPreviewResult.
Cache: No cache — always fresh.

### GET /api/apys?protocol={protocol}&chain={chain}&asset={asset}

Proxies Defillama Yields API.
Cache: 5 minutes.

### POST /api/simulate

Body: `{ to, data, from, value, chainId }`
Simulates transaction via eth_call or Tenderly simulation API.
Returns: `{ success: boolean, gasUsed: number, revertReason?: string, expectedOutput?: string }`

### GET /api/rewards?address={wallet}

Fetches claimable rewards across all supported protocols for a given address.
Calls protocol SDKs server-side.
Cache: 2 minutes.

---

## 9. Environment Variables

```bash
# Alchemy
ALCHEMY_API_KEY_ETHEREUM=
ALCHEMY_API_KEY_ARBITRUM=

# DeBank
DEBANK_API_KEY=

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

# NEAR Intents
NEAR_INTENTS_API_KEY=

# Pendle
PENDLE_HOSTED_SDK_API_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Tenderly (optional - for simulation)
TENDERLY_ACCOUNT=
TENDERLY_PROJECT=
TENDERLY_ACCESS_KEY=

# App
NEXT_PUBLIC_APP_URL=
NODE_ENV=
```

All keys beginning with `NEXT_PUBLIC_` are safe to expose client-side.
All others must only be used in server routes (`/app/api/`).
Never import server-only env vars in client components.

---

## 10. Error Handling Standards

Every user-facing error must be:

1. **Specific** — say exactly what failed
2. **Actionable** — tell the user what to do next
3. **Non-blocking** — offer a clear way to recover or retry

| Error scenario | Message | Action offered |
|---|---|---|
| Bridge quote fetch failed | "Could not get bridge quote. Network may be congested." | Retry button |
| Bridge transaction rejected by user | "Transaction cancelled." | Return to cost preview |
| Bridge stuck / timeout | "Bridge is taking longer than expected." | Link to Across status tracker |
| Deposit simulation failed | "This deposit would fail: [revert reason]" | Suggest alternative or contact support |
| Deposit transaction rejected | "Transaction cancelled." | Return to cost preview |
| DeBank API unavailable | "Could not load positions. Using cached data." | Show last known positions, timestamp |
| Wallet not connected | — | Prompt to connect wallet |
| Unsupported chain | "Switch to Ethereum or Arbitrum to continue." | Switch network button |
| Amount below minimum | "Minimum transaction is $1,000 to cover fees." | Inline validation |

---

## 11. Build Order and Milestones

### Milestone 1 — Core Infrastructure (Weeks 1-2)

- [ ] Next.js project setup with TypeScript
- [ ] RainbowKit + wagmi wallet connection
- [ ] Alchemy RPC configuration for Ethereum + Arbitrum
- [ ] Supabase project and schema migration
- [ ] DeBank API proxy route and position fetching
- [ ] Basic dashboard layout showing positions
- [ ] Environment variable setup

### Milestone 2 — Execution Flow (Weeks 3-5)

- [ ] NEAR Intents SDK integration and bridge quote fetching
- [ ] Across Protocol SDK integration
- [ ] Cost preview calculator (all components)
- [ ] Cost preview UI component
- [ ] Quote refresh and staleness logic
- [ ] Warning detection and display
- [ ] Step 1 bridge transaction construction and signing
- [ ] Bridge status polling
- [ ] Step 2 deposit transaction construction — Aave V3 first
- [ ] Transaction simulation before signing
- [ ] Execution history recording in Supabase

### Milestone 3 — Protocol Integrations (Weeks 5-7)

- [ ] Morpho deposit and withdrawal
- [ ] Pendle PT deposit (with maturity warning)
- [ ] Euler supply
- [ ] Reward detection across all four protocols
- [ ] Per-protocol position metadata display

### Milestone 4 — Harvest Flow (Weeks 7-9)

- [ ] Harvest all rewards UI
- [ ] Per-chain transaction batching for harvest
- [ ] Auto-compound toggle and settings persistence
- [ ] Reward threshold notifications
- [ ] Harvest history display

### Milestone 5 — Polish and Launch Prep (Weeks 9-12)

- [ ] Error handling for all failure scenarios
- [ ] Loading skeletons and empty states
- [ ] Mobile-responsive layout (read-only on mobile — execution desktop only)
- [ ] Pre-launch security review
- [ ] Terms of service and disclaimer pages
- [ ] Rate limiting on all API routes
- [ ] Vercel deployment and domain configuration
- [ ] Give access to 5 design partner wallets

---

## 12. Out of Scope — Do Not Build in Phase 1

The following are explicitly deferred to Phase 2 or later. If a feature request maps to one of these, reject it until Phase 1 success criteria are met.

- Vault smart contracts or LP deposit infrastructure
- Vault token (ERC-4626 or otherwise)
- NAV accounting for third-party LPs
- Access control or KYC whitelisting
- Mobile app (iOS or Android)
- Chains other than Ethereum and Arbitrum
- Protocols other than Aave, Morpho, Pendle, Euler
- Autonomous rebalancing without user confirmation
- Yield strategy recommendations or rankings
- Social features or copy trading
- Token launch or governance
- Admin dashboard
- Subscription billing or paywalled features
- Email or push notification system
- Own price oracle or indexer infrastructure
- Support for NFTs or non-yield assets

---

## 13. Definition of Done for Phase 1

Phase 1 is complete when ALL of the following are true:

**Technical:**

- [ ] Full execution flow works end-to-end on mainnet for all four protocols
- [ ] Cost preview is accurate within 5% of actual execution cost
- [ ] Harvest flow works for all four protocols on both chains
- [ ] Zero novel smart contracts deployed
- [ ] Pre-launch security review completed by credible reviewer
- [ ] All API keys secured server-side
- [ ] Error handling covers all documented failure scenarios

**Product:**

- [ ] 10+ unique wallet addresses have used the execution flow
- [ ] $500K+ cumulative volume routed through Verdant
- [ ] 3+ wallets have used the harvest feature
- [ ] 0 user funds lost or stuck due to Verdant bugs

**Business:**

- [ ] At least 5 users have given qualitative feedback on cost preview feature
- [ ] At least 2 users have asked about vault or LP management features
- [ ] NEAR Foundation grant application submitted
