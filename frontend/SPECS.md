# Verdant — Phase 1 Technical Specification (v2)

## Overview

**Product:** Verdant  
**Phase:** 1 — Execution Tool  
**Target user:** On-chain power users managing $100K–$10M  
**Core function:** Discretionary cross-chain yield execution with pre-execution cost transparency  
**Timeline:** 8–16 weeks  
**Deployment:** Vercel (frontend), Supabase (database), Alchemy (RPC)  
**Spec version:** 2 — Updated to replace DeBank with Zerion API

---

## Changelog from v1

- **Section 4:** Position data source changed from DeBank OpenAPI → Zerion API
- **Section 8:** `/api/positions` route updated to Zerion endpoint and response shape
- **Section 9:** Environment variables updated — `DEBANK_API_KEY` removed, `ZERION_API_KEY` added
- **Section 10:** Error message updated from "DeBank API unavailable" → "Zerion API unavailable"
- **Section 11:** Milestone 1 checklist updated to reflect Zerion integration
- All other sections unchanged from v1

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
│       │   └── route.ts          # Proxy to Zerion API (server-side, hides API key)
│       ├── quote/
│       │   └── route.ts          # Aggregates bridge + swap quotes
│       ├── apys/
│       │   └── route.ts          # Proxy to Defillama Yields API
│       └── simulate/
│           └── route.ts          # Transaction simulation via eth_call or Tenderly
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
│   │   ├── CostPreview.tsx       # Hero component — see section 5
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
│   │   ├── aave.ts
│   │   ├── morpho.ts
│   │   ├── pendle.ts
│   │   └── euler.ts
│   ├── routing/
│   │   ├── nearIntents.ts
│   │   └── across.ts
│   ├── data/
│   │   ├── zerion.ts             # CHANGED: Zerion API client (replaces debank.ts)
│   │   ├── defillama.ts
│   │   └── prices.ts
│   ├── simulation/
│   │   └── simulate.ts
│   ├── costPreview/
│   │   └── calculator.ts
│   └── utils/
│       ├── formatting.ts
│       ├── chains.ts
│       └── warnings.ts
├── hooks/
│   ├── usePositions.ts
│   ├── useQuote.ts
│   ├── useExecute.ts
│   ├── useHarvest.ts
│   └── useApys.ts
├── types/
│   ├── position.ts
│   ├── protocol.ts
│   ├── quote.ts
│   └── chain.ts
├── constants/
│   ├── protocols.ts
│   ├── chains.ts
│   └── tokens.ts
└── supabase/
    └── migrations/
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
| Pendle | Ethereum, Arbitrum | PT/YT for wstETH, USDC, eETH | @pendle-finance/sdk |
| Euler | Ethereum, Arbitrum | USDC, ETH, WBTC, wstETH | Euler EVK SDK, official ABIs |

### Supported Assets (Phase 1)

USDC, USDT, ETH/WETH, WBTC, wstETH, eETH

---

## 3. Wallet Connection

**Library:** RainbowKit v2 + wagmi v2 + viem v2

**Supported wallets:**

- MetaMask
- Rabby
- WalletConnect v2
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

**Status:** ✅ Complete per codebase summary

---

## 4. Position Display

### Data Source — CHANGED in v2

**Provider:** Zerion API  
**Why:** DeBank Pro API requires paid units upfront with no free tier. Zerion provides a free tier of 3,000 calls/day, sufficient for Phase 1 scale (10–30 users with 60-second caching). Zerion covers all four supported protocols across Ethereum and Arbitrum.

**Base URL:** `https://api.zerion.io/v1`  
**Auth:** HTTP Basic — API key as username, empty password  
**Docs:** <https://developers.zerion.io>

All calls proxied through `/api/positions` server route to protect API key. Never call Zerion directly from client components.

### Zerion Endpoint

```
GET https://api.zerion.io/v1/wallets/{address}/positions/
```

**Query parameters:**

```
filter[position_types]=wallet,deposited    # exclude borrowed, locked, staked
filter[chain_ids]=ethereum,arbitrum        # Ethereum and Arbitrum only
filter[dapp_ids]=aave-v3,morpho,pendle,euler-v2  # supported protocols only
currency=usd
```

**Headers:**

```
Authorization: Basic {base64(ZERION_API_KEY + ":")}
Accept: application/json
```

### Zerion Response Shape

Zerion returns a `data` array of position objects. Each has this structure:

