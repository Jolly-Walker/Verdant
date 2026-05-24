import { describe, it, expect } from 'vitest'
import { getEligibleActions, canSubmit, canAddMore, computeTokenDelta, builderStepsToSequencePlan } from '../logic'
import { TokenState, BuilderStep } from '../types'
import { Position } from '@/types/position'

describe('Sequence Builder Logic', () => {
  const mockPositions: Position[] = [
    {
      id: 'aave-supply-usdc-arb',
      protocol: 'aave',
      chain: 'arbitrum',
      asset: 'USDC',
      assetAddress: '0x123',
      amount: 1000,
      amountUsd: 1000,
      currentApy: 0.04,
      positionType: 'supply',
      claimableRewards: [],
      priceUsd: 1,
      metadata: {}
    },
    {
      id: 'aave-borrow-usdc-arb',
      protocol: 'aave',
      chain: 'arbitrum',
      asset: 'USDC',
      assetAddress: '0x123',
      amount: 500,
      amountUsd: 500,
      currentApy: 0.05,
      positionType: 'borrow',
      claimableRewards: [],
      priceUsd: 1,
      healthFactor: 2.0,
      metadata: {}
    }
  ]

  describe('getEligibleActions', () => {
    it('should return only withdraw for supply positions', () => {
      const state: TokenState = {
        token: 'USDC',
        chain: 'arbitrum',
        amount: 1000,
        amountUsd: 1000,
        sourcePositionId: 'aave-supply-usdc-arb',
        positionType: 'supply'
      }
      const actions = getEligibleActions(state, mockPositions)
      expect(actions).toEqual(['withdraw'])
    })

    it('should exclude repay/repayAndWithdraw when no matching borrow exists', () => {
      // WETH on Arbitrum has no borrow position in mockPositions
      const state: TokenState = {
        token: 'WETH',
        chain: 'arbitrum',
        amount: 1,
        amountUsd: 2500,
        positionType: 'wallet'
      }
      const actions = getEligibleActions(state, mockPositions)
      expect(actions).not.toContain('repay')
      expect(actions).not.toContain('repayAndWithdraw')
      expect(actions).toContain('bridge')
      expect(actions).toContain('swap')
      expect(actions).toContain('deposit')
    })

    it('should include repay/repayAndWithdraw when matching borrow exists', () => {
      const state: TokenState = {
        token: 'USDC',
        chain: 'arbitrum',
        amount: 500,
        amountUsd: 500,
        positionType: 'wallet'
      }
      const actions = getEligibleActions(state, mockPositions)
      expect(actions).toContain('repay')
      expect(actions).toContain('repayAndWithdraw')
      expect(actions).toContain('bridge')
      expect(actions).toContain('swap')
      expect(actions).toContain('deposit')
    })
  })

  describe('canSubmit', () => {
    it('should return false if length is less than 2', () => {
      const steps: BuilderStep[] = [
        {
          kind: 'source',
          tokenOut: { token: 'USDC', chain: 'arbitrum', amount: 100, amountUsd: 100 }
        }
      ]
      expect(canSubmit(steps)).toBe(false)
    })

    it('should return false for transit steps', () => {
      const steps: BuilderStep[] = [
        {
          kind: 'source',
          tokenOut: { token: 'USDC', chain: 'arbitrum', amount: 100, amountUsd: 100 }
        },
        {
          kind: 'bridge',
          tokenIn: { token: 'USDC', chain: 'arbitrum', amount: 100, amountUsd: 100 },
          toChain: 'base',
          bridgeId: 'across',
          feeUsd: 1.5,
          tokenOut: { token: 'USDC', chain: 'base', amount: 98.5, amountUsd: 98.5 }
        }
      ]
      expect(canSubmit(steps)).toBe(false)
    })

    it('should return true for terminal steps', () => {
      const steps: BuilderStep[] = [
        {
          kind: 'source',
          tokenOut: { token: 'USDC', chain: 'arbitrum', amount: 100, amountUsd: 100 }
        },
        {
          kind: 'deposit',
          tokenIn: { token: 'USDC', chain: 'arbitrum', amount: 100, amountUsd: 100 },
          destination: {
            id: 'aave-usdc-arb',
            protocol: 'aave',
            chain: 'arbitrum',
            token: 'USDC',
            apy: 0.044,
            displayName: 'Aave V3 — USDC',
            outputTokenSymbol: 'aUSDC',
            apyType: 'variable'
          }
        }
      ]
      expect(canSubmit(steps)).toBe(true)
    })
  })

  describe('canAddMore', () => {
    it('should return false for terminal steps', () => {
      const steps: BuilderStep[] = [
        {
          kind: 'source',
          tokenOut: { token: 'USDC', chain: 'arbitrum', amount: 100, amountUsd: 100 }
        },
        {
          kind: 'deposit',
          tokenIn: { token: 'USDC', chain: 'arbitrum', amount: 100, amountUsd: 100 },
          destination: {
            id: 'aave-usdc-arb',
            protocol: 'aave',
            chain: 'arbitrum',
            token: 'USDC',
            apy: 0.044,
            displayName: 'Aave V3 — USDC',
            outputTokenSymbol: 'aUSDC',
            apyType: 'variable'
          }
        }
      ]
      expect(canAddMore(steps)).toBe(false)
    })

    it('should return true for transit steps', () => {
      const steps: BuilderStep[] = [
        {
          kind: 'source',
          tokenOut: { token: 'USDC', chain: 'arbitrum', amount: 100, amountUsd: 100 }
        },
        {
          kind: 'bridge',
          tokenIn: { token: 'USDC', chain: 'arbitrum', amount: 100, amountUsd: 100 },
          toChain: 'base',
          bridgeId: 'across',
          feeUsd: 1.5,
          tokenOut: { token: 'USDC', chain: 'base', amount: 98.5, amountUsd: 98.5 }
        }
      ]
      expect(canAddMore(steps)).toBe(true)
    })
  })

  describe('computeTokenDelta', () => {
    it('should compute inputs, outputs and fees correctly', () => {
      const steps: BuilderStep[] = [
        {
          kind: 'source',
          tokenOut: { token: 'USDC', chain: 'arbitrum', amount: 1000, amountUsd: 1000 }
        },
        {
          kind: 'bridge',
          tokenIn: { token: 'USDC', chain: 'arbitrum', amount: 1000, amountUsd: 1000 },
          toChain: 'base',
          bridgeId: 'across',
          feeUsd: 1.20,
          tokenOut: { token: 'USDC', chain: 'base', amount: 998.8, amountUsd: 998.8 }
        },
        {
          kind: 'swap',
          tokenIn: { token: 'USDC', chain: 'base', amount: 998.8, amountUsd: 998.8 },
          toToken: 'WETH',
          feeUsd: 0.40,
          tokenOut: { token: 'WETH', chain: 'base', amount: 0.4, amountUsd: 998.4 }
        },
        {
          kind: 'deposit',
          tokenIn: { token: 'WETH', chain: 'base', amount: 0.4, amountUsd: 998.4 },
          destination: {
            id: 'euler-weth-base',
            protocol: 'euler',
            chain: 'base',
            token: 'WETH',
            apy: 0.024,
            displayName: 'Euler V2 — WETH',
            outputTokenSymbol: 'eWETH',
            apyType: 'variable'
          }
        }
      ]

      const delta = computeTokenDelta(steps)
      expect(delta.input).toEqual({ token: 'USDC', amount: 1000, chain: 'arbitrum' })
      expect(delta.output).toEqual({
        token: 'eWETH',
        amount: 0.4,
        chain: 'base',
        label: 'Euler V2 — WETH'
      })
      expect(delta.totalFeeUsd).toBe(1.60)
      expect(delta.feeBreakdown).toEqual([
        { label: 'Bridge fee', feeUsd: 1.20 },
        { label: 'Swap fee', feeUsd: 0.40 }
      ])
    })
  })

  describe('builderStepsToSequencePlan', () => {
    it('should map builder steps to a full sequence plan with dependencies', () => {
      const steps: BuilderStep[] = [
        {
          kind: 'source',
          tokenOut: { token: 'USDC', chain: 'arbitrum', amount: 1000, amountUsd: 1000 }
        },
        {
          kind: 'bridge',
          tokenIn: { token: 'USDC', chain: 'arbitrum', amount: 1000, amountUsd: 1000 },
          toChain: 'base',
          bridgeId: 'across',
          feeUsd: 1.20,
          tokenOut: { token: 'USDC', chain: 'base', amount: 998.8, amountUsd: 998.8 }
        },
        {
          kind: 'swap',
          tokenIn: { token: 'USDC', chain: 'base', amount: 998.8, amountUsd: 998.8 },
          toToken: 'WETH',
          feeUsd: 0.40,
          tokenOut: { token: 'WETH', chain: 'base', amount: 0.4, amountUsd: 998.4 }
        },
        {
          kind: 'deposit',
          tokenIn: { token: 'WETH', chain: 'base', amount: 0.4, amountUsd: 998.4 },
          destination: {
            id: 'euler-weth-base',
            protocol: 'euler',
            chain: 'base',
            token: 'WETH',
            apy: 0.024,
            displayName: 'Euler V2 — WETH',
            outputTokenSymbol: 'eWETH',
            apyType: 'variable'
          }
        }
      ]

      const plan = builderStepsToSequencePlan(steps, '0xwallet', mockPositions)
      expect(plan.walletAddress).toBe('0xwallet')
      expect(plan.templateId).toBe('custom')
      expect(plan.positionSizeUsd).toBe(1000)
      expect(plan.description).toBe('Custom sequence: bridge → swap → deposit')
      expect(plan.steps).toHaveLength(3)

      expect(plan.steps[0]).toEqual({
        id: 'bridge-1',
        label: 'Bridge USDC from arbitrum to base via across',
        chain: 'arbitrum',
        pluginId: 'across',
        dependsOn: [],
        status: 'pending',
        buildParams: {
          fromChain: 'arbitrum',
          toChain: 'base',
          token: 'USDC',
          amount: '1000',
          recipientAddress: '0xwallet',
          slippagePercent: 0.5
        }
      })

      expect(plan.steps[1]).toEqual({
        id: 'swap-2',
        label: 'Swap USDC for WETH on base via 1inch',
        chain: 'base',
        pluginId: '1inch',
        dependsOn: ['bridge-1'],
        status: 'pending',
        buildParams: {
          action: 'swap',
          protocol: '1inch',
          chain: 'base',
          asset: 'USDC',
          amount: '998.8',
          userAddress: '0xwallet',
          extraParams: {
            toToken: 'WETH',
            feeUsd: 0.40
          }
        }
      })

      expect(plan.steps[2]).toEqual({
        id: 'deposit-3',
        label: 'Deposit WETH into Euler V2 — WETH',
        chain: 'base',
        pluginId: 'euler',
        dependsOn: ['swap-2'],
        status: 'pending',
        buildParams: {
          action: 'supply',
          protocol: 'euler',
          chain: 'base',
          asset: 'WETH',
          amount: '0.4',
          userAddress: '0xwallet'
        }
      })
    })

    it('should map repayAndWithdraw step to repay followed by withdraw steps with correct dependencies', () => {
      const steps: BuilderStep[] = [
        {
          kind: 'source',
          tokenOut: { token: 'USDC', chain: 'arbitrum', amount: 500, amountUsd: 500 }
        },
        {
          kind: 'repayAndWithdraw',
          tokenIn: { token: 'USDC', chain: 'arbitrum', amount: 500, amountUsd: 500 },
          targetPositionId: 'aave-borrow-usdc-arb',
          tokenOut: { token: 'USDC', chain: 'arbitrum', amount: 500, amountUsd: 500 }
        },
        {
          kind: 'deposit',
          tokenIn: { token: 'USDC', chain: 'arbitrum', amount: 500, amountUsd: 500 },
          destination: {
            id: 'aave-usdc-arb',
            protocol: 'aave',
            chain: 'arbitrum',
            token: 'USDC',
            apy: 0.044,
            displayName: 'Aave V3 — USDC',
            outputTokenSymbol: 'aUSDC',
            apyType: 'variable'
          }
        }
      ]

      const plan = builderStepsToSequencePlan(steps, '0xwallet', mockPositions)
      expect(plan.steps).toHaveLength(3)

      expect(plan.steps[0]).toEqual({
        id: 'repay-1',
        label: 'Repay USDC debt on arbitrum',
        chain: 'arbitrum',
        pluginId: 'aave',
        dependsOn: [],
        status: 'pending',
        buildParams: {
          action: 'repay',
          protocol: 'aave',
          chain: 'arbitrum',
          asset: 'USDC',
          amount: '500',
          userAddress: '0xwallet'
        }
      })

      expect(plan.steps[1]).toEqual({
        id: 'withdraw-1',
        label: 'Withdraw USDC from aave on arbitrum',
        chain: 'arbitrum',
        pluginId: 'aave',
        dependsOn: ['repay-1'],
        status: 'pending',
        buildParams: {
          action: 'withdraw',
          protocol: 'aave',
          chain: 'arbitrum',
          asset: 'USDC',
          amount: '1000',
          userAddress: '0xwallet'
        }
      })

      expect(plan.steps[2]).toEqual({
        id: 'deposit-2',
        label: 'Deposit USDC into Aave V3 — USDC',
        chain: 'arbitrum',
        pluginId: 'aave',
        dependsOn: ['withdraw-1'],
        status: 'pending',
        buildParams: {
          action: 'supply',
          protocol: 'aave',
          chain: 'arbitrum',
          asset: 'USDC',
          amount: '500',
          userAddress: '0xwallet'
        }
      })
    })
  })
})
