import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/server/rpc', () => ({
  getPublicClient: vi.fn(),
}));

vi.mock('@/lib/data/prices', () => ({
  fetchTokenPrices: vi.fn().mockResolvedValue({
    'coingecko:usd-coin': 1.0,
    'coingecko:ethereum': 3000.0,
  }),
}));

vi.mock('@/lib/data/merkl', () => ({
  fetchMerklClaims: vi.fn(),
  MERKL_DISTRIBUTOR_ADDRESS: '0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae',
}));

vi.mock('@/lib/data/aaveSubgraph', () => ({
  fetchAaveUserData: vi.fn(),
}));

vi.mock('@/lib/data/morphoApi', () => ({
  fetchMorphoVaultPositions: vi.fn().mockResolvedValue([]),
}));

// Mock fetch for Pendle API and DeFiLlama
global.fetch = vi.fn();

import { fetchMerklClaims } from '@/lib/data/merkl';
import { fetchTokenPrices } from '@/lib/data/prices';
import { getPublicClient } from '@/lib/server/rpc';
import { aavePlugin, MIN_HEALTH_FACTOR, projectHealthFactor } from '../aave';
import { EULER_CURATED_VAULTS, eulerPlugin } from '../euler';
import { morphoPlugin } from '../morpho';
import { pendlePlugin } from '../pendle';

// ─── Aave RewardFetcher ───────────────────────────────────────────────────────

