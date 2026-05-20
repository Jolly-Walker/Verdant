M7 Tickets

M7-01 — Fix expiresAt on all four bridge plugins
Files: across.ts, layerzero.ts, nearIntents.ts, chainlink.ts
Priority: 🔴 Critical — merge blocker
Problem
All four plugins have quote expiry windows far exceeding the 90-second system limit established in M5 and enforced by the M6 simulate route. The simulate route rejects quotes where expiresAt < Date.now() + 5000, but a quote valid for 1 hour can still be used to sign a transaction against a stale price. This directly undermines the security model.
PluginCurrentRequiredacross.ts5 minutes90 secondslayerzero.ts1 hour90 secondsnearIntents.ts30 minutes90 secondschainlink.ts30 minutes90 seconds
Fix: In every getQuote return block, change:
tsexpiresAt: new Date(Date.now() + 90 * 1000),
Acceptance criteria

 All four plugins return expiresAt of exactly Date.now() + 90_000
 Each plugin's test file asserts quote.expiresAt is within 90–91 seconds of Date.now()


M7-02 — Fix expectedOutputAmount sort precision
Files: frontend/app/api/bridges/quote/route.ts, frontend/lib/plugins/bridges/index.ts
Priority: 🟠 High
Problem
Both the route handler and getBridgeQuotes() in index.ts sort quotes using:
ts.sort((a, b) => Number(b.expectedOutputAmount) - Number(a.expectedOutputAmount))
expectedOutputAmount is a Wei-denominated string. Number() loses precision above 2^53 (~9 ETH). For high-value transfers, the sort order can be incorrect and the wrong bridge selected as recommended.
Fix: Replace with a BigInt comparison in both locations:
ts.sort((a, b) => {
  const diff = BigInt(b.expectedOutputAmount) - BigInt(a.expectedOutputAmount)
  return diff > 0n ? 1 : diff < 0n ? -1 : 0
})
Acceptance criteria

 Sort uses BigInt in both route.ts and index.ts
 A test in the route or index tests asserts correct sort order for amounts above Number.MAX_SAFE_INTEGER


M7-03 — Add fetchWithTimeout to Across and NEAR Intents plugin fetch calls
Files: frontend/lib/plugins/bridges/across.ts, frontend/lib/plugins/bridges/nearIntents.ts
Priority: 🟠 High
Problem
Both plugins call fetch() with no timeout. The quote route wraps all plugin calls with an outer AbortController, but the signal is never passed into the plugin. A hung Across or Defuse RPC call will keep running in the background after the route returns 504.
Fix: Import fetchWithTimeout from @/lib/utils/fetch and replace all fetch(url, options) calls in both plugins:
tsimport { fetchWithTimeout } from '@/lib/utils/fetch'

// In getQuote:
const response = await fetchWithTimeout(url, { timeout: 8000 })

// In pollStatus (across):
const response = await fetchWithTimeout(
  `https://across.to/api/deposit/status?originTransactionHash=${txHash}`,
  { timeout: 8000 }
)
Use 8 seconds so the plugin timeout fires before the route's 10-second outer timeout.
Acceptance criteria

 fetchWithTimeout imported and used in both across.ts getQuote and pollStatus
 fetchWithTimeout imported and used in nearIntents.ts getQuote
 Tests assert that a slow/hanging fetch resolves to null (not an unhandled rejection) when the plugin times out


M7-04 — Add LINK to SUPPORTED_TOKENS or remove it from Chainlink supportedTokens
Files: frontend/constants/tokens.ts and/or frontend/lib/plugins/bridges/chainlink.ts
Priority: 🟠 High
Problem
chainlinkBridgePlugin.supportedTokens lists ['ETH', 'USDC', 'LINK']. buildBridgeTx calls SUPPORTED_TOKENS['LINK'] which returns undefined, causing the function to throw Token LINK not supported on ethereum. Any LINK bridge attempt crashes at execution time.
Option A (preferred): Add LINK to SUPPORTED_TOKENS in tokens.ts:
ts'LINK': {
  symbol: 'LINK',
  name: 'Chainlink',
  decimals: 18,
  coingeckoId: 'chainlink',
  addresses: {
    ethereum: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    arbitrum: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
    base: '0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196',
  }
}
Option B: Remove 'LINK' from supportedTokens until it's properly registered.
Acceptance criteria

 Either LINK is in SUPPORTED_TOKENS with correct mainnet addresses, or chainlinkBridgePlugin.supportedTokens does not include 'LINK'
 buildBridgeTx does not throw for any token in supportedTokens
 Test added: getQuote with token: 'LINK' either succeeds or returns null — it must not throw


