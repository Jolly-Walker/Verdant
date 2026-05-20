import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

vi.mock('@/lib/server/rpc', () => ({
  getPublicClient: vi.fn(),
}))

vi.mock('@/lib/data/prices', () => ({
  fetchTokenPrices: vi.fn().mockResolvedValue({
    'coingecko:usd-coin': 1.0,
    'coingecko:ethereum': 3000.0,
  }),
}))

vi.mock('@/lib/data/merkl', () => ({
  fetchMerklClaims: vi.fn(),
  MERKL_DISTRIBUTOR_ADDRESS: '0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae',
}))

vi.mock('@/lib/data/aaveSubgraph', () => ({
  fetchAaveUserData: vi.fn(),
}))

// Mock fetch for Pendle API and DeFiLlama
global.fetch = vi.fn()

import { aavePlugin } from '../aave'
import { eulerPlugin, EULER_CURATED_VAULTS } from '../euler'
import { morphoPlugin } from '../morpho'
import { pendlePlugin } from '../pendle'
import { getPublicClient } from '@/lib/server/rpc'
import { fetchTokenPrices } from '@/lib/data/prices'
import { fetchMerklClaims } from '@/lib/data/merkl'

// ─── Aave RewardFetcher ───────────────────────────────────────────────────────

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
      mockPublicClient.readContract.mockResolvedValueOnce([0n, 0n, 0n, 0n, 0n, 0n])

      const positions = await aavePlugin.fetcher.fetchPositions('0x1234567890123456789012345678901234567890', 'ethereum')
      expect(positions).toEqual([])
    })

    it('should return enriched positions when subgraph data exists', async () => {
      const { fetchAaveUserData } = await import('@/lib/data/aaveSubgraph')
      vi.mocked(fetchAaveUserData).mockResolvedValueOnce({
        user: {
          id: '0x123',
          totalCollateralBase: '1000',
          totalDebtBase: '500',
          healthFactor: '1500000000000000000', // 1.5
          userReserves: [
            {
              reserve: {
                underlyingAsset: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC on Arbitrum
                symbol: 'USDC',
                decimals: 6
              },
              currentATokenBalance: '1000000000', // 1000 USDC
              currentVariableDebt: '0',
              usageAsCollateralEnabledOnUser: true
            }
          ]
        }
      })

      mockPublicClient.readContract.mockResolvedValue([
        0n, 0n, 0n, 0n,
        50000000000000000000000000n,
        60000000000000000000000000n,
        0n, 0n, 0n,
        '0xATokenAddress',
        '0xStableDebtTokenAddress',
        '0xVariableDebtTokenAddress',
        '0xStrategyAddress'
      ])

      const positions = await aavePlugin.fetcher.fetchPositions('0x1234567890123456789012345678901234567890', 'arbitrum')

      expect(positions.length).toBe(1)
      expect(positions[0].amount).toBe(1000)
      expect(positions[0].metadata.healthFactor).toBe(1.5)
      expect(positions[0].metadata.isCollateral).toBe(true)
    })

    it('should return positions when balances exist', async () => {
      mockPublicClient.readContract.mockResolvedValueOnce([1000000n, 500000n, 0n, 0n, 0n, 0n])

      mockPublicClient.readContract.mockImplementation(async ({ functionName, args, address }: any) => {
        if (functionName === 'getReserveData') {
          return [
            0n, 0n, 0n, 0n,
            50000000000000000000000000n,
            60000000000000000000000000n,
            0n, 0n, 0n,
            '0xATokenAddress',
            '0xStableDebtTokenAddress',
            '0xVariableDebtTokenAddress',
            '0xStrategyAddress'
          ]
        }
        if (functionName === 'balanceOf') {
          if (address === '0xATokenAddress') return 1000000000n
          if (address === '0xVariableDebtTokenAddress') return 500000000n
        }
        return 0n
      })

      const positions = await aavePlugin.fetcher.fetchPositions('0x1234567890123456789012345678901234567890', 'ethereum')

      expect(positions.length).toBeGreaterThan(0)
      const supplyPos = positions.find(p => p.positionType === 'supply')
      expect(supplyPos).toBeDefined()
      expect(supplyPos?.asset).toBe('USDC')
    })
  })

  describe('buildTx', () => {
    it('should build supply transactions', async () => {
      const txs = await aavePlugin.builder.buildTx({
        action: 'supply', protocol: 'aave', chain: 'ethereum',
        asset: 'USDC', amount: '100', userAddress: '0x1234567890123456789012345678901234567890',
      })
      expect(txs.length).toBe(2)
      expect(txs[0].description).toContain('Approve Aave V3 Pool')
      expect(txs[1].description).toContain('Supply 100 USDC')
    })

    it('should build withdraw transactions', async () => {
      const txs = await aavePlugin.builder.buildTx({
        action: 'withdraw', protocol: 'aave', chain: 'ethereum',
        asset: 'USDC', amount: '50', userAddress: '0x1234567890123456789012345678901234567890',
      })
      expect(txs.length).toBe(1)
      expect(txs[0].description).toContain('Withdraw 50 USDC')
    })

    it('should build borrow transactions', async () => {
      const txs = await aavePlugin.builder.buildTx({
        action: 'borrow', protocol: 'aave', chain: 'ethereum',
        asset: 'USDC', amount: '50', userAddress: '0x1234567890123456789012345678901234567890',
      })
      expect(txs.length).toBe(1)
      expect(txs[0].description).toContain('Borrow 50 USDC')
    })

    it('should build repay transactions', async () => {
      const txs = await aavePlugin.builder.buildTx({
        action: 'repay', protocol: 'aave', chain: 'ethereum',
        asset: 'USDC', amount: '100', userAddress: '0x1234567890123456789012345678901234567890',
      })
      expect(txs.length).toBe(2)
      expect(txs[0].description).toContain('Approve Aave V3 Pool')
      expect(txs[1].description).toContain('Repay 100 USDC')
    })
  })

  describe('rewards.fetchRewards', () => {
    it('should return empty array when user holds no aTokens', async () => {
      // getUserAccountData → no positions
      mockPublicClient.readContract.mockImplementation(async ({ functionName }: any) => {
        if (functionName === 'getReserveData') {
          return [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, '0xAToken', '0x', '0x', '0x']
        }
        if (functionName === 'balanceOf') return 0n
        return []
      })

      const rewards = await aavePlugin.rewards!.fetchRewards(
        '0x1234567890123456789012345678901234567890',
        'ethereum'
      )
      expect(rewards).toEqual([])
    })

    it('should return reward entries when user has aToken balance and claimable rewards', async () => {
      const USER = '0x1234567890123456789012345678901234567890'
      const ATOKEN = '0x1111111111111111111111111111111111111111'
      const REWARD_TOKEN = '0x2222222222222222222222222222222222222222'

      mockPublicClient.readContract.mockImplementation(async ({ functionName, address, args }: any) => {
        if (functionName === 'getReserveData') {
          return [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, ATOKEN, '0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000']
        }
        if (functionName === 'balanceOf') {
          if (address === ATOKEN) return 1000000000n // user holds aTokens
          return 0n
        }
        if (functionName === 'getRewardsByAsset') return [REWARD_TOKEN]
        if (functionName === 'getUserRewards') return 5000000000000000000n // 5 tokens (18 dec)
        return 0n
      })

      vi.mocked(fetchTokenPrices).mockResolvedValue({ 'coingecko:usd-coin': 1.0 })

      const rewards = await aavePlugin.rewards!.fetchRewards(USER, 'ethereum')
      expect(rewards.length).toBeGreaterThan(0)
      expect(Number(rewards[0].amount)).toBeGreaterThan(0)
    })
  })

  describe('rewards.buildClaimTx', () => {
    it('should build a claimAllRewards transaction targeting the RewardsController', async () => {
      const USER = '0x1234567890123456789012345678901234567890'
      const ATOKEN = '0x1111111111111111111111111111111111111111'

      mockPublicClient.readContract.mockImplementation(async ({ functionName, address }: any) => {
        if (functionName === 'getReserveData') {
          return [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, ATOKEN, '0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000']
        }
        if (functionName === 'balanceOf') {
          return address === ATOKEN ? 1000000n : 0n
        }
        return 0n
      })

      const txs = await aavePlugin.rewards!.buildClaimTx({ address: USER, chain: 'ethereum' })
      expect(txs.length).toBe(1)
      expect(txs[0].to).toBe('0x8164Cc65827dcFe994AB23944CBC90e0aa80bFcb')
      expect(txs[0].description).toContain('Claim all Aave V3 rewards')
    })

    it('should return empty array when user holds no aTokens (nothing to claim)', async () => {
      mockPublicClient.readContract.mockImplementation(async ({ functionName }: any) => {
        if (functionName === 'getReserveData') {
          return [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, '0x1111111111111111111111111111111111111111', '0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000']
        }
        return 0n
      })

      const txs = await aavePlugin.rewards!.buildClaimTx({
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
      })
      // With 0 aToken balance, aTokenAddresses will be empty → claimAllRewards with empty array
      // The tx is still built (controller call with empty assets[])
      expect(txs.length).toBe(1)
      expect(txs[0].to.toLowerCase()).toContain('0x8164')
    })

    it('should throw for unsupported chain (solana)', async () => {
      await expect(
        aavePlugin.rewards!.buildClaimTx({ address: '0x123', chain: 'solana' })
      ).rejects.toThrow('not available on solana')
    })
  })
})