describe('Aave V3 Protocol Plugin', () => {
  const mockPublicClient = {
    readContract: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPublicClient).mockReturnValue(
      mockPublicClient as unknown as ReturnType<typeof getPublicClient>,
    );
  });

  describe('fetchPositions', () => {
    it('should return empty if user has no positions (getUserAccountData returns zeros)', async () => {
      mockPublicClient.readContract.mockResolvedValueOnce([0n, 0n, 0n, 0n, 0n, 0n]);

      const positions = await aavePlugin.fetcher.fetchPositions(
        '0x1234567890123456789012345678901234567890',
        'ethereum',
      );
      expect(positions).toEqual([]);
    });

    it('should return enriched positions when subgraph data exists', async () => {
      const { fetchAaveUserData } = await import('@/lib/data/aaveSubgraph');
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
                decimals: 6,
              },
              currentATokenBalance: '1000000000', // 1000 USDC
              currentVariableDebt: '0',
              usageAsCollateralEnabledOnUser: true,
            },
          ],
        },
      });

      mockPublicClient.readContract.mockResolvedValue(
        Object.assign(
          [
            0n,
            0n,
            0n,
            0n,
            50000000000000000000000000n,
            60000000000000000000000000n,
            0n,
            0n,
            0n,
            '0xATokenAddress',
            '0xStableDebtTokenAddress',
            '0xVariableDebtTokenAddress',
            '0xStrategyAddress',
          ],
          {
            currentLiquidityRate: 50000000000000000000000000n,
            currentVariableBorrowRate: 60000000000000000000000000n,
            aTokenAddress: '0xATokenAddress',
            variableDebtTokenAddress: '0xVariableDebtTokenAddress',
          },
        ),
      );

      const positions = await aavePlugin.fetcher.fetchPositions(
        '0x1234567890123456789012345678901234567890',
        'arbitrum',
      );

      expect(positions.length).toBe(1);
      expect(positions[0].amount).toBe(1000);
      expect(positions[0].metadata.healthFactor).toBe(1.5);
      expect(positions[0].metadata.isCollateral).toBe(true);
    });

    it('should return positions when balances exist', async () => {
      mockPublicClient.readContract.mockResolvedValueOnce(
        Object.assign([1000000n, 500000n, 0n, 0n, 0n, 0n], {
          totalCollateralBase: 1000000n,
          totalDebtBase: 500000n,
          healthFactor: 0n,
        }),
      );

      mockPublicClient.readContract.mockImplementation(
        async ({ functionName, address }: { functionName: string; address?: string }) => {
          if (functionName === 'getReserveData') {
            return Object.assign(
              [
                0n,
                0n,
                0n,
                0n,
                50000000000000000000000000n,
                60000000000000000000000000n,
                0n,
                0n,
                0n,
                '0xATokenAddress',
                '0xStableDebtTokenAddress',
                '0xVariableDebtTokenAddress',
                '0xStrategyAddress',
              ],
              {
                currentLiquidityRate: 50000000000000000000000000n,
                currentVariableBorrowRate: 60000000000000000000000000n,
                aTokenAddress: '0xATokenAddress',
                variableDebtTokenAddress: '0xVariableDebtTokenAddress',
              },
            );
          }
          if (functionName === 'balanceOf') {
            if (address === '0xATokenAddress') return 1000000000n;
            if (address === '0xVariableDebtTokenAddress') return 500000000n;
          }
          return 0n;
        },
      );

      const positions = await aavePlugin.fetcher.fetchPositions(
        '0x1234567890123456789012345678901234567890',
        'ethereum',
      );

      expect(positions.length).toBeGreaterThan(0);
      const supplyPos = positions.find((p) => p.positionType === 'supply');
      expect(supplyPos).toBeDefined();
      expect(supplyPos?.asset).toBe('USDC');
    });
  });

  describe('buildTx', () => {
    it('should build supply transactions', async () => {
      const txs = await aavePlugin.builder.buildTx({
        action: 'supply',
        protocol: 'aave',
        chain: 'ethereum',
        asset: 'USDC',
        amount: '100',
        userAddress: '0x1234567890123456789012345678901234567890',
      });
      expect(txs.length).toBe(2);
      expect(txs[0].description).toContain('Approve Aave V3 Pool');
      expect(txs[1].description).toContain('Supply 100 USDC');
    });

    it('should build withdraw transactions', async () => {
      const txs = await aavePlugin.builder.buildTx({
        action: 'withdraw',
        protocol: 'aave',
        chain: 'ethereum',
        asset: 'USDC',
        amount: '50',
        userAddress: '0x1234567890123456789012345678901234567890',
      });
      expect(txs.length).toBe(1);
      expect(txs[0].description).toContain('Withdraw 50 USDC');
    });

    it('should build borrow transactions', async () => {
      const txs = await aavePlugin.builder.buildTx({
        action: 'borrow',
        protocol: 'aave',
        chain: 'ethereum',
        asset: 'USDC',
        amount: '50',
        userAddress: '0x1234567890123456789012345678901234567890',
      });
      expect(txs.length).toBe(1);
      expect(txs[0].description).toContain('Borrow 50 USDC');
    });

    it('should build repay transactions', async () => {
      const txs = await aavePlugin.builder.buildTx({
        action: 'repay',
        protocol: 'aave',
        chain: 'ethereum',
        asset: 'USDC',
        amount: '100',
        userAddress: '0x1234567890123456789012345678901234567890',
      });
      expect(txs.length).toBe(2);
      expect(txs[0].description).toContain('Approve Aave V3 Pool');
      expect(txs[1].description).toContain('Repay 100 USDC');
    });
  });

  // ─── Health-factor guard (SPECS §6.2 / §19) ─────────────────────────────────
  describe('buildTx health-factor guard', () => {
    const USER = '0x1234567890123456789012345678901234567890';

    // $10,000 collateral, $5,000 debt, 80% liquidation threshold, USDC @ $1 (8-dec base).
    function mockAccount(collateralBase: bigint, debtBase: bigint, ltBps: bigint) {
      mockPublicClient.readContract.mockImplementation(
        async ({ functionName }: { functionName: string }) => {
          if (functionName === 'getUserAccountData') {
            return [collateralBase, debtBase, 0n, ltBps, 0n, 0n];
          }
          if (functionName === 'getAssetPrice') return 100000000n; // $1.00, 8 decimals
          return 0n;
        },
      );
    }

    it('allows a borrow that keeps HF above 1.05', async () => {
      // Borrowing $1,000 more against $10k collateral / $5k debt @ 80% LT → HF ≈ 1.33
      mockAccount(1_000_000_000_000n, 500_000_000_000n, 8000n);
      const txs = await aavePlugin.builder.buildTx({
        action: 'borrow',
        protocol: 'aave',
        chain: 'ethereum',
        asset: 'USDC',
        amount: '1000',
        userAddress: USER,
      });
      expect(txs[0].description).toContain('Borrow 1000 USDC');
    });

    it('refuses a borrow that would drop HF below 1.05', async () => {
      // $10k collateral, $5k debt, 80% LT. Borrowing another $3k → debt $8k → HF = 0.8*10000/8000 = 1.0
      mockAccount(1_000_000_000_000n, 500_000_000_000n, 8000n);
      await expect(
        aavePlugin.builder.buildTx({
          action: 'borrow',
          protocol: 'aave',
          chain: 'ethereum',
          asset: 'USDC',
          amount: '3000',
          userAddress: USER,
        }),
      ).rejects.toThrow(/health factor/i);
    });

    it('refuses a withdraw that would drop HF below 1.05', async () => {
      // Withdrawing $7k of $10k collateral leaves $3k against $5k debt → HF = 0.8*3000/5000 = 0.48
      mockAccount(1_000_000_000_000n, 500_000_000_000n, 8000n);
      await expect(
        aavePlugin.builder.buildTx({
          action: 'withdraw',
          protocol: 'aave',
          chain: 'ethereum',
          asset: 'USDC',
          amount: '7000',
          userAddress: USER,
        }),
      ).rejects.toThrow(/health factor/i);
    });

    it('refuses a max withdraw while debt is open', async () => {
      mockAccount(1_000_000_000_000n, 500_000_000_000n, 8000n);
      await expect(
        aavePlugin.builder.buildTx({
          action: 'withdraw',
          protocol: 'aave',
          chain: 'ethereum',
          asset: 'USDC',
          amount: 'max',
          userAddress: USER,
        }),
      ).rejects.toThrow(/max withdraw/i);
    });

    it('refuses a max borrow while debt is open', async () => {
      // A max borrow carries the uint256-max sentinel, which cannot be projected
      // against the floor — it must be refused, not silently admitted.
      mockAccount(1_000_000_000_000n, 500_000_000_000n, 8000n);
      await expect(
        aavePlugin.builder.buildTx({
          action: 'borrow',
          protocol: 'aave',
          chain: 'ethereum',
          asset: 'USDC',
          amount: 'max',
          userAddress: USER,
        }),
      ).rejects.toThrow(/max borrow/i);
    });

    it('allows a withdraw when the user has no debt', async () => {
      mockAccount(1_000_000_000_000n, 0n, 8000n);
      const txs = await aavePlugin.builder.buildTx({
        action: 'withdraw',
        protocol: 'aave',
        chain: 'ethereum',
        asset: 'USDC',
        amount: '9000',
        userAddress: USER,
      });
      expect(txs[0].description).toContain('Withdraw 9000 USDC');
    });

    it('fails open (allows build) when account data cannot be read', async () => {
      mockPublicClient.readContract.mockRejectedValue(new Error('rpc down'));
      const txs = await aavePlugin.builder.buildTx({
        action: 'borrow',
        protocol: 'aave',
        chain: 'ethereum',
        asset: 'USDC',
        amount: '1000',
        userAddress: USER,
      });
      expect(txs[0].description).toContain('Borrow 1000 USDC');
    });
  });

  describe('projectHealthFactor', () => {
    it('returns Infinity when no debt remains', () => {
      expect(
        projectHealthFactor({
          totalCollateralBase: 1_000_000_000_000n,
          totalDebtBase: 500_000_000_000n,
          liquidationThreshold: 8000n,
          deltaBase: 500_000_000_000n,
          action: 'repay',
        }),
      ).toBe(Infinity);
    });

    it('computes the HF a withdraw would leave', () => {
      // $10k coll, $5k debt, 80% LT, withdraw $2k → coll $8k → HF = 0.8*8000/5000 = 1.28
      const hf = projectHealthFactor({
        totalCollateralBase: 1_000_000_000_000n,
        totalDebtBase: 500_000_000_000n,
        liquidationThreshold: 8000n,
        deltaBase: 200_000_000_000n,
        action: 'withdraw',
      });
      expect(hf).toBeCloseTo(1.28, 2);
    });

    it('computes a correct HF for positions whose base values exceed 2^53', () => {
      // ~$2B collateral / ~$1.5B debt in 8-decimal base — well above Number's
      // 2^53 safe-integer ceiling. The BigInt fixed-point path must still report
      // the exact ratio rather than a precision-mangled one.
      const collateral = 200_000_000_000_000_000n; // $2,000,000,000
      const debt = 150_000_000_000_000_000n; // $1,500,000,000
      const hf = projectHealthFactor({
        totalCollateralBase: collateral,
        totalDebtBase: debt,
        liquidationThreshold: 8000n,
        deltaBase: 0n,
        action: 'borrow',
      });
      // HF = (2e9 * 0.8) / 1.5e9 = 1.0667
      expect(hf).toBeCloseTo(1.0667, 3);
    });

    it('exposes the 1.05 floor constant', () => {
      expect(MIN_HEALTH_FACTOR).toBe(1.05);
    });
  });

  describe('rewards.fetchRewards', () => {
    it('should return empty array when user holds no aTokens', async () => {
      // getUserAccountData → no positions
      mockPublicClient.readContract.mockImplementation(
        async ({ functionName }: { functionName: string }) => {
          if (functionName === 'getReserveData') {
            return Object.assign(
              [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, '0xAToken', '0x', '0x', '0x'],
              {
                aTokenAddress: '0xAToken',
              },
            );
          }
          if (functionName === 'balanceOf') return 0n;
          return [];
        },
      );

      const rewards = await aavePlugin.rewards!.fetchRewards(
        '0x1234567890123456789012345678901234567890',
        'ethereum',
      );
      expect(rewards).toEqual([]);
    });

    it('should return reward entries when user has aToken balance and claimable rewards', async () => {
      const USER = '0x1234567890123456789012345678901234567890';
      const ATOKEN = '0x1111111111111111111111111111111111111111';
      const REWARD_TOKEN = '0x2222222222222222222222222222222222222222';

      mockPublicClient.readContract.mockImplementation(
        async ({ functionName, address }: { functionName: string; address: string }) => {
          if (functionName === 'getReserveData') {
            return Object.assign(
              [
                0n,
                0n,
                0n,
                0n,
                0n,
                0n,
                0n,
                0n,
                0n,
                ATOKEN,
                '0x0000000000000000000000000000000000000000',
                '0x0000000000000000000000000000000000000000',
                '0x0000000000000000000000000000000000000000',
              ],
              {
                aTokenAddress: ATOKEN,
              },
            );
          }
          if (functionName === 'balanceOf') {
            if (address === ATOKEN) return 1000000000n; // user holds aTokens
            return 0n;
          }
          if (functionName === 'getRewardsByAsset') return [REWARD_TOKEN];
          if (functionName === 'getUserRewards') return 5000000000000000000n; // 5 tokens (18 dec)
          return 0n;
        },
      );

      vi.mocked(fetchTokenPrices).mockResolvedValue({ 'coingecko:usd-coin': 1.0 });

      const rewards = await aavePlugin.rewards!.fetchRewards(USER, 'ethereum');
      expect(rewards.length).toBeGreaterThan(0);
      expect(Number(rewards[0].amount)).toBeGreaterThan(0);
    });
  });

  describe('rewards.buildClaimTx', () => {
    it('should build a claimAllRewards transaction targeting the RewardsController', async () => {
      const USER = '0x1234567890123456789012345678901234567890';
      const ATOKEN = '0x1111111111111111111111111111111111111111';

      mockPublicClient.readContract.mockImplementation(
        async ({ functionName, address }: { functionName: string; address: string }) => {
          if (functionName === 'getReserveData') {
            return Object.assign(
              [
                0n,
                0n,
                0n,
                0n,
                0n,
                0n,
                0n,
                0n,
                0n,
                ATOKEN,
                '0x0000000000000000000000000000000000000000',
                '0x0000000000000000000000000000000000000000',
                '0x0000000000000000000000000000000000000000',
              ],
              {
                aTokenAddress: ATOKEN,
              },
            );
          }
          if (functionName === 'balanceOf') {
            return address === ATOKEN ? 1000000n : 0n;
          }
          return 0n;
        },
      );

      const txs = await aavePlugin.rewards!.buildClaimTx({ address: USER, chain: 'ethereum' });
      expect(txs.length).toBe(1);
      expect(txs[0].to).toBe('0x8164Cc65827dcFe994AB23944CBC90e0aa80bFcb');
      expect(txs[0].description).toContain('Claim all Aave V3 rewards');
    });

    it('should return empty array when user holds no aTokens (nothing to claim)', async () => {
      mockPublicClient.readContract.mockImplementation(
        async ({ functionName }: { functionName: string }) => {
          if (functionName === 'getReserveData') {
            return Object.assign(
              [
                0n,
                0n,
                0n,
                0n,
                0n,
                0n,
                0n,
                0n,
                0n,
                '0x1111111111111111111111111111111111111111',
                '0x0000000000000000000000000000000000000000',
                '0x0000000000000000000000000000000000000000',
                '0x0000000000000000000000000000000000000000',
              ],
              {
                aTokenAddress: '0x1111111111111111111111111111111111111111',
              },
            );
          }
          return 0n;
        },
      );

      const txs = await aavePlugin.rewards!.buildClaimTx({
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
      });
      // With 0 aToken balance, aTokenAddresses will be empty → claimAllRewards with empty array
      // The tx is still built (controller call with empty assets[])
      expect(txs.length).toBe(1);
      expect(txs[0].to.toLowerCase()).toContain('0x8164');
    });

    it('should throw for unsupported chain (solana)', async () => {
      await expect(
        aavePlugin.rewards!.buildClaimTx({ address: '0x123', chain: 'solana' }),
      ).rejects.toThrow('not available on solana');
    });
  });
});