M7-05 — Chainlink CCIP: fetch native fee and include in transaction value
Files: frontend/lib/plugins/bridges/chainlink.ts
Priority: 🟠 High
Problem
For non-ETH token transfers (USDC, LINK), buildBridgeTx returns value: BigInt(0). The CCIP router's ccipSend function requires msg.value to cover the native messaging fee — passing zero causes the transaction to revert with InsufficientFeeTokenAmount. The code comment acknowledges this: // Value also needs to cover the fee!
Fix: Before constructing the data, call router.getFee via viem to get the required native fee amount, then include it in value:
tsimport { getPublicClient } from '@/lib/server/rpc'

const GET_FEE_ABI = [{
  name: 'getFee',
  type: 'function',
  stateMutability: 'view',
  inputs: [
    { name: 'destinationChainSelector', type: 'uint64' },
    { name: 'message', type: 'tuple', components: [/* same as ccipSend message */] }
  ],
  outputs: [{ name: 'fee', type: 'uint256' }]
}] as const

const client = getPublicClient(fromChain as ChainId)
const fee = await client.readContract({
  address: routerAddress as `0x${string}`,
  abi: GET_FEE_ABI,
  functionName: 'getFee',
  args: [destSelector, message]
})

return {
  ...
  value: token === 'ETH' ? BigInt(amount) + fee : fee,
}
Acceptance criteria

 buildBridgeTx calls getFee on the CCIP router before returning
 value includes the native fee for both ETH and ERC20 transfers
 Test mocks readContract and asserts value is non-zero for a USDC transfer


M7-06 — Add pollStatus tracking URLs for LayerZero and Chainlink
Files: frontend/lib/plugins/bridges/layerzero.ts, frontend/lib/plugins/bridges/chainlink.ts
Priority: 🟡 Medium
Problem
Both plugins return { status: 'pending' } with no comment and no tracking URL. The spec requires BridgePending.tsx to show a status link. StepOneBridge currently shows via {selectedQuote?.bridgeId} as raw text with no link.
Fix — plugins: Return a trackingUrl on the pending status:
ts// layerzero.ts
return {
  status: 'pending',
  trackingUrl: `https://layerzeroscan.com/tx/${txHash}`
}

