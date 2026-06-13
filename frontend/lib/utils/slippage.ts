/**
 * Applies a slippage tolerance as a conservative floor on an atomic-unit amount:
 *
 *   floor = amount * (10000 - bps) / 10000,  where bps = round(slippagePercent * 100)
 *
 * `slippagePercent` is a percentage (e.g. `0.5` = 0.5%); it is scaled to basis
 * points so the whole computation stays in BigInt integer math (no float drift).
 * Used to size amounts a counterparty must deliver EXACTLY — the Across
 * `depositV3` `outputAmount` and the downstream amount of a Pendle exit — so that
 * fee/quote drift between quote and execution leaves headroom and the action
 * still fills.
 *
 * Pure and client-safe (no `server-only`): callers include client-bundled
 * template builders.
 */
export function applySlippageFloor(amount: bigint, slippagePercent: number): bigint {
  // Clamp before converting to basis points. A NaN/negative tolerance would
  // inflate the floor ABOVE `amount` (bps < 0 → an unfillable depositV3), and a
  // value > 100 would push it NEGATIVE (bps > 10000 → an un-encodable uint256).
  // Route schemas (`slippagePercentSchema`) reject these upstream; this is
  // defense-in-depth so the helper can never emit a value outside [0, amount].
  const safePercent = Number.isFinite(slippagePercent)
    ? Math.min(Math.max(slippagePercent, 0), 100)
    : 0;
  const bps = BigInt(Math.round(safePercent * 100));
  return (amount * (10000n - bps)) / 10000n;
}
