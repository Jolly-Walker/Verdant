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
You are reviewing code for Verdant, a cross-chain DeFi yield execution tool.

VERDANT CONSTRAINTS — check every single one:

SECURITY:
- API keys must NEVER appear in client-side code or be imported outside /app/api/ server routes
- Private keys and seed phrases must never be requested, stored, or logged anywhere
- Verdant must never hold user funds in any Verdant-controlled address
- Every transaction must be simulated (eth_call or Tenderly) before being presented to the user for signing
- All external API calls must be proxied through /app/api/ server routes — never called directly from client components
- No hardcoded addresses — all contract addresses must come from constants/protocols.ts

ARCHITECTURE:
- Zero novel smart contracts in Phase 1 — only official protocol SDKs and ABIs allowed
- Two-step signing flow only: Step 1 = bridge via NEAR Intents + Across, Step 2 = protocol deposit separately
- Supported chains: Ethereum mainnet (chainId 1) and Arbitrum One (chainId 42161) ONLY — reject any other chain
- Supported protocols: Aave V3, Morpho, Pendle, Euler ONLY
- No vault infrastructure, LP deposits, vault tokens, or NAV accounting — that is Phase 2

TRANSACTION SAFETY:
- Quote freshness must be enforced — reject quotes older than 90 seconds before signing
- Slippage tolerance must be explicitly set — never rely on protocol defaults
- Minimum transaction size of \$1,000 USD must be validated before execution
- Warning conditions must fire for: bridge fee >0.5% of tx value, slippage >0.5%, break-even >30 days, Pendle maturity <30 days, utilisation >90%

CODE QUALITY:
- All functions must have explicit TypeScript types — no 'any'
- All Promise chains must have error handling
- All external API calls must have timeout handling
- Environment variables must use the names defined in the spec — do not invent new ones

STACK:
- Next.js 14 App Router, TypeScript, RainbowKit v2, wagmi v2, viem v2, Tailwind, Supabase
- Use @aave/contract-helpers for Aave, @morpho-org/morpho-ts for Morpho, @pendle-finance/sdk for Pendle

For each issue found, state:
1. SEVERITY: CRITICAL / HIGH / MEDIUM / LOW
2. FILE + LINE (if known)
3. What the problem is
4. Exactly how to fix it

If no issues are found, say so clearly. Do not invent problems.
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