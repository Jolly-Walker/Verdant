import { SequencePlan } from '@/types/sequencer';
import { ChainId, ProtocolId, BridgeId } from '@/types/shared';

export interface CrossChainRebalanceParams {
  asset: string;
  amount: string;
  amountUsd: number;
  fromProtocol: ProtocolId;
  fromChain: ChainId;
  toProtocol: ProtocolId;
  toChain: ChainId;
  walletAddress: string;
  preferredBridgeId?: BridgeId;
}

export function buildCrossChainRebalancePlan(params: CrossChainRebalanceParams): SequencePlan {
  return {
    id: crypto.randomUUID(),
    walletAddress: params.walletAddress,
    createdAt: new Date(),
    status: 'draft',
    totalCostUsd: 0,
    description: `Rebalance ${params.asset} from ${params.fromProtocol} on ${params.fromChain} to ${params.toProtocol} on ${params.toChain}`,
    steps: [
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
        }
      },
      {
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
        }
      },
      {
        id: 'deposit',
        label: `Deposit ${params.asset} into ${params.toProtocol} on ${params.toChain}`,
        chain: params.toChain,
        pluginId: params.toProtocol,
        dependsOn: ['bridge'],
        status: 'pending',
        buildParams: {
          action: 'supply',
          protocol: params.toProtocol,
          chain: params.toChain,
          asset: params.asset,
          amount: params.amount,
          userAddress: params.walletAddress,
        }
      }
    ]
  };
}
