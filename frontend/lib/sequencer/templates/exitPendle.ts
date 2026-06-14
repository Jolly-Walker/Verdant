import { applySlippageFloor } from '@/lib/utils/slippage';
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
 * is unavailable (`null` — unsupported token, API failure) we REFUSE to build:
 * sizing the downstream steps off the PT amount would deposit/bridge more than was
 * actually received, so the caller must surface the failure instead.
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

  // Size the downstream deposit/bridge off the PREVIEWED underlying output, never
  // the PT amount. Without a preview we cannot size safely — refuse rather than
  // move more underlying than the redemption actually yields.
  if (redemptionOutput === null) {
    throw new Error(
      `Cannot size the Pendle exit for ${params.ptAsset}: redemption preview unavailable. ` +
        `Retry once Pendle's Convert API can quote ${params.underlyingAsset} on ${params.fromChain}.`,
    );
  }
  const downstreamAmount = applySlippageFloor(
    BigInt(redemptionOutput),
    params.slippagePercent,
  ).toString();

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
