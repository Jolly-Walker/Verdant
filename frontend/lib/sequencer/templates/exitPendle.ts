import type { ExitPendleParams, SequencePlan } from '@/types/sequencer';

/**
 * Builds the "exit Pendle" plan: redeem PT for the underlying asset, then move
 * the proceeds to the destination protocol (optionally bridging to another chain).
 *
 * The amount of UNDERLYING produced by the redemption is NOT the PT amount — PT
 * trades at a discount/premium to underlying near maturity and decimals/fees can
 * differ. The caller previews the real redemption output via Pendle's Convert API
 * (a server-only network call — see `previewPendleRedemption`) and passes the raw
 * underlying output (atomic units) in as `redemptionOutput`; this builder applies a
 * slippage-buffered floor for the downstream deposit/bridge steps. When the preview
 * is unavailable (`null` — unsupported token, API failure), we fall back to the PT
 * amount and rely on the mandatory simulation gate to catch drift.
 *
 * This builder is intentionally pure (no server-only imports): it is re-exported
 * through the template registry barrel, which the client hook `useSequencer`
 * imports — pulling a `'server-only'` module in here would poison the client bundle.
 */
export function buildExitPendlePlan(
  params: ExitPendleParams,
  redemptionOutput: string | null = null,
): SequencePlan {
  const isSameChain = params.fromChain === params.toChain;

  const plan: SequencePlan = {
    id: crypto.randomUUID(),
    walletAddress: params.walletAddress,
    createdAt: new Date(),
    status: 'draft',
    totalCostUsd: 0,
    positionSizeUsd: params.amountUsd,
    description: `Exit ${params.ptAsset} Pendle position and move to ${params.toProtocol} on ${params.toChain}`,
    steps: [],
  };

  // Step 1: Redeem PT for Underlying
  plan.steps.push({
    id: 'redeem',
    label: `Redeem ${params.ptAsset} for ${params.underlyingAsset} on ${params.fromChain}`,
    chain: params.fromChain,
    pluginId: 'pendle',
    dependsOn: [],
    status: 'pending',
    buildParams: {
      action: 'withdraw',
      protocol: 'pendle',
      chain: params.fromChain,
      asset: params.ptAsset,
      amount: params.amount,
      userAddress: params.walletAddress,
      extraParams: {
        ptAddress: params.ptAddress,
        underlyingAsset: params.underlyingAsset,
        slippagePercent: params.slippagePercent,
        isWei: true,
      },
    },
  });

  // Apply the slippage buffer as a conservative floor on the previewed expected
  // redemption output (BigInt math, atomic units) so the downstream deposit/bridge
  // use the right amount instead of the stale PT amount. Fall back to the PT amount
  // when no preview is available.
  let downstreamAmount = params.amount;
  if (redemptionOutput !== null) {
    // slippagePercent is a percentage (e.g. 0.5 = 0.5%); scale by basis points to
    // keep integer math: floor = out * (10000 - bps) / 10000.
    const bps = BigInt(Math.round(params.slippagePercent * 100));
    const buffered = (BigInt(redemptionOutput) * (10000n - bps)) / 10000n;
    downstreamAmount = buffered.toString();
  }

  if (isSameChain) {
    // Step 2: Deposit Underlying on same chain
    plan.steps.push({
      id: 'deposit',
      label: `Deposit ${params.underlyingAsset} into ${params.toProtocol} on ${params.toChain}`,
      chain: params.toChain,
      pluginId: params.toProtocol,
      dependsOn: ['redeem'],
      status: 'pending',
      buildParams: {
        action: 'supply',
        protocol: params.toProtocol,
        chain: params.toChain,
        asset: params.underlyingAsset,
        amount: downstreamAmount,
        userAddress: params.walletAddress,
      },
    });
  } else {
    // Step 2: Bridge Underlying
    plan.steps.push({
      id: 'bridge',
      label: `Bridge ${params.underlyingAsset} from ${params.fromChain} to ${params.toChain}`,
      chain: params.fromChain,
      pluginId: params.preferredBridgeId || 'across',
      dependsOn: ['redeem'],
      status: 'pending',
      buildParams: {
        fromChain: params.fromChain,
        toChain: params.toChain,
        token: params.underlyingAsset,
        amount: downstreamAmount,
        recipientAddress: params.walletAddress,
        slippagePercent: params.slippagePercent,
      },
    });

    // Step 3: Deposit Underlying on destination chain
    plan.steps.push({
      id: 'deposit',
      label: `Deposit ${params.underlyingAsset} into ${params.toProtocol} on ${params.toChain}`,
      chain: params.toChain,
      pluginId: params.toProtocol,
      dependsOn: ['bridge'],
      status: 'pending',
      buildParams: {
        action: 'supply',
        protocol: params.toProtocol,
        chain: params.toChain,
        asset: params.underlyingAsset,
        amount: downstreamAmount,
        userAddress: params.walletAddress,
      },
    });
  }

  return plan;
}