// ─── Euler RewardFetcher ──────────────────────────────────────────────────────

describe('Euler V2 Protocol Plugin', () => {
  const mockPublicClient = { readContract: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getPublicClient).mockReturnValue(mockPublicClient as any)
    vi.mocked(fetchMerklClaims).mockResolvedValue([])
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ coins: {} }),
    })
  })

  describe('fetchPositions', () => {
    it('should fetch supply and borrow positions correctly', async () => {
      mockPublicClient.readContract.mockImplementation(async ({ functionName, address }: any) => {
        if (functionName === 'balanceOf' && address === EULER_CURATED_VAULTS.USDC) return 1000000000n
        if (functionName === 'convertToAssets') return 1000000000n
        if (functionName === 'debtOf' && address === EULER_CURATED_VAULTS.USDC) return 500000000n
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
        action: 'supply', protocol: 'euler', chain: 'ethereum',
        asset: 'USDC', amount: '100', userAddress: '0x1234567890123456789012345678901234567890',
      })
      expect(txs.length).toBe(2)
      expect(txs[0].description).toContain('Approve Euler EVault')
      expect(txs[1].description).toContain('Supply 100 USDC')
    })

    it('should build withdraw transactions', async () => {
      const txs = await eulerPlugin.builder.buildTx({
        action: 'withdraw', protocol: 'euler', chain: 'ethereum',
        asset: 'USDC', amount: '50', userAddress: '0x1234567890123456789012345678901234567890',
      })
      expect(txs.length).toBe(1)
      expect(txs[0].description).toContain('Withdraw 50 USDC')
    })

    it('should build borrow transactions', async () => {
      const txs = await eulerPlugin.builder.buildTx({
        action: 'borrow', protocol: 'euler', chain: 'ethereum',
        asset: 'USDC', amount: '50', userAddress: '0x1234567890123456789012345678901234567890',
      })
      expect(txs.length).toBe(1)
      expect(txs[0].description).toContain('Borrow 50 USDC')
    })

    it('should build repay transactions', async () => {
      const txs = await eulerPlugin.builder.buildTx({
        action: 'repay', protocol: 'euler', chain: 'ethereum',
        asset: 'USDC', amount: '100', userAddress: '0x1234567890123456789012345678901234567890',
      })
      expect(txs.length).toBe(2)
      expect(txs[0].description).toContain('Approve Euler EVault')
      expect(txs[1].description).toContain('Repay 100 USDC')
    })
  })

  describe('rewards.fetchRewards', () => {
    it('should return empty when no Merkl claims', async () => {
      vi.mocked(fetchMerklClaims).mockResolvedValue([])
      const rewards = await eulerPlugin.rewards!.fetchRewards(
        '0x1234567890123456789012345678901234567890', 'ethereum'
      )
      expect(rewards).toEqual([])
    })

    it('should return rewards mapped from Merkl claims', async () => {
      vi.mocked(fetchMerklClaims).mockResolvedValue([
        {
          token: '0x3333333333333333333333333333333333333333',
          symbol: 'EUL',
          decimals: 18,
          cumulativeAmount: '10000000000000000000',
          claimedAmount: '0',
          claimableAmount: '10000000000000000000',
          proof: ['0xabcd000000000000000000000000000000000000000000000000000000000000'],
        },
      ])
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          coins: { 'ethereum:0x3333333333333333333333333333333333333333': { price: 5.0 } },
        }),
      })

      const rewards = await eulerPlugin.rewards!.fetchRewards(
        '0x1234567890123456789012345678901234567890', 'ethereum'
      )
      expect(rewards.length).toBe(1)
      expect(rewards[0].token).toBe('EUL')
      expect(rewards[0].amountUsd).toBeCloseTo(50, 0) // 10 EUL * $5
    })
  })

  describe('rewards.buildClaimTx', () => {
    it('should return empty array when no Merkl claims exist', async () => {
      vi.mocked(fetchMerklClaims).mockResolvedValue([])
      const txs = await eulerPlugin.rewards!.buildClaimTx({
        address: '0x1234567890123456789012345678901234567890', chain: 'ethereum',
      })
      expect(txs).toEqual([])
    })

    it('should build a Merkl Distributor claim transaction', async () => {
      vi.mocked(fetchMerklClaims).mockResolvedValue([
        {
          token: '0x4444444444444444444444444444444444444444',
          symbol: 'EUL',
          decimals: 18,
          cumulativeAmount: '5000000000000000000',
          claimedAmount: '0',
          claimableAmount: '5000000000000000000',
          proof: ['0xabcd000000000000000000000000000000000000000000000000000000000000'],
        },
      ])

      const txs = await eulerPlugin.rewards!.buildClaimTx({
        address: '0x1234567890123456789012345678901234567890', chain: 'ethereum',
      })
      expect(txs.length).toBe(1)
      expect(txs[0].to).toBe('0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae')
      expect(txs[0].description).toContain('Claim Euler rewards')
    })

    it('should throw for unsupported chain', async () => {
      await expect(
        eulerPlugin.rewards!.buildClaimTx({ address: '0x123', chain: 'solana' })
      ).rejects.toThrow('not supported on solana')
    })
  })
})

