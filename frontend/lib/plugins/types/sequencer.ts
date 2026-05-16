import { ChainId, ProtocolId, BridgeId, UnsignedTx, TxBuildParams, BridgeQuoteParams } from './shared'

export type StepStatus = 'pending' | 'simulating' | 'ready' | 'signing' | 'confirmed' | 'failed'

export interface SimulationResult {
  success: boolean
  revertReason?: string
  revertData?: string
  gasEstimate?: bigint
  gasCostUsd?: number
  simulatedAt: Date
}

export interface SequenceStep {
  id: string
  label: string
  chain: ChainId
  unsignedTx?: UnsignedTx
  simulation?: SimulationResult
  status: StepStatus
  txHash?: string
  dependsOn: string[]
  pluginId: ProtocolId | BridgeId
  buildParams: TxBuildParams | BridgeQuoteParams
}

export interface SequencePlan {
  id: string
  walletAddress: string
  createdAt: Date
  steps: SequenceStep[]
  status: 'draft' | 'in-progress' | 'complete' | 'failed'
  totalCostUsd: number
  description: string
}

export interface BridgeAndDepositParams {
  asset: string;
  amount: string;
  amountUsd: number;
  fromChain: ChainId;
  toChain: ChainId;
  fromProtocol: ProtocolId | 'wallet';
  toProtocol: ProtocolId;
}

export interface RepayAndWithdrawParams {
  borrowAsset: string;
  borrowAmount: string;
  amountUsd: number;
  collateralAsset: string;
  collateralAmount: string;
  protocol: ProtocolId;
  chain: ChainId;
}

export interface CrossChainRebalanceParams {
  asset: string;
  amount: string;
  amountUsd: number;
  fromProtocol: ProtocolId;
  fromChain: ChainId;
  toProtocol: ProtocolId;
  toChain: ChainId;
}

export interface DeleverageAaveParams {
  borrowAsset: string;
  collateralAsset: string;
  totalDebt: string;
  totalCollateral: string;
  totalDebtUsd: number;
  totalCollateralUsd: number;
  initialHealthFactor: number;
  amountUsd: number;
  cycles: number;
  protocol: ProtocolId;
  chain: ChainId;
  walletAddress: string;
}

export interface ExitPendleParams {
  ptAsset: string;         // e.g. 'PT-eETH'
  ptAddress: string;
  amount: string;          // in atomic units
  amountUsd: number;
  underlyingAsset: string; // e.g. 'ETH'
  fromChain: ChainId;
  toChain: ChainId;
  toProtocol: ProtocolId;
  walletAddress: string;
  preferredBridgeId?: BridgeId;
}

export type TemplateParams = 
  | BridgeAndDepositParams 
  | RepayAndWithdrawParams 
  | CrossChainRebalanceParams 
  | DeleverageAaveParams 
  | ExitPendleParams
  | Record<string, unknown>;
