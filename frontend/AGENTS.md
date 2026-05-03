# Verdant — AI Assistant Prompt File

> **AI AGENT INSTRUCTION:** Before writing any code, search for the official documentation on [specific thing]. Then implement according to SPECS.md Section X.

## What Is Verdant?

Verdant is a discretionary multi-chain DeFi portfolio manager for on-chain power users — whales and informal fund managers managing $100K–$10M of personal or delegated capital.

It is NOT an automated yield aggregator. The user retains full control over all allocation decisions. Verdant makes the execution of those decisions fast, transparent, and low-friction through a powerful transaction sequencer.

The core value proposition is:
> "What currently takes a whale 30–45 minutes of manual bridging, swapping, and protocol interaction takes 3 minutes with Verdant — with full cost transparency and simulation before execution."

---

## Target User

- On-chain power users managing $100K–$10M
- Currently using Gnosis Safe, MetaMask, Rabby, Phantom, or Ledger
- Tracking positions in spreadsheets or Zerion
- Want to deploy and migrate capital across Ethereum, Arbitrum, Base, and Solana
- Do NOT want an autonomous vault — they want to remain in control

---

## Phase Scope (v3)

### In Scope

- Connect EVM wallets (MetaMask, Rabby, WalletConnect, Coinbase, Ledger) + Solana wallets (Phantom, Solflare, Ledger)
- Display all position types (wallet tokens, supply, borrow, Pendle PT/YT) across supported chains
- N-step Transaction Sequencer: construct and execute complex flows (e.g., de-leverage, cross-chain migrations) step-by-step
- Cost preview engine: multi-step breakdown of gas, bridge fees, slippage, net yield difference, and break-even time
- Mandatory simulation gate before any signature is requested
- Plugin registry pattern for easily adding new chains, protocols, and bridges
- Supported chains: Ethereum mainnet, Arbitrum One, Base, Solana
- Supported protocols: Aave V3, Morpho, Pendle, Euler

### Explicitly Out of Scope

- Vault infrastructure or LP deposit mechanisms
- Any novel smart contracts — use only audited external protocol interfaces
- Mobile app
- Yield discovery or strategy recommendations
- Autonomous rebalancing without user confirmation
- Custom receiver contracts for batched atomic cross-chain execution (all steps are sequential)

---

## Architecture Principles

### Plugin Registry Pattern
Every chain, protocol, and bridge is a self-contained plugin conforming to a standard interface (e.g., `ChainPlugin`, `ProtocolPlugin`). Adding a new integration means adding one file and registering it. No core code changes required.

### No Novel Smart Contracts
Verdant deploys zero custom smart contracts. All protocol interactions use official, audited ABIs from the protocols themselves.

### Sequential Signing, Never Batched
The Transaction Sequencer executes transactions one at a time. The user signs each step individually after it passes simulation. The app tracks state and enables the next step only after the previous transaction confirms.

### Simulate Before Every Signature
Every transaction must pass a simulation gate (e.g., `eth_call`) before the sign prompt is shown to the user.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14+ with App Router |
| Language | TypeScript throughout |
| Wallet connection | RainbowKit + wagmi + viem (EVM) / @solana/wallet-adapter (Solana) |
| Cross-chain routing | Across Protocol, LayerZero (CCTP), NEAR Intents |
| Position data | Zerion API + Protocol SDKs + Solana RPC |
| Protocol ABIs | Aave V3, Morpho, Pendle, Euler official repos |
| Database | Supabase (sequence plans, user preferences, quotes) |
| Styling | Tailwind CSS |
| Hosting | Vercel |
| RPC | Alchemy (Ethereum, Arbitrum, Base, Solana) |

---

## Key User Flows

### Flow 1: Execute Complex Sequence (e.g., De-leverage & Bridge)

1. User connects EVM and/or Solana wallet.
2. User sees current positions (e.g., Aave ETH/USDC loop on Ethereum).
3. User selects a Sequence Template (e.g., "De-leverage Aave Loop").
4. Cost preview screen itemises costs per step (gas, bridge fees) and break-even metrics.
5. User confirms sequence creation.
6. Sequencer moves to Step 1. Transaction is simulated.
7. User reviews simulation (state changes, gas) and signs Step 1.
8. App waits for on-chain confirmation, then simulates and prompts for Step 2.
9. Repeats until sequence is complete.

### Flow 2: Harvest Rewards

1. User sees claimable rewards across all connected protocol positions.
2. User clicks "Harvest All" or selects individual positions.
3. Sequencer generates harvest steps for each protocol/chain.
4. User simulates and signs each step sequentially.

---

## Cost Preview Engine — Critical Feature

This is the hero feature of Verdant. It itemises N-step sequences before execution:

- **Per-step gas:** Estimate gas for target calls using plugin `estimateGasCostUsd()`.
- **Bridge fee & slippage:** Query bridges (Across, LayerZero, NEAR Intents) for quotes, present the best route.
- **Net yield uplift:** (Target APY - Current APY) × position size, annualised.
- **Break-even days:** Total switching cost in USD ÷ daily net yield uplift in USD.
- **Warnings:** Health factor risks, bridge fee >0.5%, PT maturity <30 days.

All figures must be refreshed if quotes are >30 seconds old before sequence initiation.

---

## Supported Protocols & Bridges — Integration Notes

All integrations must follow the **Plugin Registry Pattern** defined in SPECS.md.
- **Aave V3, Morpho, Euler:** Include supply and borrow positions (with health factor/liquidation data).
- **Pendle:** Support PT/YT positions and surface maturity dates.
- **Bridges:** Use Across for standard EVM routing, LayerZero CCTP for USDC across EVM/Solana, and NEAR Intents for EVM-to-Solana token transfers.

---

## Data Sources

| Data | Source | Fallback |
|---|---|---|
| EVM Positions | Zerion API + Protocol SDKs | viem direct read |
| Solana Positions | Alchemy / Helius RPC | Public RPC |
| Protocol APYs | Defillama Yields API | Protocol-native subgraphs |
| Bridge quotes | Across, LayerZero, NEAR Intents | — |
| Tx Simulation | Alchemy (`eth_call`) | Tenderly (optional) |
| Token prices | Defillama Coins API | CoinGecko API |

---

## Security Constraints

----
- Never request or store private keys or seed phrases.
- Never hold user funds in any Verdant-controlled address.
- All transactions must be simulated and pass before presenting to the user.
- No batched atomic cross-chain execution — ensure sequential state tracking.
- All sensitive API keys via server-side environment variables only, never exposed client-side.

---

## What Verdant Is Not — Reminders For Development

- Not a robo-advisor. Never make autonomous allocation decisions.
- Not a single-click batched executor. You use the Sequencer.
- Not a bridge or DEX infrastructure. You use established bridge plugins.
- Not a vault protocol. Do not build LP deposit, vault tokens, or NAV accounting.
