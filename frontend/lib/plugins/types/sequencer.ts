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
