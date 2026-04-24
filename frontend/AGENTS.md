# Verdant — AI Assistant Prompt File

## What Is Verdant?

Verdant is a discretionary cross-chain yield execution tool for on-chain power users — whales and informal fund managers managing $100K–$10M of personal or delegated capital.

It is NOT an automated yield aggregator. The user retains full control over all allocation decisions. Verdant makes the execution of those decisions fast, transparent, and low-friction.

The core value proposition is:
> "What currently takes a whale 30–45 minutes of manual bridging, swapping, and protocol interaction takes 3 minutes with Verdant — with full cost transparency before execution."

---

## Target User

- On-chain power users managing $100K–$10M
- Currently using Gnosis Safe, MetaMask, or Rabby with manual bridging
- Tracking positions in spreadsheets or Zerion
- Want to deploy capital into yield protocols across Ethereum and Arbitrum
- Do NOT want an autonomous vault — they want to remain in control

---

## Phase 1 Scope (What We Are Building Now)

### In Scope

- Connect EVM wallet (MetaMask, Rabby, WalletConnect via RainbowKit)
- Display current yield positions across Ethereum and Arbitrum using Zerion API
- Cross-chain execution flow: select asset → select destination protocol → preview full cost → execute
- Cost preview engine: bridge fee, swap slippage, gas on destination chain, net yield difference, break-even time
- Two-step signing flow: Step 1 signs the bridge/transfer via NEAR Intents + Across Protocol. Step 2 signs the protocol deposit on the destination chain
- One-click harvest of rewards across connected protocol positions
- Basic auto-compound toggle per position
- Supported chains: Ethereum mainnet + Arbitrum One only
- Supported protocols: Aave V3, Morpho, Pendle, Euler

### Explicitly Out of Scope for Phase 1

- Vault infrastructure or LP deposit mechanisms (Phase 2)
- Any novel smart contracts — use only audited external protocol interfaces
- Mobile app
- Additional chains beyond Ethereum and Arbitrum
- Yield discovery or strategy recommendations
- Autonomous rebalancing without user confirmation
- Subscription billing or paywall
- Admin dashboard or analytics backend
- Token launch or governance

---

## Architecture Principles

### No Novel Smart Contracts

Verdant Phase 1 deploys zero custom smart contracts. All protocol interactions use official, audited ABIs from Aave, Morpho, Pendle, and Euler directly. This eliminates audit risk and keeps the attack surface minimal.

### Two-Step Execution Flow

Cross-chain execution is intentionally split into two user-signed transactions:

1. Bridge/transfer transaction via NEAR Intents routing and Across Protocol
2. Protocol deposit transaction on the destination chain (e.g., Aave supply() on Arbitrum)

This is a deliberate Phase 1 decision to avoid deploying a custom receiver contract. The UX tradeoff is accepted in exchange for zero novel contract risk.

### Read-Only Position Data

Position display uses Zerion API and Defillama Yields API. Verdant does not maintain its own on-chain indexer in Phase 1.

### User Retains Custody At All Times

Verdant never holds user funds. Every transaction is signed by the user's own wallet. Verdant constructs and simulates transactions but the user approves every on-chain action.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14+ with App Router |
| Language | TypeScript throughout |
| Wallet connection | RainbowKit + wagmi + viem |
| Cross-chain routing | NEAR Intents SDK |
| Bridge | Across Protocol SDK |
| Position data | Zerion API + Defillama Yields API |
| Protocol ABIs | Aave V3, Morpho, Pendle, Euler official repos |
| Database | Supabase (user preferences, saved positions, harvest history) |
| Styling | Tailwind CSS |
| Hosting | Vercel |
| RPC | Alchemy (Ethereum + Arbitrum) |

---

## Key User Flows

### Flow 1: Execute Cross-Chain Yield Deployment

1. User connects EVM wallet
2. User sees current positions pulled from Zerion API
3. User selects an asset and amount to move (e.g., 50,000 USDC on Ethereum)
4. User selects destination: protocol + chain (e.g., Aave USDC on Arbitrum)
5. Cost preview screen displays:
   - Bridge fee in USD
   - Expected slippage in USD
   - Gas cost on destination chain
   - Current APY vs target APY
   - Net yield difference annualised
   - Break-even time in days
6. User confirms → Step 1: signs bridge transaction via NEAR Intents/Across
7. App monitors bridge completion, prompts Step 2 when funds land on Arbitrum
8. User signs protocol deposit transaction on Arbitrum
9. Position updates in dashboard