// ─── Morpho RewardFetcher ─────────────────────────────────────────────────────

describe('Morpho Protocol Plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchMerklClaims).mockResolvedValue([])
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ coins: {} }),
    })
  })

  describe('rewards.fetchRewards', () => {
    it('should return empty when no Merkl claims', async () => {
      const rewards = await morphoPlugin.rewards!.fetchRewards(
        '0x1234567890123456789012345678901234567890', 'ethereum'
      )
      expect(rewards).toEqual([])
    })

    it('should map Merkl claims to Reward objects', async () => {
      vi.mocked(fetchMerklClaims).mockResolvedValue([
        {
          token: '0x5555555555555555555555555555555555555555',
          symbol: 'MORPHO',
          decimals: 18,
          cumulativeAmount: '2000000000000000000',
          claimedAmount: '0',
          claimableAmount: '2000000000000000000',
          proof: ['0xaabb000000000000000000000000000000000000000000000000000000000000'],
        },
      ])
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          coins: { 'ethereum:0x5555555555555555555555555555555555555555': { price: 1.5 } },
        }),
      })

      const rewards = await morphoPlugin.rewards!.fetchRewards(
        '0x1234567890123456789012345678901234567890', 'ethereum'
      )
      expect(rewards.length).toBe(1)
      expect(rewards[0].token).toBe('MORPHO')
      expect(rewards[0].amountUsd).toBeCloseTo(3.0, 1)
    })
  })

  describe('rewards.buildClaimTx', () => {
    it('should build a Merkl claim tx for Morpho rewards', async () => {
      vi.mocked(fetchMerklClaims).mockResolvedValue([
        {
          token: '0x6666666666666666666666666666666666666666',
          symbol: 'MORPHO',
          decimals: 18,
          cumulativeAmount: '1000000000000000000',
          claimedAmount: '0',
          claimableAmount: '1000000000000000000',
          proof: ['0xaabb000000000000000000000000000000000000000000000000000000000000'],
        },
      ])

      const txs = await morphoPlugin.rewards!.buildClaimTx({
        address: '0x1234567890123456789012345678901234567890', chain: 'ethereum',
      })
      expect(txs.length).toBe(1)
      expect(txs[0].to).toBe('0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae')
      expect(txs[0].description).toContain('Morpho')
      expect(txs[0].chainId).toBe(1)
    })

    it('should return empty array when no claims exist', async () => {
      vi.mocked(fetchMerklClaims).mockResolvedValue([])
      const txs = await morphoPlugin.rewards!.buildClaimTx({
        address: '0x1234567890123456789012345678901234567890', chain: 'base',
      })
      expect(txs).toEqual([])
    })
  })
})

