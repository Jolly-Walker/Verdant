import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

import { aavePlugin } from '../aave'
import { eulerPlugin, EULER_CURATED_VAULTS } from '../euler'
import { getPublicClient } from '@/lib/server/rpc'
import { fetchTokenPrices } from '@/lib/data/prices'

vi.mock('@/lib/server/rpc', () => ({
  getPublicClient: vi.fn(),
}))

vi.mock('@/lib/data/prices', () => ({
  fetchTokenPrices: vi.fn().mockResolvedValue({
    'coingecko:usd-coin': 1.0,
    'coingecko:ethereum': 3000.0,
  }),
}))

describe('Aave V3 Protocol Plugin', () => {
  const mockPublicClient = {
    readContract: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getPublicClient).mockReturnValue(mockPublicClient as any)
  })

  describe('fetchPositions', () => {
    it('should return empty if user has no positions (getUserAccountData returns zeros)', async () => {
      mockPublicClient.readContract.mockResolvedValueOnce([0n, 0n, 0n, 0n, 0n, 0n]) // getUserAccountData

      const positions = await aavePlugin.fetcher.fetchPositions('0x1234567890123456789012345678901234567890', 'ethereum')
      expect(positions).toEqual([])
    })

    it('should return positions when balances exist', async () => {
      // 1. getUserAccountData returns collateral/debt
      mockPublicClient.readContract.mockResolvedValueOnce([1000000n, 500000n, 0n, 0n, 0n, 0n])

      // 2. getReserveData and balanceOf mock implementations
      mockPublicClient.readContract.mockImplementation(async ({ functionName, args, address }: any) => {
        if (functionName === 'getReserveData') {
          // returns tuple where index 9 is aTokenAddress, index 11 is variableDebtTokenAddress,
          // index 4 is currentLiquidityRate, index 5 is currentVariableBorrowRate
          return [
            0n, // configuration
            0n, // liquidityIndex
            0n, // currentLiquidationThreshold
            0n, // variableBorrowIndex
            50000000000000000000000000n, // 5% supply APY in ray
            60000000000000000000000000n, // 6% borrow APY in ray
            0n,
            0n,
            0n,
            '0xATokenAddress', // index 9
            '0xStableDebtTokenAddress',
            '0xVariableDebtTokenAddress', // index 11
            '0xStrategyAddress'
          ]
        }

        if (functionName === 'balanceOf') {
          if (address === '0xATokenAddress') {
            return 1000000000n // 1000 USDC (6 decimals)
          }
          if (address === '0xVariableDebtTokenAddress') {
            return 500000000n // 500 USDC
          }
        }
        return 0n
      })

      const positions = await aavePlugin.fetcher.fetchPositions('0x1234567890123456789012345678901234567890', 'ethereum')
      
      expect(positions.length).toBeGreaterThan(0)
      const supplyPos = positions.find(p => p.positionType === 'supply')
      const borrowPos = positions.find(p => p.positionType === 'borrow')

      expect(supplyPos).toBeDefined()
      expect(supplyPos?.asset).toBe('USDC')
      expect(supplyPos?.amount).toBe(1000)
      expect(supplyPos?.amountUsd).toBe(1000)
      expect(supplyPos?.currentApy).toBeCloseTo(0.05)

      expect(borrowPos).toBeDefined()
      expect(borrowPos?.asset).toBe('USDC')
      expect(borrowPos?.amount).toBe(500)
      expect(borrowPos?.amountUsd).toBe(500)
      expect(borrowPos?.currentApy).toBeCloseTo(0.06)
    })
  })

  describe('buildTx', () => {
    it('should build supply transactions', async () => {
      const txs = await aavePlugin.builder.buildTx({
        action: 'supply',
        protocol: 'aave',
        chain: 'ethereum',
        asset: 'USDC',
        amount: '100',
        userAddress: '0x1234567890123456789012345678901234567890',
      })

      expect(txs.length).toBe(2)
      expect(txs[0].description).toContain('Approve Aave V3 Pool')
      expect(txs[1].description).toContain('Supply 100 USDC')
    })

    it('should build withdraw transactions', async () => {
      const txs = await aavePlugin.builder.buildTx({
        action: 'withdraw',
        protocol: 'aave',
        chain: 'ethereum',
        asset: 'USDC',
        amount: '50',
        userAddress: '0x1234567890123456789012345678901234567890',
      })

      expect(txs.length).toBe(1)
      expect(txs[0].description).toContain('Withdraw 50 USDC')
    })

    it('should build borrow transactions', async () => {
      const txs = await aavePlugin.builder.buildTx({
        action: 'borrow',
        protocol: 'aave',
        chain: 'ethereum',
        asset: 'USDC',
        amount: '50',
        userAddress: '0x1234567890123456789012345678901234567890',
      })

      expect(txs.length).toBe(1)
      expect(txs[0].description).toContain('Borrow 50 USDC')
    })

    it('should build repay transactions', async () => {
      const txs = await aavePlugin.builder.buildTx({
        action: 'repay',
        protocol: 'aave',
        chain: 'ethereum',
        asset: 'USDC',
        amount: '100',
        userAddress: '0x1234567890123456789012345678901234567890',
      })

      expect(txs.length).toBe(2)
      expect(txs[0].description).toContain('Approve Aave V3 Pool')
      expect(txs[1].description).toContain('Repay 100 USDC')
    })
  })
})

