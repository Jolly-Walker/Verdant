import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock server-only before other imports
vi.mock('server-only', () => ({}))

import { fetchDepositDestinations } from '../destinationsFetcher'
import * as defillama from '../defillama'

vi.mock('../defillama', () => {
  return {
    fetchPoolApys: vi.fn(),
  }
})

describe('fetchDepositDestinations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters by TVL floor ($1,000,000)', async () => {
    const mockPools: Partial<defillama.DefillamaPool>[] = [
      {
        pool: 'pool-1',
        project: 'aave-v3',
        chain: 'Ethereum',
        symbol: 'USDC',
        apy: 5.0,
        apyBase: 5.0,
        apyReward: null,
        apyMean30d: null,
        tvlUsd: 2_000_000,
        stablecoin: true,
        audits: '1',
        exposure: 'single',
        poolMeta: null,
        underlyingTokens: ['0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'],
        rewardTokens: null,
        ilRisk: 'no',
        category: 'Lending',
      },
      {
        pool: 'pool-2',
        project: 'aave-v3',
        chain: 'Ethereum',
        symbol: 'USDC',
        apy: 5.0,
        apyBase: 5.0,
        apyReward: null,
        apyMean30d: null,
        tvlUsd: 500_000, // below floor
        stablecoin: true,
        audits: '1',
        exposure: 'single',
        poolMeta: null,
        underlyingTokens: ['0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'],
        rewardTokens: null,
        ilRisk: 'no',
        category: 'Lending',
      }
    ]

    vi.spyOn(defillama, 'fetchPoolApys').mockResolvedValue(mockPools)

    const result = await fetchDepositDestinations('USDC', 'ethereum')
    expect(result.length).toBe(1)
    expect(result[0].id).toBe('pool-1')
  })

  it('filters by audited pools', async () => {
    const mockPools: Partial<defillama.DefillamaPool>[] = [
      {
        pool: 'pool-1',
        project: 'aave-v3',
        chain: 'Ethereum',
        symbol: 'USDC',
        apy: 5.0,
        tvlUsd: 2_000_000,
        exposure: 'single',
        audits: '1', // audited
        poolMeta: null,
      },
      {
        pool: 'pool-2',
        project: 'aave-v3',
        chain: 'Ethereum',
        symbol: 'USDC',
        apy: 5.0,
        tvlUsd: 2_000_000,
        exposure: 'single',
        audits: null, // not audited
        poolMeta: null,
      }
    ]

    vi.spyOn(defillama, 'fetchPoolApys').mockResolvedValue(mockPools)

    const result = await fetchDepositDestinations('USDC', 'ethereum')
    expect(result.length).toBe(1)
    expect(result[0].id).toBe('pool-1')
  })

  it('filters out LP exposure and LP categories', async () => {
    const mockPools: Partial<defillama.DefillamaPool>[] = [
      {
        pool: 'pool-1',
        project: 'aave-v3',
        chain: 'Ethereum',
        symbol: 'USDC',
        apy: 5.0,
        tvlUsd: 2_000_000,
        exposure: 'single',
        audits: '1',
        poolMeta: null,
      },
      {
        pool: 'pool-2',
        project: 'aave-v3',
        chain: 'Ethereum',
        symbol: 'USDC',
        apy: 5.0,
        tvlUsd: 2_000_000,
        exposure: 'multi', // LP exposure
        audits: '1',
        poolMeta: null,
      },
      {
        pool: 'pool-3',
        project: 'aave-v3',
        chain: 'Ethereum',
        symbol: 'USDC',
        apy: 5.0,
        tvlUsd: 2_000_000,
        exposure: 'single',
        audits: '1',
        category: 'Liquidity Pool', // LP category
        poolMeta: null,
      }
    ]

    vi.spyOn(defillama, 'fetchPoolApys').mockResolvedValue(mockPools)

    const result = await fetchDepositDestinations('USDC', 'ethereum')
    expect(result.length).toBe(1)
    expect(result[0].id).toBe('pool-1')
  })

  it('filters out protocols that do not support supply/deposit (like Pendle)', async () => {
    const mockPools: Partial<defillama.DefillamaPool>[] = [
      {
        pool: 'pool-1',
        project: 'pendle', // Pendle is registered but doesn't support 'supply'
        chain: 'Ethereum',
        symbol: 'USDC',
        apy: 5.0,
        tvlUsd: 2_000_000,
        exposure: 'single',
        audits: '1',
        poolMeta: null,
      },
      {
        pool: 'pool-2',
        project: 'aave-v3', // Aave supports 'supply'
        chain: 'Ethereum',
        symbol: 'USDC',
        apy: 5.0,
        tvlUsd: 2_000_000,
        exposure: 'single',
        audits: '1',
        poolMeta: null,
      }
    ]

    vi.spyOn(defillama, 'fetchPoolApys').mockResolvedValue(mockPools)

    const result = await fetchDepositDestinations('USDC', 'ethereum')
    expect(result.length).toBe(1)
    expect(result[0].id).toBe('pool-2')
  })

  it('filters out duplicated Aave V3 market pools (Umbrella, Horizon, etc.)', async () => {
    const mockPools: Partial<defillama.DefillamaPool>[] = [
      {
        pool: 'pool-1',
        project: 'aave-v3',
        chain: 'Ethereum',
        symbol: 'USDC',
        apy: 3.3,
        tvlUsd: 160_000_000,
        exposure: 'single',
        audits: '1',
        poolMeta: null, // main pool
      },
      {
        pool: 'pool-2',
        project: 'aave-v3',
        chain: 'Ethereum',
        symbol: 'USDC',
        apy: 7.8,
        tvlUsd: 46_000_000,
        exposure: 'single',
        audits: '1',
        poolMeta: 'Umbrella', // Umbrella pool
      },
      {
        pool: 'pool-3',
        project: 'aave-v3',
        chain: 'Ethereum',
        symbol: 'USDC',
        apy: 2.1,
        tvlUsd: 4_400_000,
        exposure: 'single',
        audits: '1',
        poolMeta: 'Aave Horizon Market', // Horizon pool
      }
    ]

    vi.spyOn(defillama, 'fetchPoolApys').mockResolvedValue(mockPools)

    const result = await fetchDepositDestinations('USDC', 'ethereum')
    expect(result.length).toBe(1)
    expect(result[0].id).toBe('pool-1')
  })

  it('derives receipt token symbol (outputTokenSymbol) correctly', async () => {
    const mockPools: Partial<defillama.DefillamaPool>[] = [
      {
        pool: 'pool-1',
        project: 'aave-v3',
        chain: 'Ethereum',
        symbol: 'USDC',
        apy: 5.0,
        tvlUsd: 2_000_000,
        exposure: 'single',
        audits: '1',
        poolMeta: null,
      },
      {
        pool: 'pool-2',
        project: 'euler-v2',
        chain: 'Ethereum',
        symbol: 'WETH',
        apy: 4.0,
        tvlUsd: 2_000_000,
        exposure: 'single',
        audits: '1',
        poolMeta: null,
      },
      {
        pool: 'pool-3',
        project: 'morpho-blue',
        chain: 'Ethereum',
        symbol: 'steakUSDC',
        apy: 6.0,
        tvlUsd: 2_000_000,
        exposure: 'single',
        audits: '1',
        poolMeta: null,
      }
    ]

    vi.spyOn(defillama, 'fetchPoolApys').mockResolvedValue(mockPools)

    const result = await fetchDepositDestinations()
    expect(result.length).toBe(3)

    const aaveRes = result.find(r => r.protocol === 'aave')
    expect(aaveRes?.outputTokenSymbol).toBe('aUSDC')

    const eulerRes = result.find(r => r.protocol === 'euler')
    expect(eulerRes?.outputTokenSymbol).toBe('eWETH')

    const morphoRes = result.find(r => r.protocol === 'morpho')
    expect(morphoRes?.outputTokenSymbol).toBe('steakUSDC')
  })

  it('correctly parses lock period days from poolMeta', async () => {
    const mockPools: Partial<defillama.DefillamaPool>[] = [
      {
        pool: 'pool-1',
        project: 'morpho-blue',
        chain: 'Ethereum',
        symbol: 'USDC',
        apy: 5.0,
        tvlUsd: 2_000_000,
        exposure: 'single',
        audits: '1',
        poolMeta: '90-day lock period',
      },
      {
        pool: 'pool-2',
        project: 'morpho-blue',
        chain: 'Ethereum',
        symbol: 'USDC',
        apy: 5.0,
        tvlUsd: 2_000_000,
        exposure: 'single',
        audits: '1',
        poolMeta: 'Vested / Locked duration',
      }
    ]

    vi.spyOn(defillama, 'fetchPoolApys').mockResolvedValue(mockPools)

    const result = await fetchDepositDestinations('USDC', 'ethereum')
    expect(result.length).toBe(2)

    const lock90 = result.find(r => r.id === 'pool-1')
    expect(lock90?.lockPeriodDays).toBe(90)
    expect(lock90?.lockDescription).toBe('90-day lock period')

    const lockUnknown = result.find(r => r.id === 'pool-2')
    expect(lockUnknown?.lockPeriodDays).toBeNull()
    expect(lockUnknown?.lockDescription).toBe('Vested / Locked duration')
  })
})