// ─── Euler RewardFetcher ──────────────────────────────────────────────────────

describe('Euler V2 Protocol Plugin', () => {
  const mockPublicClient = { readContract: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPublicClient).mockReturnValue(
      mockPublicClient as unknown as ReturnType<typeof getPublicClient>,
    );
    vi.mocked(fetchMerklClaims).mockResolvedValue([]);
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ coins: {} }),
    } as unknown as Response);
  });

  describe('fetchPositions', () => {
    it('should fetch supply and borrow positions correctly', async () => {
      mockPublicClient.readContract.mockImplementation(
        async ({ functionName, address }: { functionName: string; address: string }) => {
          if (functionName === 'balanceOf' && address === EULER_CURATED_VAULTS.USDC)
            return 1000000000n;
          if (functionName === 'convertToAssets') return 1000000000n;
          if (functionName === 'debtOf' && address === EULER_CURATED_VAULTS.USDC) return 500000000n;
          return 0n;
        },
      );

      const positions = await eulerPlugin.fetcher.fetchPositions(
        '0x1234567890123456789012345678901234567890',
        'ethereum',
      );
      const supplyPos = positions.find((p) => p.positionType === 'supply');
      const borrowPos = positions.find((p) => p.positionType === 'borrow');

      expect(supplyPos).toBeDefined();
      expect(supplyPos?.asset).toBe('USDC');
      expect(supplyPos?.amount).toBe(1000);

      expect(borrowPos).toBeDefined();
      expect(borrowPos?.asset).toBe('USDC');
      expect(borrowPos?.amount).toBe(500);
    });
  });

  describe('buildTx', () => {
    it('should build supply transactions', async () => {
      const txs = await eulerPlugin.builder.buildTx({
        action: 'supply',
        protocol: 'euler',
        chain: 'ethereum',
        asset: 'USDC',
        amount: '100',
        userAddress: '0x1234567890123456789012345678901234567890',
      });
      expect(txs.length).toBe(2);
      expect(txs[0].description).toContain('Approve Euler EVault');
      expect(txs[1].description).toContain('Supply 100 USDC');
    });

    it('should build withdraw transactions', async () => {
      const txs = await eulerPlugin.builder.buildTx({
        action: 'withdraw',
        protocol: 'euler',
        chain: 'ethereum',
        asset: 'USDC',
        amount: '50',
        userAddress: '0x1234567890123456789012345678901234567890',
      });
      expect(txs.length).toBe(1);
      expect(txs[0].description).toContain('Withdraw 50 USDC');
    });

    it('should build borrow transactions', async () => {
      const txs = await eulerPlugin.builder.buildTx({
        action: 'borrow',
        protocol: 'euler',
        chain: 'ethereum',
        asset: 'USDC',
        amount: '50',
        userAddress: '0x1234567890123456789012345678901234567890',
      });
      expect(txs.length).toBe(1);
      expect(txs[0].description).toContain('Borrow 50 USDC');
    });

    it('should build repay transactions', async () => {
      const txs = await eulerPlugin.builder.buildTx({
        action: 'repay',
        protocol: 'euler',
        chain: 'ethereum',
        asset: 'USDC',
        amount: '100',
        userAddress: '0x1234567890123456789012345678901234567890',
      });
      expect(txs.length).toBe(2);
      expect(txs[0].description).toContain('Approve Euler EVault');
      expect(txs[1].description).toContain('Repay 100 USDC');
    });
  });

  describe('rewards.fetchRewards', () => {
    it('should return empty when no Merkl claims', async () => {
      vi.mocked(fetchMerklClaims).mockResolvedValue([]);
      const rewards = await eulerPlugin.rewards!.fetchRewards(
        '0x1234567890123456789012345678901234567890',
        'ethereum',
      );
      expect(rewards).toEqual([]);
    });

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
      ]);
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          coins: { 'ethereum:0x3333333333333333333333333333333333333333': { price: 5.0 } },
        }),
      } as unknown as Response);

      const rewards = await eulerPlugin.rewards!.fetchRewards(
        '0x1234567890123456789012345678901234567890',
        'ethereum',
      );
      expect(rewards.length).toBe(1);
      expect(rewards[0].token).toBe('EUL');
      expect(rewards[0].amountUsd).toBeCloseTo(50, 0); // 10 EUL * $5
    });
  });

  describe('rewards.buildClaimTx', () => {
    it('should return empty array when no Merkl claims exist', async () => {
      vi.mocked(fetchMerklClaims).mockResolvedValue([]);
      const txs = await eulerPlugin.rewards!.buildClaimTx({
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
      });
      expect(txs).toEqual([]);
    });

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
      ]);

      const txs = await eulerPlugin.rewards!.buildClaimTx({
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
      });
      expect(txs.length).toBe(1);
      expect(txs[0].to).toBe('0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae');
      expect(txs[0].description).toContain('Claim Euler rewards');
    });

    it('should throw for unsupported chain', async () => {
      await expect(
        eulerPlugin.rewards!.buildClaimTx({ address: '0x123', chain: 'solana' }),
      ).rejects.toThrow('not supported on solana');
    });
  });
});

