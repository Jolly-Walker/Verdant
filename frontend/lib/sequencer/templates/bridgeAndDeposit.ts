import { SequencePlan } from '@/types/sequencer';
import { ChainId, ProtocolId, BridgeId } from '@/types/shared';

export interface BridgeAndDepositParams {
  asset: string;          // e.g. 'USDC'
  amount: string;         // token units as string
  amountUsd: number;
  fromChain: ChainId;
  toChain: ChainId;
  fromProtocol: ProtocolId;  // where funds are currently (used for display)
  toProtocol: ProtocolId;    // where to deposit
  walletAddress: string;
  preferredBridgeId?: BridgeId;
}

export function buildBridgeAndDepositPlan(params: BridgeAndDepositParams): SequencePlan {
  const isSameChain = params.fromChain === params.toChain;
  
  const plan: SequencePlan = {
    id: crypto.randomUUID(),
    walletAddress: params.walletAddress,
    createdAt: new Date(),
    status: 'draft',
    totalCostUsd: 0,
    description: isSameChain 
      ? `Deposit ${params.asset} into ${params.toProtocol} on ${params.toChain}`
      : `Bridge and deposit ${params.asset} from ${params.fromChain} to ${params.toChain}`,
    steps: []
  };

  if (isSameChain) {
    plan.steps.push({
      id: 'deposit',
      label: `Deposit ${params.asset} into ${params.toProtocol} on ${params.toChain}`,
      chain: params.toChain,
      pluginId: params.toProtocol,
      dependsOn: [],
      status: 'pending',
      buildParams: {
        action: 'supply',
        protocol: params.toProtocol,
        chain: params.toChain,
        asset: params.asset,
        amount: params.amount,
        userAddress: params.walletAddress,
      }
    });
  } else {
    plan.steps.push({
      id: 'bridge',
      label: `Bridge ${params.asset} from ${params.fromChain} to ${params.toChain}`,
      chain: params.fromChain,
      pluginId: params.preferredBridgeId || 'across',
      dependsOn: [],
      status: 'pending',
      buildParams: {
        fromChain: params.fromChain,
        toChain: params.toChain,
        token: params.asset,
        amount: params.amount,
        recipientAddress: params.walletAddress,
      }
    });
    
    plan.steps.push({
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
    });
  }

  return plan;
}
