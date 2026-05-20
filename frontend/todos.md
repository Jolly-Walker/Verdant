M8-01 — Wire "De-leverage" button in BorrowCard to the sequence planner
File: frontend/components/positions/BorrowCard.tsx
Priority: 🔴 Critical for M8 — the user-facing entry point doesn't exist
The "Repay" button is a stub and there is no "De-leverage" button at all. The spec requires a "De-leverage" button that opens the sequence planner pre-filled with the position's collateral, debt, asset, and health factor data.
Add a "De-leverage" button that navigates to /sequence?template=deleverageAave with query params pre-populated from the position:
tsximport { useRouter } from 'next/navigation'

const router = useRouter()

const handleDeleverage = () => {
  const params = new URLSearchParams({
    template: 'deleverageAave',
    protocol: position.protocol,
    chain: position.chain,
    borrowAsset: position.asset,
    collateralAsset: position.collateralAsset ?? '',
    totalDebt: position.amount.toString(),
    totalCollateral: position.collateralAmount?.toString() ?? '0',
    initialHealthFactor: position.healthFactor?.toString() ?? '1.5',
  })
  router.push(`/sequence?${params.toString()}`)
}
The sequence page already handles template=deleverageAave query params. The Position type may need collateralAsset and collateralAmount fields added if not already present — check types/position.ts.
Acceptance criteria

 "De-leverage" button is visible on BorrowCard when position.healthFactor is defined
 Clicking it navigates to /sequence with all required params pre-filled
 "Repay" button either links to a repay flow or is removed until one exists


M8-02 — Fix Number() precision bug in deleverageAave.ts
File: frontend/lib/sequencer/templates/deleverageAave.ts lines 48–49
Priority: 🔴 Critical — produces scientific notation strings that crash buildTx
ts// Current — broken for large Wei amounts
const withdrawAmount = (Number(params.totalCollateral) * withdrawFraction).toString()
const repayAmount = (Number(params.totalDebt) / params.cycles).toString()
For 18-decimal tokens (ETH, wstETH), params.totalDebt and params.totalCollateral are Wei strings like "5000000000000000000". Number("5000000000000000000") is precise here (it's ~5×10^18, within 2^53) but Number("18000000000000000000") / 3 produces "6000000000000000000" — however at the margins, e.g. "15000000000000000001" / 3, it gives 5000000000000000000.333... which .toString() renders as a float and will fail the ABI encoder.
Fix using BigInt division for the repay amount (even split is always integer-divisible by design), and a precision-safe fraction for withdraw:
ts// repayAmount — always an even split, safe as BigInt division
const totalDebtBig = BigInt(params.totalDebt)
const repayAmount = (totalDebtBig / BigInt(params.cycles)).toString()

// withdrawAmount — fraction applied via BigInt arithmetic
const totalCollateralBig = BigInt(params.totalCollateral)
// withdrawFraction is a float [0,1]; scale to avoid losing precision
const PRECISION = 1_000_000n
const withdrawFractionBig = BigInt(Math.round(withdrawFraction * Number(PRECISION)))
const withdrawAmount = ((totalCollateralBig * withdrawFractionBig) / PRECISION).toString()
Acceptance criteria

 No Number() calls on params.totalDebt or params.totalCollateral
 repayAmount and withdrawAmount are always integer strings (no decimal point, no e+)
 Existing deleverageAave template tests still pass
 A new test case uses amounts above Number.MAX_SAFE_INTEGER and asserts the resulting amounts are valid integer strings


M8-03 — Compute optimal cycle count in deleverageAave
File: frontend/lib/sequencer/templates/deleverageAave.ts
Priority: 🟠 High — spec requirement, currently user must guess
The spec requires: "compute optimal unwind cycle count." Currently params.cycles is passed in by the user/form and the template uses it directly. The optimal cycle count is the minimum number of repay+withdraw cycles needed to fully unwind the position while keeping HF above 1.05 at each step.
Add a computeOptimalCycles function before the main loop:
tsexport function computeOptimalCycles(
  totalDebtUsd: number,
  totalCollateralUsd: number,
  lt: number,
  targetHF: number = 1.05,
  maxCycles: number = 20
): number {
  let debt = totalDebtUsd
  let collateral = totalCollateralUsd
  
  for (let i = 1; i <= maxCycles; i++) {
    const repayPerCycle = totalDebtUsd / i
    debt = totalDebtUsd
    collateral = totalCollateralUsd
    let feasible = true
    
    for (let c = 0; c < i; c++) {
      debt = Math.max(0, debt - repayPerCycle)
      const maxWithdraw = debt === 0 ? collateral : Math.max(0, collateral - (debt * targetHF) / lt)
      collateral = Math.max(0, collateral - maxWithdraw)
      if (debt > 0 && (collateral * lt) / debt < targetHF) {
        feasible = false
        break
      }
    }
    
    if (feasible) return i
  }
  return maxCycles
}
Call it in buildDeleverageAavePlan when params.cycles is not provided, or always call it and use it as a validation floor:
tsconst optimalCycles = computeOptimalCycles(totalDebtUsd, totalCollateralUsd, lt)
const cycles = Math.max(params.cycles ?? optimalCycles, optimalCycles)
Export computeOptimalCycles so it can be tested independently and used in the form to show the user the recommended cycle count before plan creation.
Acceptance criteria

 computeOptimalCycles exported from deleverageAave.ts
 buildDeleverageAavePlan uses it as a floor for the actual cycle count
 Unit tests for computeOptimalCycles: low HF (needs many cycles), high HF (1 cycle sufficient), already-healthy position
 The sequence form shows the optimal cycle count as the default input value


M8-04 — Aave subgraph integration for server-side HF and debt data
Files: frontend/lib/data/aaveSubgraph.ts (new), frontend/app/api/positions/route.ts
Priority: 🟠 High — spec requirement
The spec requires Aave subgraph integration to fetch health factor and debt data server-side. Currently, fetchPositions in the Aave plugin calls getUserAccountData via direct RPC — this is acceptable but the subgraph provides richer data (borrow rate history, position age, collateral breakdown) that the de-leverage form needs.
Create frontend/lib/data/aaveSubgraph.ts with import 'server-only':
tsconst AAVE_SUBGRAPH_URLS: Partial<Record<ChainId, string>> = {
  ethereum: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3',
  arbitrum: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-arbitrum',
  base: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-base',
}

export async function fetchAaveUserData(address: string, chain: ChainId) {
  const url = AAVE_SUBGRAPH_URLS[chain]
  if (!url) return null
  
  const query = `{
    user(id: "${address.toLowerCase()}") {
      healthFactor
      totalCollateralUSD
      totalDebtUSD
      reserves {
        currentATokenBalance
        currentVariableDebt
        reserve { symbol underlyingAsset liquidationThreshold }
      }
    }
  }`
  
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    timeout: 8000,
  })
  
  if (!res.ok) return null
  const data = await res.json()
  return data?.data?.user ?? null
}
Use this in aave.ts fetchPositions as a supplement to getUserAccountData for richer per-reserve data.
Acceptance criteria

 lib/data/aaveSubgraph.ts created with server-only, uses fetchWithTimeout
 fetchAaveUserData returns null gracefully when subgraph is unavailable
 Aave fetchPositions falls back to RPC data if subgraph returns null
 Unit test: subgraph returns data → positions include collateral breakdown; subgraph returns null → falls back to RPC