```typescript
// Raw Zerion position — for reference, do not expose to frontend
interface ZerionPosition {
  type: 'positions'
  id: string
  attributes: {
    position_type: 'wallet' | 'deposited' | 'borrowed' | 'locked' | 'staked'
    value: number | null           // USD value
    quantity: {
      decimals: number
      float: number                // token amount as float
      numeric: string              // token amount as string
    }
    apy: number | null             // as decimal e.g. 0.065
    dapp_id: string | null         // e.g. 'aave-v3', 'morpho', 'pendle', 'euler-v2'
    changes: {
      absolute_1d: number | null
      percent_1d: number | null
    }
  }
  relationships: {
    chain: { data: { id: string } }        // 'ethereum', 'arbitrum'
    fungible: { data: { id: string } }     // fungible asset id
  }
}
```

### Protocol ID Mapping

Map Zerion `dapp_id` values to Verdant protocol names:

```typescript
// lib/data/zerion.ts
const ZERION_DAPP_TO_PROTOCOL: Record<string, Position['protocol']> = {
  'aave-v3':   'aave',
  'morpho':    'morpho',
  'pendle':    'pendle',
  'euler-v2':  'euler',
}

const ZERION_CHAIN_TO_VERDANT: Record<string, Position['chain']> = {
  'ethereum': 'ethereum',
  'arbitrum': 'arbitrum',
}
```

### Normalised Position Data Model

Unchanged from v1 — Zerion data normalises into the same Position type:

```typescript
// types/position.ts
interface Position {
  id: string
  protocol: 'aave' | 'morpho' | 'pendle' | 'euler'
  chain: 'ethereum' | 'arbitrum'
  asset: string              // token symbol
  assetAddress: string
  amount: number             // token amount as float
  amountUsd: number          // USD value
  currentApy: number         // as decimal e.g. 0.065 = 6.5%
  claimableRewards: Reward[]
  positionType: 'supply' | 'borrow' | 'lp'
  metadata: ProtocolMetadata
}

interface Reward {
  token: string
  amount: number
  amountUsd: number
}
```

**Note on claimable rewards:** Zerion does not surface per-position claimable reward amounts in the positions endpoint. For reward detection, query protocol SDKs directly server-side via `/api/rewards`. The `claimableRewards` field on Position is populated by that separate call, not by Zerion.

### Zerion API Client

```typescript
// lib/data/zerion.ts

const ZERION_BASE = 'https://api.zerion.io/v1'

// Basic auth: API key as username, empty password
function zerionAuthHeader(): string {
  const encoded = Buffer.from(`${process.env.ZERION_API_KEY}:`).toString('base64')
  return `Basic ${encoded}`
}

const SUPPORTED_DAPP_IDS = ['aave-v3', 'morpho', 'pendle', 'euler-v2']
const SUPPORTED_CHAIN_IDS = ['ethereum', 'arbitrum']
const SUPPORTED_ASSETS = ['usdc', 'usdt', 'eth', 'weth', 'wbtc', 'wsteth', 'eeth']

export async function fetchZerionPositions(address: string): Promise<Position[]> {
  const params = new URLSearchParams({
    'filter[position_types]': 'wallet,deposited',
    'filter[chain_ids]':      SUPPORTED_CHAIN_IDS.join(','),
    'filter[dapp_ids]':       SUPPORTED_DAPP_IDS.join(','),
    'currency':               'usd',
  })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const res = await fetch(
      `${ZERION_BASE}/wallets/${address}/positions/?${params}`,
      {
        headers: {
          Authorization: zerionAuthHeader(),
          Accept: 'application/json',
        },
        signal: controller.signal,
      }
    )

    if (!res.ok) {
      throw new Error(`Zerion API error: ${res.status} ${res.statusText}`)
    }

    const json = await res.json()
    return normaliseZerionPositions(json.data ?? [])

  } finally {
    clearTimeout(timeout)
  }
}

function normaliseZerionPositions(raw: ZerionPosition[]): Position[] {
  return raw
    .filter(p => {
      const dappId   = p.attributes.dapp_id
      const chainId  = p.relationships.chain.data.id
      return (
        dappId &&
        ZERION_DAPP_TO_PROTOCOL[dappId] &&
        ZERION_CHAIN_TO_VERDANT[chainId]
      )
    })
    .map(p => ({
      id:             p.id,
      protocol:       ZERION_DAPP_TO_PROTOCOL[p.attributes.dapp_id!],
      chain:          ZERION_CHAIN_TO_VERDANT[p.relationships.chain.data.id],
      asset:          '',           // populated from fungible lookup — see note below
      assetAddress:   '',           // populated from fungible lookup
      amount:         p.attributes.quantity.float,
      amountUsd:      p.attributes.value ?? 0,
      currentApy:     p.attributes.apy ?? 0,
      claimableRewards: [],         // populated by /api/rewards separately
      positionType:   p.attributes.position_type === 'deposited' ? 'supply' : 'lp',
      metadata:       {},
    }))
}
```

