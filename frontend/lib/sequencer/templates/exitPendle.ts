import { SequencePlan, ExitPendleParams } from '@/types/sequencer';

export function buildExitPendlePlan(params: ExitPendleParams): SequencePlan {
  const isSameChain = params.fromChain === params.toChain;
  
  const plan: SequencePlan = {
    id: crypto.randomUUID(),
    walletAddress: params.walletAddress,
    createdAt: new Date(),
    status: 'draft',
    totalCostUsd: 0,
    description: `Exit ${params.ptAsset} Pendle position and move to ${params.toProtocol} on ${params.toChain}`,
    steps: []
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
        underlyingAsset: params.underlyingAsset
      }
    }
  });

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
        // TODO: amount might change slightly after redemption (e.g. discount/fees). 
        // A proper implementation should dynamically compute redemption output 
        // using Pendle SDK before creating the plan or between steps.
        amount: params.amount, 
        userAddress: params.walletAddress,
      }
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
        // TODO: amount might change slightly after redemption (e.g. discount/fees). 
        // A proper implementation should dynamically compute redemption output 
        // using Pendle SDK before creating the plan or between steps.
        amount: params.amount,
        recipientAddress: params.walletAddress,
      }
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
        // TODO: amount might change slightly after redemption (e.g. discount/fees). 
        // A proper implementation should dynamically compute redemption output 
        // using Pendle SDK before creating the plan or between steps.
        amount: params.amount,
        userAddress: params.walletAddress,
      }
    });
  }

  return plan;
}