// ─── Morpho RewardFetcher ─────────────────────────────────────────────────────

describe('Morpho Protocol Plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchMerklClaims).mockResolvedValue([]);
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ coins: {} }),
    } as unknown as Response);
  });

  describe('fetchPositions', () => {
    it('maps MetaMorpho vault positions into supply positions', async () => {
      const { fetchMorphoVaultPositions } = await import('@/lib/data/morphoApi');
      vi.mocked(fetchMorphoVaultPositions).mockResolvedValueOnce([
        {
          vaultAddress: '0xVault1',
          vaultName: 'Gauntlet USDC Core',
          assetAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          assetSymbol: 'USDC',
          assetDecimals: 6,
          assets: '5000000000', // 5,000 USDC
          assetsUsd: 5000,
          assetPriceUsd: 1,
          shares: '4999000000',
          netApy: 0.068,
        },
      ]);

      const positions = await morphoPlugin.fetcher.fetchPositions(
        '0x1234567890123456789012345678901234567890',
        'ethereum',
      );
      expect(positions.length).toBe(1);
      expect(positions[0].positionType).toBe('supply');
      expect(positions[0].asset).toBe('USDC');
      expect(positions[0].amount).toBe(5000);
      expect(positions[0].amountUsd).toBe(5000);
      expect(positions[0].currentApy).toBe(0.068);
      expect(positions[0].metadata.vaultAddress).toBe('0xVault1');
    });

    it('derives amountUsd from the spot price when assetsUsd is null (never the token count)', async () => {
      const { fetchMorphoVaultPositions } = await import('@/lib/data/morphoApi');
      vi.mocked(fetchMorphoVaultPositions).mockResolvedValueOnce([
        {
          vaultAddress: '0xVaultWBTC',
          vaultName: 'WBTC Vault',
          assetAddress: '0xBtc',
          assetSymbol: 'WBTC',
          assetDecimals: 8,
          assets: '50000000', // 0.5 WBTC
          assetsUsd: null,
          assetPriceUsd: 60000,
          shares: '50000000',
          netApy: 0.01,
        },
      ]);

      const positions = await morphoPlugin.fetcher.fetchPositions('0x123', 'ethereum');
      expect(positions[0].amount).toBe(0.5);
      // 0.5 WBTC * $60k — NOT the raw 0.5 token count.
      expect(positions[0].amountUsd).toBe(30000);
    });

    it('reports $0 (not the token count) when no USD valuation is available', async () => {
      const { fetchMorphoVaultPositions } = await import('@/lib/data/morphoApi');
      vi.mocked(fetchMorphoVaultPositions).mockResolvedValueOnce([
        {
          vaultAddress: '0xVaultWBTC',
          vaultName: 'WBTC Vault',
          assetAddress: '0xBtc',
          assetSymbol: 'WBTC',
          assetDecimals: 8,
          assets: '50000000', // 0.5 WBTC
          assetsUsd: null,
          assetPriceUsd: null,
          shares: '50000000',
          netApy: 0.01,
        },
      ]);

      const positions = await morphoPlugin.fetcher.fetchPositions('0x123', 'ethereum');
      expect(positions[0].amountUsd).toBe(0);
    });

    it('skips zero-balance vault positions', async () => {
      const { fetchMorphoVaultPositions } = await import('@/lib/data/morphoApi');
      vi.mocked(fetchMorphoVaultPositions).mockResolvedValueOnce([
        {
          vaultAddress: '0xVault1',
          vaultName: 'V',
          assetAddress: '0xA',
          assetSymbol: 'USDC',
          assetDecimals: 6,
          assets: '0',
          assetsUsd: 0,
          assetPriceUsd: 1,
          shares: '0',
          netApy: 0.05,
        },
      ]);
      const positions = await morphoPlugin.fetcher.fetchPositions('0x123', 'ethereum');
      expect(positions).toEqual([]);
    });
  });

  describe('buildTx', () => {
    const USER = '0x1234567890123456789012345678901234567890';
    const VAULT = '0x1111111111111111111111111111111111111111';

    it('builds approve + deposit for supply', async () => {
      const txs = await morphoPlugin.builder.buildTx({
        action: 'supply',
        protocol: 'morpho',
        chain: 'ethereum',
        asset: 'USDC',
        amount: '100',
        userAddress: USER,
        extraParams: { vaultAddress: VAULT },
      });
      expect(txs.length).toBe(2);
      expect(txs[0].description).toContain('Approve Morpho vault');
      expect(txs[1].description).toContain('Supply 100 USDC');
      expect(txs[1].to).toBe(VAULT);
    });

    it('builds a withdraw', async () => {
      const txs = await morphoPlugin.builder.buildTx({
        action: 'withdraw',
        protocol: 'morpho',
        chain: 'ethereum',
        asset: 'USDC',
        amount: '50',
        userAddress: USER,
        extraParams: { vaultAddress: VAULT },
      });
      expect(txs.length).toBe(1);
      expect(txs[0].description).toContain('Withdraw 50 USDC');
    });

    it('throws when no vault address is provided', async () => {
      await expect(
        morphoPlugin.builder.buildTx({
          action: 'supply',
          protocol: 'morpho',
          chain: 'ethereum',
          asset: 'USDC',
          amount: '100',
          userAddress: USER,
        }),
      ).rejects.toThrow(/vaultAddress/);
    });
  });

  describe('rewards.fetchRewards', () => {
    it('should return empty when no Merkl claims', async () => {
      const rewards = await morphoPlugin.rewards!.fetchRewards(
        '0x1234567890123456789012345678901234567890',
        'ethereum',
      );
      expect(rewards).toEqual([]);
    });

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
      ]);
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          coins: { 'ethereum:0x5555555555555555555555555555555555555555': { price: 1.5 } },
        }),
      } as unknown as Response);

      const rewards = await morphoPlugin.rewards!.fetchRewards(
        '0x1234567890123456789012345678901234567890',
        'ethereum',
      );
      expect(rewards.length).toBe(1);
      expect(rewards[0].token).toBe('MORPHO');
      expect(rewards[0].amountUsd).toBeCloseTo(3.0, 1);
    });
  });

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
      ]);

      const txs = await morphoPlugin.rewards!.buildClaimTx({
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
      });
      expect(txs.length).toBe(1);
      expect(txs[0].to).toBe('0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae');
      expect(txs[0].description).toContain('Morpho');
      expect(txs[0].chainId).toBe(1);
    });

    it('should return empty array when no claims exist', async () => {
      vi.mocked(fetchMerklClaims).mockResolvedValue([]);
      const txs = await morphoPlugin.rewards!.buildClaimTx({
        address: '0x1234567890123456789012345678901234567890',
        chain: 'base',
      });
      expect(txs).toEqual([]);
    });
  });
});