**Note on asset symbol and address:** Zerion's positions endpoint returns a fungible asset ID in `relationships.fungible`. To get symbol and address, call the fungibles endpoint or include `?include=fungible` in the request. Use the include parameter to avoid a second round-trip:

```
GET /v1/wallets/{address}/positions/?include=fungible&...
```

Then in the response, `included` contains fungible objects keyed by id. Map them when normalising positions.

### Display Requirements

- Show all positions grouped by chain
- Show USD value, APY, claimable rewards per position
- Show total portfolio value in header (sum of all `amountUsd`)
- Loading skeleton while fetching
- Manual refresh button — do not auto-poll (preserve free tier request budget)
- Empty state if no positions found on supported protocols
- Cache response for 60 seconds per address in Next.js route handler

---

## 5. Execution Flow — Core Feature

Unchanged from v1. Full specification retained below.

### Step 0: Asset and Destination Selection

User selects:

1. **Source:** Which position or asset to move
2. **Amount:** Full position or custom amount (validated against wallet balance)
3. **Destination protocol:** One of Aave, Morpho, Pendle, Euler
4. **Destination chain:** Ethereum or Arbitrum

Validation rules:

- Minimum transaction: $1,000 USD equivalent
- Cannot move to same protocol + chain as source
- Pendle destinations: show maturity date prominently, require acknowledgement

### Step 1: Cost Preview Screen

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
interface CostPreviewInput {
  asset: string
  amountUsd: number
  sourceProtocol: Protocol
  sourceChain: Chain
  destProtocol: Protocol
  destChain: Chain
}

interface CostPreviewResult {
  bridgeFeeUsd: number
  slippageUsd: number
  gasStep1Usd: number
  gasStep2Usd: number
  totalSwitchingCostUsd: number
  currentApyDecimal: number
  targetApyDecimal: number
  netUpliftDecimal: number
  dailyYieldGainUsd: number
  breakEvenDays: number
  quoteFetchedAt: Date
  warnings: Warning[]
}
```

**Warning conditions:**

- Bridge fee > 0.5% of transaction value
- Slippage > 0.5%
- Break-even > 30 days
- Pendle maturity < 30 days away
- Target protocol utilisation > 90%

**Quote freshness:**

- Quotes expire after 60 seconds
- Show elapsed time since last fetch
- Orange warning if >30 seconds old
- Disable "Proceed" button if >90 seconds old
- Auto-refetch after 800ms debounce on amount change

### Step 2: Bridge Transaction (Step 1 of 2)

```typescript
// lib/routing/nearIntents.ts
import { IntentsSDK } from '@near-intents/sdk'

export async function createBridgeIntent(params: {
  tokenIn: string
  tokenOut: string
  amountIn: string
  slippageTolerance: number
  recipientAddress: string
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
    deadline: Date.now() + 300000,
    recipient: params.recipientAddress
  })
}
```

UI during bridge:

- Progress indicator with estimated time (2–5 minutes)
- Transaction hash with Arbiscan link
- Navigation warning if user tries to leave
- Poll completion every 15 seconds via Across status endpoint

On failure:

- Exact error message from NEAR Intents / Across
- Retry button with fresh quote
- Across bridge recovery link if funds are stuck

### Step 3: Protocol Deposit Transaction (Step 2 of 2)

```typescript
// lib/protocols/aave.ts
import { Pool } from '@aave/contract-helpers'

