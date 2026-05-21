import { ChainId, ProtocolId, BridgeId, UnsignedTx, TxBuildParams, BridgeQuoteParams } from './shared'
import { Warning } from './quote'

export type TemplateId = 'bridgeAndDeposit' | 'repayAndWithdraw' | 'crossChainRebalance' | 'deleverageAave' | 'exitPendle';

export type StepStatus = 'pending' | 'simulating' | 'ready' | 'signing' | 'confirmed' | 'failed'

export interface StateChange {
  asset: string
  assetAddress: string
  change: string
  type: 'balance' | 'allowance' | 'position'
  decimals: number
  chainId: string
}

export interface SimulationResult {
  success: boolean
  revertReason?: string
  revertData?: string
  gasEstimate?: bigint
  gasCostUsd?: number
  simulatedAt: Date
  stateChanges?: StateChange[]
  warnings?: Warning[]
}

export interface SerializedSimulationResult extends Omit<SimulationResult, 'gasEstimate' | 'simulatedAt'> {
  gasEstimate?: string
  simulatedAt: string
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
  projectedHealthFactor?: number
}

export interface SerializedUnsignedTx extends Omit<UnsignedTx, 'value' | 'gasLimit'> {
  value: string
  gasLimit?: string
}

export interface SerializedSequenceStep extends Omit<SequenceStep, 'unsignedTx' | 'simulation'> {
  unsignedTx?: SerializedUnsignedTx
  simulation?: SerializedSimulationResult
  projectedHealthFactor?: number
}

export interface SequencePlan {
  id: string
  walletAddress: string
  createdAt: Date
  steps: SequenceStep[]
  status: 'draft' | 'in-progress' | 'complete' | 'failed'
  totalCostUsd: number
  description: string
  templateId?: TemplateId
}

export interface SerializedSequencePlan extends Omit<SequencePlan, "steps" | "createdAt" | "templateId"> {
  createdAt: string
  steps: SerializedSequenceStep[]
  templateId?: TemplateId
}

export interface BridgeAndDepositParams {
  asset: string;
  amount: string;
  amountUsd: number;
  fromChain: ChainId;
  toChain: ChainId;
  fromProtocol: ProtocolId | 'wallet';
  toProtocol: ProtocolId;
  walletAddress: string;
  preferredBridgeId?: BridgeId;
  slippagePercent: number;
}

export interface RepayAndWithdrawParams {
  borrowAsset: string;
  borrowAmount: string;
  amountUsd: number;
  collateralAsset: string;
  collateralAmount: string;
  protocol: ProtocolId;
  chain: ChainId;
  walletAddress: string;
}

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
  slippagePercent: number;
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
  cycles?: number;
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
  slippagePercent: number;
}

export type TemplateParams = 
  | BridgeAndDepositParams 
  | RepayAndWithdrawParams 
  | CrossChainRebalanceParams 
  | DeleverageAaveParams 
  | ExitPendleParams
  | Record<string, unknown>;
