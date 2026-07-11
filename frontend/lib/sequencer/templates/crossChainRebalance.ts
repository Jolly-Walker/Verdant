import type { CrossChainRebalanceParams, SequencePlan, SequenceStep } from '@/types/sequencer';

export function buildCrossChainRebalancePlan(params: CrossChainRebalanceParams): SequencePlan {
  const isSameChain = params.fromChain === params.toChain;

  const steps: SequenceStep[] = [
    {
      id: 'withdraw',
      label: `Withdraw ${params.asset} from ${params.fromProtocol} on ${params.fromChain}`,
      chain: params.fromChain,
      pluginId: params.fromProtocol,
      dependsOn: [],
      status: 'pending',
      buildParams: {
        action: 'withdraw',
        protocol: params.fromProtocol,
        chain: params.fromChain,
        asset: params.asset,
        amount: params.amount,
        userAddress: params.walletAddress,
      },
    },
  ];

  if (!isSameChain) {
    steps.push({
      id: 'bridge',
      label: `Bridge ${params.asset} from ${params.fromChain} to ${params.toChain}`,
      chain: params.fromChain,
      pluginId: params.preferredBridgeId || 'across',
      dependsOn: ['withdraw'],
      status: 'pending',
      buildParams: {
        fromChain: params.fromChain,
        toChain: params.toChain,
        token: params.asset,
        amount: params.amount,
        recipientAddress: params.walletAddress,
        slippagePercent: params.slippagePercent,
      },
    });
  }

  steps.push({
    id: 'deposit',
    label: `Deposit ${params.asset} into ${params.toProtocol} on ${params.toChain}`,
    chain: params.toChain,
    pluginId: params.toProtocol,
    dependsOn: [isSameChain ? 'withdraw' : 'bridge'],
    status: 'pending',
    buildParams: {
      action: 'supply',
      protocol: params.toProtocol,
      chain: params.toChain,
      asset: params.asset,
      amount: params.amount,
      userAddress: params.walletAddress,
    },
  });

  return {
    id: crypto.randomUUID(),
    walletAddress: params.walletAddress,
    createdAt: new Date(),
    status: 'draft',
    totalCostUsd: 0,
    positionSizeUsd: params.amountUsd,
    description: isSameChain
      ? `Rebalance ${params.asset} from ${params.fromProtocol} to ${params.toProtocol} on ${params.toChain}`
      : `Rebalance ${params.asset} from ${params.fromProtocol} on ${params.fromChain} to ${params.toProtocol} on ${params.toChain}`,
    steps,
  };
}
