import { ChainId, TxBuildParams, BridgeQuoteParams } from '@/types/shared'
import { Position } from '@/types/position'
import { ActionType, BuilderStep, TokenState } from './types'
import { SequencePlan, SequenceStep } from '@/types/sequencer'

// Returns which actions are valid given the current token state
export function getEligibleActions(
  tokenState: TokenState,
  userPositions: Position[]
): ActionType[] {
  const actions: ActionType[] = []

  const isSupplyPosition = tokenState.positionType === 'supply'

  if (isSupplyPosition) {
    actions.push('withdraw')
    // No other actions — user must withdraw first
    return actions
  }

  // From wallet/transit token:
  actions.push('bridge')
  actions.push('swap')
  actions.push('deposit')
  actions.push('repay')
  actions.push('repayAndWithdraw')

  // Filter repay/repayAndWithdraw if no matching borrow positions
  const hasBorrowMatch = userPositions.some(
    p => p.positionType === 'borrow' &&
         p.chain === tokenState.chain &&
         p.asset === tokenState.token
  )
  if (!hasBorrowMatch) {
    return actions.filter(a => a !== 'repay' && a !== 'repayAndWithdraw')
  }

  return actions
}

// Returns true if the sequence can be submitted at this point
export function canSubmit(steps: BuilderStep[]): boolean {
  if (steps.length < 2) return false  // need at least source + one action
  const last = steps[steps.length - 1]
  return last.kind === 'deposit' || last.kind === 'repay'
}

// Returns true if the sequence is in a valid intermediate state
// where the user can optionally add more steps or submit
export function canAddMore(steps: BuilderStep[]): boolean {
  if (steps.length < 2) return false
  const last = steps[steps.length - 1]
  return (
    last.kind === 'withdraw' ||
    last.kind === 'repayAndWithdraw' ||
    last.kind === 'bridge' ||
    last.kind === 'swap'
  )
}

// Computes the net token delta for the summary bar
export function computeTokenDelta(steps: BuilderStep[]): {
  input: { token: string; amount: number; chain: ChainId } | null
  output: { token: string; amount: number; chain: ChainId; label: string } | null
  totalFeeUsd: number
  feeBreakdown: { label: string; feeUsd: number }[]
} {
  const source = steps[0]
  if (!source || source.kind !== 'source') return { input: null, output: null, totalFeeUsd: 0, feeBreakdown: [] }

  const input = {
    token: source.tokenOut.token,
    amount: source.tokenOut.amount,
    chain: source.tokenOut.chain,
  }

  let totalFeeUsd = 0
  const feeBreakdown: { label: string; feeUsd: number }[] = []

  let outputLabel = ''
  let outputToken = ''
  let outputAmount = source.tokenOut.amount
  let outputChain = source.tokenOut.chain

  for (const step of steps) {
    if (step.kind === 'bridge') {
      totalFeeUsd += step.feeUsd
      feeBreakdown.push({ label: 'Bridge fee', feeUsd: step.feeUsd })
      outputChain = step.toChain
      outputAmount = step.tokenOut.amount
    } else if (step.kind === 'swap') {
      totalFeeUsd += step.feeUsd
      feeBreakdown.push({ label: 'Swap fee', feeUsd: step.feeUsd })
      outputToken = step.tokenOut.token
      outputAmount = step.tokenOut.amount
    } else if (step.kind === 'deposit') {
      outputToken = step.destination.outputTokenSymbol
      outputLabel = step.destination.displayName
    } else if (step.kind === 'repay') {
      outputToken = 'debt repaid'
      outputLabel = 'Debt repaid'
    } else if (step.kind === 'repayAndWithdraw') {
      outputToken = step.tokenOut.token
      outputAmount = step.tokenOut.amount
      outputChain = step.tokenOut.chain
    } else if (step.kind === 'withdraw') {
      outputToken = step.tokenOut.token
      outputAmount = step.tokenOut.amount
    }
  }

  const output = outputToken ? {
    token: outputToken,
    amount: outputAmount,
    chain: outputChain,
    label: outputLabel,
  } : null

  return { input, output, totalFeeUsd, feeBreakdown }
}