// ─── Pendle RewardFetcher ─────────────────────────────────────────────────────

describe('Pendle Protocol Plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rewards.fetchRewards', () => {
    it('should return empty when chain not supported (base)', async () => {
      const rewards = await pendlePlugin.rewards!.fetchRewards(
        '0x1234567890123456789012345678901234567890', 'base'
      )
      expect(rewards).toEqual([])
    })

    it('should return empty when Pendle API returns no positions with pending yield', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ balances: [] }),
      })

      const rewards = await pendlePlugin.rewards!.fetchRewards(
        '0x1234567890123456789012345678901234567890', 'ethereum'
      )
      expect(rewards).toEqual([])
    })

    it('should return rewards when Pendle API reports pending yields', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          balances: [
            {
              ytBalance: '1000000000000000000',
              marketAddress: '0xMarket1',
              ytAddress: '0xYT1',
              pendingYield: {
                token: { symbol: 'eETH' },
                amount: 0.05,
                amountUsd: 150.0,
              },
            },
          ],
        }),
      })

      const rewards = await pendlePlugin.rewards!.fetchRewards(
        '0x1234567890123456789012345678901234567890', 'ethereum'
      )
      expect(rewards.length).toBe(1)
      expect(rewards[0].token).toBe('eETH')
      expect(rewards[0].amountUsd).toBe(150.0)
    })
  })

  describe('rewards.buildClaimTx', () => {
    it('should return empty when chain not supported', async () => {
      await expect(
        pendlePlugin.rewards!.buildClaimTx({ address: '0x123', chain: 'base' })
      ).rejects.toThrow('not supported on base')
    })

    it('should build redeemDueInterestAndRewards transactions for each YT market', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          balances: [
            {
              ytBalance: '1000000000000000000',
              marketAddress: '0xMarket1',
              ytAddress: '0xYTAddress1',
              pendingYield: { token: { symbol: 'eETH' }, amount: 0.05, amountUsd: 150.0 },
            },
          ],
        }),
      })

      const txs = await pendlePlugin.rewards!.buildClaimTx({
        address: '0x1234567890123456789012345678901234567890', chain: 'ethereum',
      })
      expect(txs.length).toBe(1)
      expect(txs[0].to).toBe('0xYTAddress1')
      expect(txs[0].description).toContain('Claim Pendle YT')
      expect(txs[0].chainId).toBe(1)
    })
  })
})