// chainlink.ts
return {
  status: 'pending',
  trackingUrl: `https://ccip.chain.link/tx/${txHash}`
}
Fix — BridgeStatus type: Add trackingUrl?: string to the BridgeStatus interface in types/shared.ts.
Fix — StepOneBridge: In the pending state, render the tracking URL as a link if available:
tsx{selectedQuote && (
  <p>
    Bridging via {BRIDGE_METADATA[selectedQuote.bridgeId].name}
    {bridgeTrackingUrl && (
      <a href={bridgeTrackingUrl} target="_blank" rel="noopener noreferrer">
        View status ↗
      </a>
    )}
  </p>
)}
Acceptance criteria

 BridgeStatus has trackingUrl?: string
 LayerZero pollStatus returns trackingUrl: https://layerzeroscan.com/tx/${txHash}
 Chainlink pollStatus returns trackingUrl: https://ccip.chain.link/tx/${txHash}
 StepOneBridge renders the tracking URL as an anchor tag when present
 Both Across and NEAR Intents pollStatus return trackingUrl when destinationTxHash is known (https://solscan.io/tx/${destinationTxHash} for NEAR, https://etherscan.io/tx/${destinationTxHash} for Across)


M7-07 — Add server-only guard to supabase.ts and fix module-level instantiation
File: frontend/lib/data/supabase.ts
Priority: 🟡 Medium
Problem
supabase.ts exports supabaseAdmin which is initialised with SUPABASE_SERVICE_ROLE_KEY at module load time. Two issues:

No import 'server-only' — the file could be accidentally imported client-side, leaking the service key into the browser bundle
Module-level client instantiation — env vars may not be loaded at cold start in serverless environments (the same pattern fixed in sequencePlans.ts during M5)

Fix:
tsimport 'server-only'

// Replace module-level supabaseAdmin with a lazy getter:
let _adminClient: ReturnType<typeof createClient> | null = null

export function getSupabaseAdmin() {
  if (_adminClient) return _adminClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase admin env vars not configured')
  _adminClient = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return _adminClient
}
Update the bridge quote route to call getSupabaseAdmin() instead of importing supabaseAdmin.
Acceptance criteria

 import 'server-only' is the first line of supabase.ts
 supabaseAdmin module-level export replaced with getSupabaseAdmin() lazy function
 Bridge quote route updated to call getSupabaseAdmin()
 Any other callers of supabaseAdmin updated accordingly


M7-08 — Improve bridge plugin unit test coverage
Files: All four __tests__/*.test.ts files
Priority: 🟡 Medium
Problem
Current tests cover the happy path and one or two edge cases. The following paths are completely untested across all four plugins:
Missing across all applicable plugins:

getQuote returns null for an unsupported token
getQuote returns null for an unsupported route (e.g. ethereum → solana for Across)
getQuote returns null when the external API returns a non-OK response
getQuote returns null when the external API throws (network error)
pollStatus returns { status: 'failed' } for expired status (Across only)
pollStatus returns { status: 'complete', destinationTxHash } correctly (Across only — already tested, but destinationTxHash should be asserted)

Missing for LayerZero specifically:

getQuote returns null when token !== 'USDC'
buildBridgeTx throws for an unsupported fromChain

Missing for NEAR Intents specifically:

getQuote returns null when toChain !== 'solana'
getQuote returns null when Defuse RPC returns data.error
getQuote returns null when response.ok is false

Missing for Chainlink specifically:

getQuote returns null for toChain: 'solana' (no CCIP selector)
buildBridgeTx throws for unknown fromChain

Acceptance criteria

 Each plugin has tests for: unsupported token, unsupported route, API failure, API non-OK response (where applicable)
 Across has a test for pollStatus returning failed when status is expired
 LayerZero has a test for getQuote returning null for non-USDC tokens
 NEAR Intents has a test for getQuote returning null when toChain !== 'solana'
 Total test cases across all four files increases from current 15 to at least 28


M7-09 — Remove dead getBridgeQuotes export from bridges/index.ts
File: frontend/lib/plugins/bridges/index.ts
Priority: 🟡 Medium
Problem
getBridgeQuotes() is exported from index.ts but never imported anywhere — the bridge quote route reimplements the same logic inline. Dead exports invite future callers to use the version without caching, bypassing the 30s TTL.
Fix: Either delete getBridgeQuotes from index.ts and have the route be the sole source of bridge quote fetching, or keep it and have the route call it (moving the caching logic into a data layer function). The cleaner option is deletion — the route's inline implementation already handles the timeout, sorting, and caching.
Acceptance criteria

 getBridgeQuotes is either deleted from index.ts or is the function called by the route (not duplicated)
 No callers reference the deleted export


M7-10 — Validate recipientAddress format in the bridge quote route
File: frontend/app/api/bridges/quote/route.ts
Priority: 🟡 Medium
Problem
recipientAddress is accepted as a raw z.string() with no format validation. An invalid address (empty string, partial hex, wrong length) will be passed directly to the Across API and the Defuse RPC, which will either return an error or — worse — silently return a quote for a garbage address. For NEAR Intents, an invalid Solana address passed as account_id will produce a deposit address that no one can claim funds from.
Fix: Use isValidAddress from @/lib/utils/chains in a .refine() on the schema. Since the route doesn't know which chain the recipient is on (the recipient chain is toChain), use:
tsrecipientAddress: z.string().refine(
  addr => isValidAddress(addr, result.data.toChain) || isValidAddress(addr, 'ethereum'),
  { message: 'Invalid recipient address for the destination chain' }
)
Because Zod's refine runs after parsing and can't reference sibling fields, validate recipientAddress in a separate .superRefine on the full object after initial parse:
ts.superRefine((data, ctx) => {
  if (!isValidAddress(data.recipientAddress, data.toChain)) {
    ctx.addIssue({ code: 'custom', path: ['recipientAddress'], message: 'Invalid recipient address for destination chain' })
  }
})
Acceptance criteria

 An invalid recipientAddress for the given toChain returns 400
 A valid EVM address passes for EVM toChain values
 A valid Solana Base58 address passes for toChain: 'solana'
 Test added to route tests (or a new route test file) covering the validation rejection