export function builderStepsToSequencePlan(
  steps: BuilderStep[],
  walletAddress: string,
  positions: Position[]
): SequencePlan {
  const sequenceSteps: SequenceStep[] = []
  let previousStepId: string | null = null

  const source = steps[0]
  const positionSizeUsd = source && source.kind === 'source' ? source.tokenOut.amountUsd : 0

  steps.forEach((step, idx) => {
    if (step.kind === 'source' || step.kind === 'action-select') return

    const stepId = `${step.kind}-${idx}`
    const dependsOn = previousStepId ? [previousStepId] : []

    if (step.kind === 'repayAndWithdraw') {
      const borrowPos = positions.find(p => p.id === step.targetPositionId)
      const protocol = borrowPos?.protocol || 'aave'
      const potentialCollaterals = positions.filter(
        p => p.chain === step.tokenIn.chain &&
             p.protocol === protocol &&
             p.positionType === 'supply'
      )
      const collateralPos = potentialCollaterals.length > 0
        ? [...potentialCollaterals].sort((a, b) => b.amountUsd - a.amountUsd)[0]
        : undefined

      const repayStepId = `repay-${idx}`
      const withdrawStepId = `withdraw-${idx}`

      // Step 1: Repay
      sequenceSteps.push({
        id: repayStepId,
        label: `Repay ${step.tokenIn.token} debt on ${step.tokenIn.chain}`,
        chain: step.tokenIn.chain,
        pluginId: protocol,
        dependsOn,
        status: 'pending',
        buildParams: {
          action: 'repay',
          protocol,
          chain: step.tokenIn.chain,
          asset: step.tokenIn.token,
          amount: step.tokenIn.amount.toString(),
          userAddress: walletAddress,
        } as unknown as TxBuildParams | BridgeQuoteParams
      })

      // Step 2: Withdraw collateral (depends on repay)
      sequenceSteps.push({
        id: withdrawStepId,
        label: `Withdraw ${collateralPos?.asset || 'collateral'} from ${protocol} on ${step.tokenIn.chain}`,
        chain: step.tokenIn.chain,
        pluginId: protocol,
        dependsOn: [repayStepId],
        status: 'pending',
        buildParams: {
          action: 'withdraw',
          protocol,
          chain: step.tokenIn.chain,
          asset: collateralPos?.asset || 'WETH',
          amount: collateralPos?.amount.toString() || 'max',
          userAddress: walletAddress,
        } as unknown as TxBuildParams | BridgeQuoteParams
      })

      previousStepId = withdrawStepId
      return
    }

    let label = ''
    let pluginId: string = ''
    let buildParams: Record<string, unknown> = {}

    switch (step.kind) {
      case 'withdraw': {
        const pos = positions.find(p => p.id === step.sourcePositionId)
        const protocol = pos?.protocol || 'aave'
        label = `Withdraw ${step.tokenIn.token} from ${protocol === 'aave' ? 'Aave V3' : protocol === 'morpho' ? 'Morpho' : protocol} on ${step.tokenIn.chain}`
        pluginId = protocol
        buildParams = {
          action: 'withdraw',
          protocol,
          chain: step.tokenIn.chain,
          asset: step.tokenIn.token,
          amount: step.tokenIn.amount.toString(),
          userAddress: walletAddress
        }
        break
      }
      case 'bridge': {
        label = `Bridge ${step.tokenIn.token} from ${step.tokenIn.chain} to ${step.toChain} via ${step.bridgeId}`
        pluginId = step.bridgeId
        buildParams = {
          fromChain: step.tokenIn.chain,
          toChain: step.toChain,
          token: step.tokenIn.token,
          amount: step.tokenIn.amount.toString(),
          recipientAddress: walletAddress,
          slippagePercent: 0.5
        }
        break
      }
      case 'swap': {
        label = `Swap ${step.tokenIn.token} for ${step.toToken} on ${step.tokenIn.chain} via 1inch`
        pluginId = '1inch'
        buildParams = {
          action: 'swap',
          protocol: '1inch',
          chain: step.tokenIn.chain,
          asset: step.tokenIn.token,
          amount: step.tokenIn.amount.toString(),
          userAddress: walletAddress,
          extraParams: {
            toToken: step.toToken,
            feeUsd: step.feeUsd
          }
        }
        break
      }
      case 'deposit': {
        label = `Deposit ${step.tokenIn.token} into ${step.destination.displayName}`
        pluginId = step.destination.protocol
        buildParams = {
          action: 'supply',
          protocol: step.destination.protocol,
          chain: step.tokenIn.chain,
          asset: step.tokenIn.token,
          amount: step.tokenIn.amount.toString(),
          userAddress: walletAddress
        }
        break
      }
      case 'repay': {
        const borrowPos = positions.find(p => p.id === step.targetPositionId)
        const protocol = borrowPos?.protocol || 'aave'
        label = `Repay ${step.tokenIn.token} debt on ${step.tokenIn.chain}`
        pluginId = protocol
        buildParams = {
          action: 'repay',
          protocol,
          chain: step.tokenIn.chain,
          asset: step.tokenIn.token,
          amount: step.tokenIn.amount.toString(),
          userAddress: walletAddress
        }
        break
      }
    }

    sequenceSteps.push({
      id: stepId,
      label,
      chain: step.tokenIn.chain,
      pluginId,
      dependsOn,
      status: 'pending',
      buildParams: buildParams as unknown as TxBuildParams | BridgeQuoteParams
    })

    previousStepId = stepId
  })

  const activeStepKinds = steps
    .filter(s => s.kind !== 'source' && s.kind !== 'action-select')
    .map(s => s.kind)
  
  const desc = `Custom sequence: ${activeStepKinds.join(' → ')}`

  return {
    id: crypto.randomUUID(),
    walletAddress,
    createdAt: new Date(),
    status: 'draft',
    totalCostUsd: 0,
    positionSizeUsd,
    description: desc,
    steps: sequenceSteps,
    templateId: 'custom'
  }
}