describe('Euler V2 Protocol Plugin', () => {
  const mockPublicClient = {
    readContract: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getPublicClient).mockReturnValue(mockPublicClient as any)
  })

  describe('fetchPositions', () => {
    it('should fetch supply and borrow positions correctly', async () => {
      mockPublicClient.readContract.mockImplementation(async ({ functionName, address }: any) => {
        if (functionName === 'balanceOf') {
          // If USDC vault, return shares
          if (address === EULER_CURATED_VAULTS.USDC) {
            return 1000000000n // 1000 shares
          }
        }
        if (functionName === 'convertToAssets') {
          return 1000000000n // 1000 USDC assets
        }
        if (functionName === 'debtOf') {
          if (address === EULER_CURATED_VAULTS.USDC) {
            return 500000000n // 500 USDC debt
          }
        }
        return 0n
      })

      const positions = await eulerPlugin.fetcher.fetchPositions('0x1234567890123456789012345678901234567890', 'ethereum')
      
      const supplyPos = positions.find(p => p.positionType === 'supply')
      const borrowPos = positions.find(p => p.positionType === 'borrow')

      expect(supplyPos).toBeDefined()
      expect(supplyPos?.asset).toBe('USDC')
      expect(supplyPos?.amount).toBe(1000)

      expect(borrowPos).toBeDefined()
      expect(borrowPos?.asset).toBe('USDC')
      expect(borrowPos?.amount).toBe(500)
    })
  })

  describe('buildTx', () => {
    it('should build supply transactions', async () => {
      const txs = await eulerPlugin.builder.buildTx({
        action: 'supply',
        protocol: 'euler',
        chain: 'ethereum',
        asset: 'USDC',
        amount: '100',
        userAddress: '0x1234567890123456789012345678901234567890',
      })

      expect(txs.length).toBe(2)
      expect(txs[0].description).toContain('Approve Euler EVault')
      expect(txs[1].description).toContain('Supply 100 USDC')
    })

    it('should build withdraw transactions', async () => {
      const txs = await eulerPlugin.builder.buildTx({
        action: 'withdraw',
        protocol: 'euler',
        chain: 'ethereum',
        asset: 'USDC',
        amount: '50',
        userAddress: '0x1234567890123456789012345678901234567890',
      })

      expect(txs.length).toBe(1)
      expect(txs[0].description).toContain('Withdraw 50 USDC')
    })

    it('should build borrow transactions', async () => {
      const txs = await eulerPlugin.builder.buildTx({
        action: 'borrow',
        protocol: 'euler',
        chain: 'ethereum',
        asset: 'USDC',
        amount: '50',
        userAddress: '0x1234567890123456789012345678901234567890',
      })

      expect(txs.length).toBe(1)
      expect(txs[0].description).toContain('Borrow 50 USDC')
    })

    it('should build repay transactions', async () => {
      const txs = await eulerPlugin.builder.buildTx({
        action: 'repay',
        protocol: 'euler',
        chain: 'ethereum',
        asset: 'USDC',
        amount: '100',
        userAddress: '0x1234567890123456789012345678901234567890',
      })

      expect(txs.length).toBe(2)
      expect(txs[0].description).toContain('Approve Euler EVault')
      expect(txs[1].description).toContain('Repay 100 USDC')
    })
  })
})
