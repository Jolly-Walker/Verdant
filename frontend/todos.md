M7 Tickets

M7-01 — Fix expiresAt on all four bridge plugins ✅
Files: across.ts, layerzero.ts, nearIntents.ts, chainlink.ts
Priority: 🔴 Critical — merge blocker
Problem
All four plugins have quote expiry windows far exceeding the 90-second system limit established in M5 and enforced by the M6 simulate route.
Acceptance criteria
 [x] All four plugins return expiresAt of exactly Date.now() + 90_000
 [x] Each plugin's test file asserts quote.expiresAt is within 90–91 seconds of Date.now()

M7-02 — Fix expectedOutputAmount sort precision ✅
Files: frontend/app/api/bridges/quote/route.ts, frontend/lib/plugins/bridges/index.ts
Priority: 🟠 High
Problem
Number() loses precision above 2^53.
Acceptance criteria
 [x] Sort uses BigInt in both route.ts and index.ts (refactored to shared utility)
 [x] A test in the route or index tests asserts correct sort order for amounts above Number.MAX_SAFE_INTEGER

M7-03 — Add fetchWithTimeout to Across and NEAR Intents plugin fetch calls ✅
Files: frontend/lib/plugins/bridges/across.ts, frontend/lib/plugins/bridges/nearIntents.ts
Priority: 🟠 High
Problem
Both plugins call fetch() with no timeout.
Acceptance criteria
 [x] fetchWithTimeout imported and used in both across.ts getQuote and pollStatus
 [x] fetchWithTimeout imported and used in nearIntents.ts getQuote
 [x] Tests assert that a slow/hanging fetch resolves to null (not an unhandled rejection) when the plugin times out

M7-04 — Add LINK to SUPPORTED_TOKENS or remove it from Chainlink supportedTokens ✅
Files: frontend/constants/tokens.ts and/or frontend/lib/plugins/bridges/chainlink.ts
Priority: 🟠 High
Problem
LINK bridge attempt crashes at execution time if not in SUPPORTED_TOKENS.
Acceptance criteria
 [x] Either LINK is in SUPPORTED_TOKENS with correct mainnet addresses, or chainlinkBridgePlugin.supportedTokens does not include 'LINK'
 [x] buildBridgeTx does not throw for any token in supportedTokens
 [x] Test added: getQuote with token: 'LINK' either succeeds or returns null — it must not throw

M7-05 — Chainlink CCIP: fetch native fee and include in transaction value ✅
Files: frontend/lib/plugins/bridges/chainlink.ts
Priority: 🟠 High
Problem
CCIP router requires msg.value to cover the native messaging fee.
Acceptance criteria
 [x] buildBridgeTx calls getFee on the CCIP router before returning
 [x] value includes the native fee for both ETH and ERC20 transfers
 [x] Test mocks readContract and asserts value is non-zero for a USDC transfer
 [x] (Added) Fix extraArgs encoding bug (selector padding)

M7-06 — Add pollStatus tracking URLs for LayerZero and Chainlink ✅
Files: frontend/lib/plugins/bridges/layerzero.ts, frontend/lib/plugins/bridges/chainlink.ts
Priority: 🟡 Medium
Problem
Plugins return { status: 'pending' } with no tracking URL.
Acceptance criteria
 [x] BridgeStatus has trackingUrl?: string
 [x] LayerZero pollStatus returns trackingUrl: https://layerzeroscan.com/tx/${txHash}
 [x] Chainlink pollStatus returns trackingUrl: https://ccip.chain.link/tx/${txHash}
 [x] StepOneBridge renders the tracking URL as an anchor tag when present
 [x] Both Across and NEAR Intents pollStatus return trackingUrl when destinationTxHash is known

M7-07 — Add server-only guard to supabase.ts and fix module-level instantiation ✅
File: frontend/lib/data/supabase.ts
Priority: 🟡 Medium
Problem
Possible secret leak and cold-start env var issues.
Acceptance criteria
 [x] import 'server-only' is the first line of supabase.ts
 [x] supabaseAdmin module-level export replaced with getSupabaseAdmin() lazy function
 [x] Bridge quote route updated to call getSupabaseAdmin()
 [x] Any other callers of supabaseAdmin updated accordingly

M7-08 — Improve bridge plugin unit test coverage ✅
Files: All four __tests__/*.test.ts files
Priority: 🟡 Medium
Problem
Current tests cover only the happy path.
Acceptance criteria
 [x] Each plugin has tests for: unsupported token, unsupported route, API failure, API non-OK response
 [x] Across has a test for pollStatus returning failed when status is expired
 [x] LayerZero has a test for getQuote returning null for non-USDC tokens
 [x] NEAR Intents has a test for getQuote returning null when toChain !== 'solana'
 [x] Total test cases across all four files increases to 40

M7-09 — Remove dead getBridgeQuotes export from bridges/index.ts ✅
File: frontend/lib/plugins/bridges/index.ts
Priority: 🟡 Medium
Problem
getBridgeQuotes() is exported but never used.
Acceptance criteria
 [x] getBridgeQuotes is either deleted from index.ts or is the function called by the route (not duplicated)
 [x] No callers reference the deleted export

M7-10 — Validate recipientAddress format in the bridge quote route ✅
File: frontend/app/api/bridges/quote/route.ts
Priority: 🟡 Medium
Problem
recipientAddress is accepted with no format validation.
Acceptance criteria
 [x] An invalid recipientAddress for the given toChain returns 400
 [x] A valid EVM address passes for EVM toChain values
 [x] A valid Solana Base58 address passes for toChain: 'solana'
 [x] Test added to route tests (or a new route test file) covering the validation rejection
