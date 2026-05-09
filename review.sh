#!/bin/bash
# review.sh — Verdant code review using Gemini CLI
# Usage:
#   ./review.sh lib/costPreview/calculator.ts
#   ./review.sh lib/routing/nearIntents.ts lib/protocols/aave.ts
#   cat lib/protocols/aave.ts | ./review.sh
#   ./review.sh  (reviews all staged git changes)

set -e

# ── Colours ────────────────────────────────────────────────────────────────
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # no colour

# ── Prompt injected into every review ──────────────────────────────────────
VERDANT_CONTEXT="
You are reviewing code for Verdant, a cross-chain DeFi wallet and yield execution tool.
This is v3. Read every constraint below before reviewing anything.

━━━ SECURITY — CRITICAL, check every file ━━━
- API keys must NEVER appear in client-side code. Only accessible inside /app/api/ routes or /lib/server/ utilities.
  Violating env vars: ZERION_API_KEY, ALCHEMY_API_KEY_*, SUPABASE_SERVICE_ROLE_KEY, TENDERLY_ACCESS_KEY, NEAR_INTENTS_API_KEY.
  Safe client vars (NEXT_PUBLIC_ prefix only): NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY.
- Private keys and seed phrases must never be requested, stored, or logged anywhere.
- Verdant must never hold user funds in any Verdant-controlled address or contract.
- Every transaction must pass simulation (eth_call via Alchemy, or Tenderly fallback) before the sign button is shown.
  A SequenceStep must not reach status 'ready' without a passing SimulationResult.
- All external API calls (Zerion, Defillama, bridge APIs) must be proxied through /app/api/ — never called from client components or hooks directly.
- No hardcoded contract addresses — all addresses must come from the plugin registry (lib/plugins/protocols/ or lib/plugins/chains/).

━━━ PLUGIN ARCHITECTURE — check any new chain, protocol, or bridge code ━━━
- Every chain must implement ChainPlugin (lib/plugins/types/chain-plugin.ts) and be registered in CHAIN_REGISTRY.
- Every protocol must implement ProtocolPlugin (lib/plugins/types/protocol-plugin.ts) and be registered in PROTOCOL_REGISTRY.
- Every bridge must implement BridgePlugin (lib/plugins/types/bridge-plugin.ts) and be registered in BRIDGE_REGISTRY.
- Protocol logic must NOT appear in API routes or UI components directly — only through plugin interfaces.
- Client components must NOT import from lib/plugins/ directly — only through hooks (hooks/use*.ts).
- Supported chains: Ethereum (chainId 1), Arbitrum One (chainId 42161), Base (chainId 8453), Solana mainnet.
- Supported protocols: Aave V3, Morpho, Pendle, Euler.
- Supported bridges: Across, LayerZero (CCTP), NEAR Intents.
- No vault infrastructure, LP deposit mechanisms, vault tokens, or NAV accounting — that is a future phase.
- Zero novel smart contracts — only official audited protocol SDKs and ABIs.

━━━ SEQUENCER — check any file in lib/sequencer/ or hooks/useSequencer.ts ━━━
- No step may have status 'ready' without a SimulationResult where success === true.
- No direct wallet.sendTransaction() calls outside of useSequencer.ts.
- Steps must be executed sequentially — a step cannot start until all steps in its dependsOn array are 'confirmed'.
- SequencePlan must be persisted to Supabase after creation and after each step status change.
- De-leverage sequences must include a health factor guard: refuse to build any step that would result in HF < 1.05.

━━━ TRANSACTION SAFETY ━━━
- Quote freshness enforced: reject bridge quotes older than 90 seconds before allowing signing.
- Slippage tolerance must be explicitly set on every swap or bridge call — never rely on protocol defaults.
- Minimum transaction size of \$1,000 USD validated server-side before any sequence plan is created.
- Warning conditions must fire for: bridge fee >0.5% of tx value, slippage >0.5%, break-even >30 days,
  Pendle PT maturity <30 days, target pool utilisation >90%, Aave health factor dropping below 1.5.
- Health factor warnings below 1.5 must require an explicit checkbox confirmation from the user before proceeding.

━━━ CODE QUALITY ━━━
- No 'any' types — all functions must have explicit TypeScript types.
- ChainId, ProtocolId, BridgeId, TokenSymbol must always use the defined union types — never raw strings.
- All Promise chains must have error handling (try/catch or .catch()).
- All external API calls must have timeout handling (AbortController or equivalent).
- Environment variables must use exactly the names defined in SPECS.md Section 18 — do not invent new names.
- Zod schemas required for all /app/api/ route inputs.

━━━ STACK ━━━
- Next.js 14 App Router, TypeScript, RainbowKit v2, wagmi v2, viem v2, Tailwind CSS, Supabase
- Solana: @solana/web3.js, @solana/wallet-adapter-react, @solana/wallet-adapter-wallets
- Aave: @aave/contract-helpers + @aave/math-utils
- Morpho: @morpho-org/morpho-ts
- Pendle: Pendle Hosted SDK (api-v2.pendle.finance/core) — no API key required
- Bridges: Across SDK, LayerZero lz-v2-utilities, @near-intents/sdk

━━━ OUTPUT FORMAT ━━━
For each issue found:
  SEVERITY: CRITICAL | HIGH | MEDIUM | LOW
  FILE: path/to/file.ts (line N if known)
  PROBLEM: what is wrong
  FIX: exactly how to fix it

Group issues by severity, CRITICAL first.
If no issues are found in a category, state that explicitly.
Do not invent problems. Do not flag style preferences as issues.
"

# ── Build the code payload ──────────────────────────────────────────────────
CODE_PAYLOAD=""

if [ ! -t 0 ]; then
  # Piped input
  CODE_PAYLOAD=$(cat)
  SOURCE_LABEL="(piped input)"

elif [ "$#" -eq 0 ]; then
  # No args — review all staged git changes
  if ! git diff --cached --quiet; then
    CODE_PAYLOAD=$(git diff --cached)
    SOURCE_LABEL="staged git changes"
  elif ! git diff --quiet; then
    CODE_PAYLOAD=$(git diff)
    SOURCE_LABEL="unstaged git changes"
  else
    echo -e "${YELLOW}No files specified, no staged or unstaged git changes found.${NC}"
    echo "Usage: ./review.sh <file1> [file2] ..."
    exit 1
  fi

else
  # One or more file paths
  for FILE in "$@"; do
    if [ ! -f "$FILE" ]; then
      echo -e "${RED}File not found: $FILE${NC}"
      exit 1
    fi
    CODE_PAYLOAD+="
=== FILE: $FILE ===
$(cat "$FILE")
"
  done
  SOURCE_LABEL="$*"
fi

if [ -z "$CODE_PAYLOAD" ]; then
  echo -e "${RED}No code to review.${NC}"
  exit 1
fi

# ── Run review ─────────────────────────────────────────────────────────────
echo -e "${CYAN}▶ Reviewing: ${SOURCE_LABEL}${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

FULL_PROMPT="${VERDANT_CONTEXT}

Review the following code:

${CODE_PAYLOAD}"

gemini "$FULL_PROMPT"

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Review complete${NC}"