### Flow 2: Harvest Rewards

1. User sees claimable rewards across all connected protocol positions
2. User clicks "Harvest All" or selects individual positions
3. App batches harvest transactions where possible on the same chain
4. User signs per-chain (one signature per chain with pending rewards)
5. Harvested amounts shown with USD value

### Flow 3: Auto-Compound Toggle

1. User enables auto-compound on a specific position
2. App monitors reward accumulation via Alchemy event listeners
3. When reward threshold is met (user-configurable minimum USD value), app prompts user to sign compound transaction
4. User is never compounded without explicit confirmation — this is a notification + one-click sign, not autonomous execution

---

## Cost Preview Engine — Critical Feature

This is the hero feature of Verdant. It must be accurate and fast.

Components to calculate and display before any execution:

- **Bridge fee:** Query Across Protocol API for exact fee on current route and amount
- **Slippage estimate:** Query NEAR Intents quote API for expected output amount
- **Destination gas:** Estimate gas for target protocol call on Arbitrum using eth_estimateGas, priced at current Arbitrum gas price
- **Current APY:** From Defillama Yields API for user's current position
- **Target APY:** From Defillama Yields API for destination pool
- **Net yield uplift:** (Target APY - Current APY) × position size, annualised
- **Break-even days:** Total switching cost in USD ÷ (daily net yield uplift in USD)
- **Recommendation:** Surface a simple signal — "Worth moving if you hold this position for X+ days"

All figures must refresh when the user changes amount, route, or destination. Staleness indicator if quotes are >30 seconds old. User must be able to re-fetch quotes before signing.

---

## Supported Protocols — Integration Notes

### Aave V3

- Use official @aave/contract-helpers and @aave/math-utils packages
- Support supply() and withdraw() on Arbitrum and Ethereum
- Display current supply APY, utilisation rate, health factor impact

### Morpho

- Use Morpho's official SDK and subgraph
- Support MetaMorpho vault deposits and withdrawals
- Display curator, strategy description, current APY, TVL

### Pendle

- Use Pendle Hosted SDK (API: `https://api-v2.pendle.finance/core`)
- Implement "Universal Convert API" (`/v3/sdk/{chainId}/convert`) for all swap/mint/redeem operations
- Support PT (Principal Token) and YT (Yield Token) positions
- Display fixed APY for PT, implied APY for YT, maturity date
- Note maturity risk clearly in UI

### Euler

- Use Euler's official SDK and EVK (Euler Vault Kit) interfaces
- Support supply and borrow positions
- Display current rates, collateral factors

---

## Data Sources

| Data | Source | Fallback |
|---|---|---|
| Portfolio positions | Zerion API | Manual wallet read via viem |
| Protocol APYs | Defillama Yields API | Protocol-native subgraphs |
| Bridge quotes | Across Protocol API | — |
| Swap routing | NEAR Intents quote API | — |
| Gas prices | Alchemy Gas API | eth_gasPrice RPC call |
| Token prices | Defillama Coins API | CoinGecko API |

---

## Security Constraints

- Never request or store private keys or seed phrases under any circumstances
- Never hold user funds in any Verdant-controlled address
- All transaction construction must be simulated before presenting to user (use Tenderly simulation API or eth_call)
- Display clear warnings for: positions near liquidation threshold, Pendle positions approaching maturity, large slippage (>0.5%), high bridge fees (>1% of transaction value)
- Rate limit all API calls — do not expose API keys client-side
- All sensitive API keys via environment variables only, never in client bundle

---

## What Success Looks Like at End of Phase 1

- 10+ active wallets using the execution flow
- $500K+ in cumulative volume routed through Verdant
- 3+ users who have used the harvest feature
- Qualitative feedback confirming cost preview is the most valuable feature
- At least 2 users asking about vault/LP features (Product C signal)

---

## What Verdant Is Not — Reminders For Development

- Not a robo-advisor. Never make autonomous allocation decisions.
- Not a bridge. You use Across. You do not build bridge infrastructure.
- Not a DEX. You use NEAR Intents for routing. You do not build AMM logic.
- Not a portfolio tracker. Zerion does that. You display positions as context for execution, not as the core product.
- Not a vault protocol. That is Phase 2. Do not build LP deposit, vault tokens, or NAV accounting in Phase 1.