// ─── Pendle RewardFetcher ─────────────────────────────────────────────────────

describe('Pendle Protocol Plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchPositions', () => {
    it('returns empty when chain unsupported (base)', async () => {
      const positions = await pendlePlugin.fetcher.fetchPositions('0x123', 'base');
      expect(positions).toEqual([]);
    });

    it('maps YT balances into pendle-yt positions', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          balances: [
            {
              ytBalance: 2.5,
              marketAddress: '0xMarket',
              ytAddress: '0xYT',
              underlyingAsset: 'eETH',
              pendingYield: { amountUsd: 12.5 },
            },
          ],
        }),
      } as unknown as Response);

      const positions = await pendlePlugin.fetcher.fetchPositions(
        '0x1234567890123456789012345678901234567890',
        'ethereum',
      );
      expect(positions.length).toBe(1);
      expect(positions[0].positionType).toBe('pendle-yt');
      expect(positions[0].amount).toBe(2.5);
      expect(positions[0].metadata.marketAddress).toBe('0xMarket');
    });
  });

  describe('buildTx', () => {
    const USER = '0x1234567890123456789012345678901234567890';
    const PT = '0x2222222222222222222222222222222222222222';

    it('builds a redeem tx from the Pendle Convert API', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          tx: { to: '0xRouter', data: '0xdeadbeef', value: '0' },
          data: { amountOut: '999' },
        }),
      } as unknown as Response);

      const txs = await pendlePlugin.builder.buildTx({
        action: 'withdraw',
        protocol: 'pendle',
        chain: 'ethereum',
        asset: 'USDC',
        amount: '1000000',
        userAddress: USER,
        extraParams: { tokenIn: PT, isWei: true },
      });
      expect(txs.length).toBe(1);
      expect(txs[0].to).toBe('0xRouter');
      expect(txs[0].data).toBe('0xdeadbeef');
      expect(txs[0].description).toContain('Redeem');
    });

    it('scales a non-wei amount by the INPUT token decimals, not the output', async () => {
      const fetchMock = vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          tx: { to: '0xRouter', data: '0xdeadbeef', value: '0' },
          data: { amountOut: '999' },
        }),
      } as unknown as Response);

      // Input asset USDC (6 decimals); output underlying WETH (18 decimals).
      // 1 USDC must scale to 1e6 — scaling by the output's 18 decimals (the old
      // bug) would send 1e18, a 1e12× over-size.
      await pendlePlugin.builder.buildTx({
        action: 'withdraw',
        protocol: 'pendle',
        chain: 'ethereum',
        asset: 'USDC',
        amount: '1',
        userAddress: USER,
        extraParams: { tokenIn: PT, underlyingAsset: 'WETH', isWei: false },
      });

      const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
      expect(calledUrl).toContain('amountsIn=1000000');
    });

    it('refuses a non-wei amount when input-token decimals are indeterminate', async () => {
      // PT symbol absent from the registry + no tokenInDecimals override + non-wei:
      // we must refuse rather than guess 18 and silently mis-size a non-18 token.
      await expect(
        pendlePlugin.builder.buildTx({
          action: 'withdraw',
          protocol: 'pendle',
          chain: 'ethereum',
          asset: 'PT-UNKNOWN',
          amount: '1',
          userAddress: USER,
          extraParams: { tokenIn: PT, underlyingAsset: 'WETH', isWei: false },
        }),
      ).rejects.toThrow(/input-token decimals/i);
    });

    it('throws when tokenIn is missing', async () => {
      await expect(
        pendlePlugin.builder.buildTx({
          action: 'withdraw',
          protocol: 'pendle',
          chain: 'ethereum',
          asset: 'USDC',
          amount: '1000000',
          userAddress: USER,
          extraParams: { isWei: true },
        }),
      ).rejects.toThrow(/tokenIn/);
    });

    it('throws for an unsupported chain', async () => {
      await expect(
        pendlePlugin.builder.buildTx({
          action: 'withdraw',
          protocol: 'pendle',
          chain: 'base',
          asset: 'USDC',
          amount: '100',
          userAddress: USER,
          extraParams: { tokenIn: PT },
        }),
      ).rejects.toThrow(/not supported/);
    });
  });

  describe('rewards.fetchRewards', () => {
    it('should return empty when chain not supported (base)', async () => {
      const rewards = await pendlePlugin.rewards!.fetchRewards(
        '0x1234567890123456789012345678901234567890',
        'base',
      );
      expect(rewards).toEqual([]);
    });

    it('should return empty when Pendle API returns no positions with pending yield', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ balances: [] }),
      } as unknown as Response);

      const rewards = await pendlePlugin.rewards!.fetchRewards(
        '0x1234567890123456789012345678901234567890',
        'ethereum',
      );
      expect(rewards).toEqual([]);
    });

    it('should return rewards when Pendle API reports pending yields', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
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
      } as unknown as Response);

      const rewards = await pendlePlugin.rewards!.fetchRewards(
        '0x1234567890123456789012345678901234567890',
        'ethereum',
      );
      expect(rewards.length).toBe(1);
      expect(rewards[0].token).toBe('eETH');
      expect(rewards[0].amountUsd).toBe(150.0);
    });
  });

  describe('rewards.buildClaimTx', () => {
    it('should return empty when chain not supported', async () => {
      await expect(
        pendlePlugin.rewards!.buildClaimTx({ address: '0x123', chain: 'base' }),
      ).rejects.toThrow('not supported on base');
    });

    it('should build redeemDueInterestAndRewards transactions for each YT market', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
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
      } as unknown as Response);

      const txs = await pendlePlugin.rewards!.buildClaimTx({
        address: '0x1234567890123456789012345678901234567890',
        chain: 'ethereum',
      });
      expect(txs.length).toBe(1);
      expect(txs[0].to).toBe('0xYTAddress1');
      expect(txs[0].description).toContain('Claim Pendle YT');
      expect(txs[0].chainId).toBe(1);
    });
  });
});
