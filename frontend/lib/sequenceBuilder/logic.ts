import { ChainId } from '@/types/shared'
import { Position } from '@/types/position'
import { ActionType, BuilderStep, TokenState } from './types'

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