M8-05 — End-to-end test: de-leverage plan creation
File: frontend/lib/sequencer/__tests__/deleverage.e2e.test.ts (new)
Priority: 🟠 High — spec requirement
The spec requires an end-to-end test for de-leverage sequence plan creation with mock positions. This does not currently exist.
Create a test that exercises the full plan-creation path:
tsdescribe('De-leverage sequence plan creation (e2e with mocks)', () => {
  it('creates a valid multi-cycle plan from a mock Aave borrow position', () => {
    const plan = buildDeleverageAavePlan({
      walletAddress: '0x1234...', 
      protocol: 'aave',
      chain: 'ethereum',
      borrowAsset: 'USDC',
      collateralAsset: 'WETH',
      totalDebt: '5000000000', // 5000 USDC (6 decimals)
      totalCollateral: '3000000000000000000', // 3 ETH (18 decimals)
      totalDebtUsd: 5000,
      totalCollateralUsd: 9000,
      initialHealthFactor: 1.8,
      cycles: 3,
    })

    expect(plan.steps.length).toBe(6) // 3 repay + 3 withdraw
    // Verify no step would result in HF < 1.05
    // Verify all amounts are integer strings (no scientific notation)
    // Verify dependency chain: each withdraw depends on its paired repay
    // Verify final state: after all steps, debt approaches zero
  })

  it('refuses to build a plan if initial HF is already below 1.05', () => {
    expect(() => buildDeleverageAavePlan({ ...params, initialHealthFactor: 1.01 }))
      .toThrow()
  })

  it('produces integer-only amount strings for high-value ETH positions', () => {
    const plan = buildDeleverageAavePlan({
      ...params,
      totalDebt: '15000000000000000001', // above MAX_SAFE_INTEGER boundary
      totalCollateral: '20000000000000000000',
      totalDebtUsd: 50000,
      totalCollateralUsd: 66000,
    })
    plan.steps.forEach(step => {
      const amount = step.buildParams?.amount as string
      if (amount) expect(amount).toMatch(/^\d+$/) // integer string only
    })
  })
})
Acceptance criteria

 Test file created and all cases pass
 Tests cover: valid plan creation, HF guard rejection, scientific notation prevention


M9-01 — Fix useHarvest simulation soft-fail
File: frontend/hooks/useHarvest.ts line 86
Priority: 🔴 Critical — violates the mandatory simulation gate
ts// If simulate fails (network error), we continue to allow signing anyway
The review prompt is explicit: transactions must pass simulation before signing. A network error on the simulate call means simulation did not pass. The hook must treat this as a blocking error:
tsif (!simRes.ok) {
  throw new Error('Simulation request failed — please try again')
}
const simData = await simRes.json()
if (!simData.success) {
  throw new Error(`Simulation failed: ${simData.revertReason ?? 'unknown error'}`)
}
Remove the comment and the silent-continue behaviour entirely.
Acceptance criteria

 useHarvest throws (and sets error state) when /api/simulate returns a non-OK response
 useHarvest throws when simData.success === false
 Signing is never reached if simulation was not confirmed as passing


M9-02 — Add fetchWithTimeout to useHarvest and useRewards
Files: frontend/hooks/useHarvest.ts, frontend/hooks/useRewards.ts
Priority: 🟠 High
Both hooks call fetch() directly with no timeout. /api/rewards does per-plugin fan-out and could be slow. /api/simulate in the harvest loop is called once per claim tx.
Replace all fetch(...) calls in both hooks with fetchWithTimeout from @/lib/utils/fetch with a 12-second timeout. Note that fetchWithTimeout is a client-importable utility (no server-only) so this is safe in hooks.
Acceptance criteria

 fetchWithTimeout imported and used in useHarvest for both /api/rewards/claim and /api/simulate calls
 fetchWithTimeout imported and used in useRewards for the /api/rewards call
 Timeout set to 12000ms on all three calls