export async function buildAaveSupplyTx(params: {
  asset: string
  amount: string
  onBehalfOf: string
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

- Simulate every deposit via `eth_call` before showing sign prompt
- Show revert reason if simulation fails — do not show sign button
- On success: show position confirmation, APY, estimated annual yield, explorer link

---

## 6. Harvest Flow

Unchanged from v1.

- Fetch claimable rewards per position via protocol SDKs server-side
- "Harvest All" button on dashboard header
- Per-position harvest button on PositionCard
- Batch by chain — one signature per chain
- Show gas estimate before signing
- Auto-compound toggle per position — user-confirmed, never autonomous
- Minimum harvest threshold configurable (default $10 USD)
- Preferences persisted in Supabase

---

## 7. Database Schema (Supabase)

Unchanged from v1.

```sql
CREATE TABLE user_settings (
  wallet_address  TEXT PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE execution_history (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address        TEXT NOT NULL,
  tx_hash_step1         TEXT,
  tx_hash_step2         TEXT,
  source_protocol       TEXT,
  source_chain          TEXT,
  dest_protocol         TEXT,
  dest_chain            TEXT,
  asset                 TEXT,
  amount_usd            NUMERIC,
  bridge_fee_usd        NUMERIC,
  slippage_usd          NUMERIC,
  gas_usd               NUMERIC,
  status                TEXT DEFAULT 'pending',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  completed_at          TIMESTAMPTZ
);

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

---

## 8. API Routes

### GET /api/positions?address={wallet} — CHANGED in v2

Proxies Zerion API. Returns normalised Position array.  
Cache: 60 seconds per address via `Cache-Control: s-maxage=60, stale-while-revalidate`.

**Implementation:**

```typescript
// app/api/positions/route.ts
import { fetchZerionPositions } from '@/lib/data/zerion'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')

  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { error: 'Invalid or missing wallet address' },
      { status: 400 }
    )
  }

  try {
    const positions = await fetchZerionPositions(address)
    return NextResponse.json(
      { positions },
      {
        headers: {
          'Cache-Control': 's-maxage=60, stale-while-revalidate=120',
        },
      }
    )
  } catch (err) {
    console.error('[positions] Zerion fetch failed:', err)
    return NextResponse.json(
      { error: 'Could not load positions. Please try again.' },
      { status: 502 }
    )
  }
}
```

### POST /api/quote

Unchanged. Fetches in parallel: Across bridge quote, NEAR Intents swap quote, Alchemy gas estimates, Defillama APYs. No cache — always fresh.

### GET /api/apys?protocol={protocol}&chain={chain}&asset={asset}

Unchanged. Proxies Defillama Yields API. Cache: 5 minutes.

### POST /api/simulate

Unchanged. Simulates transaction via eth_call or Tenderly. Returns success/failure with revert reason.

### GET /api/rewards?address={wallet}

Unchanged. Fetches claimable rewards via protocol SDKs server-side. Cache: 2 minutes.

---

## 9. Environment Variables — CHANGED in v2

```bash
# Alchemy
ALCHEMY_API_KEY_ETHEREUM=
ALCHEMY_API_KEY_ARBITRUM=

# Zerion (replaces DeBank)
ZERION_API_KEY=                     # ADDED — get from developers.zerion.io

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

# NEAR Intents
NEAR_INTENTS_API_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Tenderly (optional — for simulation)
TENDERLY_ACCOUNT=
TENDERLY_PROJECT=
TENDERLY_ACCESS_KEY=

# App
NEXT_PUBLIC_APP_URL=
NODE_ENV=
```

**Removed:** `DEBANK_API_KEY`, `PENDLE_HOSTED_SDK_API_KEY` (Pendle SDK does not require an API key)  
**Added:** `ZERION_API_KEY`

`ZERION_API_KEY` is server-only. Never reference it outside `/app/api/` routes.

---

## 10. Error Handling Standards

Every user-facing error must be specific, actionable, and non-blocking.

| Error scenario | Message | Action |
|---|---|---|
| Bridge quote fetch failed | "Could not get bridge quote. Network may be congested." | Retry button |
| Bridge transaction rejected | "Transaction cancelled." | Return to cost preview |
| Bridge stuck / timeout | "Bridge is taking longer than expected." | Link to Across status tracker |
| Deposit simulation failed | "This deposit would fail: [revert reason]" | Suggest alternative or contact support |
| Deposit transaction rejected | "Transaction cancelled." | Return to cost preview |
| Zerion API unavailable | "Could not load positions. Using cached data." | Show last known positions with timestamp |
| Wallet not connected | — | Prompt to connect wallet |
| Unsupported chain | "Switch to Ethereum or Arbitrum to continue." | Switch network button |
| Amount below minimum | "Minimum transaction is $1,000 to cover fees." | Inline validation |

---

## 11. Build Order and Milestones

### Milestone 1 — Core Infrastructure ✅ Complete

- [x] Next.js project setup with TypeScript
- [x] RainbowKit + wagmi wallet connection
- [x] Alchemy RPC configuration for Ethereum + Arbitrum
- [x] Supabase project and schema migration
- [x] ~~DeBank~~ Zerion API proxy route and position fetching  ← **in progress, see migration steps**
- [x] Basic dashboard layout showing positions
- [x] Environment variable setup

### Milestone 2 — Execution Flow 🔄 Mostly Complete

- [x] NEAR Intents SDK integration and bridge quote fetching
- [x] Across Protocol SDK integration
- [x] Cost preview calculator (all components)
- [x] Cost preview UI component
- [x] Quote refresh and staleness logic
- [x] Warning detection and display
- [x] Step 1 bridge transaction construction and signing
- [x] Bridge status polling
- [x] Step 2 deposit transaction construction — Aave V3 first
- [x] Transaction simulation before signing
- [x] Execution history recording in Supabase

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
