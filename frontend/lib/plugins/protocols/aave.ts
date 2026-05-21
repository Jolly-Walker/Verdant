import { ProtocolPlugin, RewardFetcher, ClaimParams } from '../types/protocol-plugin'
import { ChainId, RawPosition, UnsignedTx, TxBuildParams, Reward } from '@/types/shared'
import { SUPPORTED_TOKENS } from '@/constants/tokens'
import { getPublicClient } from '@/lib/server/rpc'
import { fetchTokenPrices } from '@/lib/data/prices'
import { fetchAaveUserData } from '@/lib/data/aaveSubgraph'
import { encodeFunctionData } from 'viem'

const AAVE_POOL_ABI = [
  {
    name: 'getUserAccountData',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'totalCollateralBase', type: 'uint256' },
      { name: 'totalDebtBase', type: 'uint256' },
      { name: 'availableBorrowsBase', type: 'uint256' },
      { name: 'currentLiquidationThreshold', type: 'uint256' },
      { name: 'ltv', type: 'uint256' },
      { name: 'healthFactor', type: 'uint256' },
    ],
  },
  {
    name: 'getReserveData',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'asset', type: 'address' }],
    outputs: [
      { name: 'configuration', type: 'uint256' },
      { name: 'liquidityIndex', type: 'uint128' },
      { name: 'currentLiquidationThreshold', type: 'uint128' },
      { name: 'variableBorrowIndex', type: 'uint128' },
      { name: 'currentLiquidityRate', type: 'uint128' },
      { name: 'currentVariableBorrowRate', type: 'uint128' },
      { name: 'currentStableBorrowRate', type: 'uint128' },
      { name: 'lastUpdateTimestamp', type: 'uint40' },
      { name: 'id', type: 'uint16' },
      { name: 'aTokenAddress', type: 'address' },
      { name: 'stableDebtTokenAddress', type: 'address' },
      { name: 'variableDebtTokenAddress', type: 'address' },
      { name: 'interestRateStrategyAddress', type: 'address' },
    ],
  },
  {
    name: 'supply',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'onBehalfOf', type: 'address' },
      { name: 'referralCode', type: 'uint16' },
    ],
    outputs: [],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'borrow',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'interestRateMode', type: 'uint256' },
      { name: 'referralCode', type: 'uint16' },
      { name: 'onBehalfOf', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'repay',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'interestRateMode', type: 'uint256' },
      { name: 'onBehalfOf', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const

/**
 * Aave V3 RewardsController ABI (subset used for reward fetching and claiming).
 * Source: https://github.com/bgd-labs/aave-address-book
 */
const AAVE_REWARDS_CONTROLLER_ABI = [
  {
    name: 'getRewardsByAsset',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'asset', type: 'address' }],
    outputs: [{ type: 'address[]' }],
  },
  {
    name: 'getUserRewards',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'assets', type: 'address[]' },
      { name: 'user', type: 'address' },
      { name: 'reward', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getUserAssetIndex',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'asset', type: 'address' },
      { name: 'reward', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'claimAllRewards',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'address[]' },
      { name: 'to', type: 'address' },
    ],
    outputs: [
      { name: 'rewardsList', type: 'address[]' },
      { name: 'claimedAmounts', type: 'uint256[]' },
    ],
  },
  {
    name: 'getRewardsData',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'reward', type: 'address' },
    ],
    outputs: [
      { name: 'index', type: 'uint256' },
      { name: 'distributionEnd', type: 'uint256' },
      { name: 'emissionPerSecond', type: 'uint256' },
      { name: 'lastUpdateTimestamp', type: 'uint256' },
    ],
  },
] as const

/**
 * Aave V3 RewardsController proxy addresses per chain.
 * Source: https://github.com/bgd-labs/aave-address-book
 */
const AAVE_REWARDS_CONTROLLER: Partial<Record<ChainId, string>> = {
  ethereum: '0x8164Cc65827dcFe994AB23944CBC90e0aa80bFcb',
  arbitrum: '0x929EC64c34a17401F460460D4B9390518E5B473e',
  base: '0x98820eb0f4641958c27B1E76cd4c66FCC6a9B6Ca',
}

/**
 * Minimum claimable USD value to surface a reward to the user.
 * Prevents noisy sub-cent rewards from showing up.
 */
const MIN_REWARD_USD = 0.01

export const aavePlugin: ProtocolPlugin = {
  id: 'aave',
  displayName: 'Aave V3',
  supportedChains: ['ethereum', 'arbitrum', 'base'],
  supportedPositionTypes: ['supply', 'borrow'],
  defillamaSlug: 'aave-v3',
  addresses: {
    ethereum: { poolAddress: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2' },
    arbitrum: { poolAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD' },
    base: { poolAddress: '0xA238Dd80C2596972E0670346274589599170D65d' },
  },
  fetcher: {
    fetchPositions: async (address: string, chain: ChainId): Promise<RawPosition[]> => {
      const poolAddress = aavePlugin.addresses[chain]?.poolAddress
      if (!poolAddress) return []

      const client = getPublicClient(chain)
      const positions: RawPosition[] = []

      try {
        // 1. Try to fetch from subgraph first for richer data (e.g. per-reserve collateral status)
        const subgraphData = await fetchAaveUserData(address, chain)
        
        if (subgraphData?.user) {
          const user = subgraphData.user
          const healthFactor = Number(user.healthFactor) / 1e18
          
          const tokensToQuery = Object.values(SUPPORTED_TOKENS).filter(t => t.addresses[chain])
          const priceIds = tokensToQuery.map(t => `coingecko:${t.coingeckoId}`)
          const priceMap = await fetchTokenPrices(priceIds).catch(() => ({} as Record<string, number>))

          for (const userReserve of user.userReserves) {
            const assetAddress = userReserve.reserve.underlyingAsset.toLowerCase()
            const token = Object.values(SUPPORTED_TOKENS).find(
              t => t.addresses[chain]?.toLowerCase() === assetAddress
            )
            
            if (!token) continue

            const price = priceMap[`coingecko:${token.coingeckoId}`] || 0
            const aTokenBalance = BigInt(userReserve.currentATokenBalance)
            const variableDebt = BigInt(userReserve.currentVariableDebt)
            const isCollateral = userReserve.usageAsCollateralEnabledOnUser

            // Still need APY from RPC as subgraph might be slightly delayed or not have latest rates
            let supplyApy = 0
            let borrowApy = 0
            let aTokenAddress = ''
            let variableDebtTokenAddress = ''

            try {
              const result = await client.readContract({
                address: poolAddress as `0x${string}`,
                abi: AAVE_POOL_ABI,
                functionName: 'getReserveData',
                args: [assetAddress as `0x${string}`],
              })
              supplyApy = Number(result.currentLiquidityRate) / 1e27
              borrowApy = Number(result.currentVariableBorrowRate) / 1e27
              aTokenAddress = result.aTokenAddress
              variableDebtTokenAddress = result.variableDebtTokenAddress
            } catch (e) {
              console.error(`Failed to get Aave rates for ${token.symbol} on ${chain}:`, e)
            }

            if (aTokenBalance > 0n) {
              const amount = Number(aTokenBalance) / Math.pow(10, token.decimals)
              positions.push({
                id: `aave-supply-${chain}-${token.symbol}`,
                protocol: 'aave',
                chain,
                asset: token.symbol,
                assetAddress: token.addresses[chain]!,
                amount,
                amountUsd: amount * price,
                currentApy: supplyApy,
                positionType: 'supply',
                claimableRewards: [],
                metadata: { 
                  aTokenAddress,
                  healthFactor,
                  isCollateral
                }
              })
            }

            if (variableDebt > 0n) {
              const amount = Number(variableDebt) / Math.pow(10, token.decimals)
              positions.push({
                id: `aave-borrow-${chain}-${token.symbol}`,
                protocol: 'aave',
                chain,
                asset: token.symbol,
                assetAddress: token.addresses[chain]!,
                amount,
                amountUsd: amount * price,
                currentApy: borrowApy,
                positionType: 'borrow',
                claimableRewards: [],
                metadata: { 
                  variableDebtTokenAddress,
                  healthFactor
                }
              })
            }
          }
          
          if (positions.length > 0) return positions
        }

        // 2. Fallback to RPC if subgraph fails or returns no user
        const accountData = await client.readContract({
          address: poolAddress as `0x${string}`,
          abi: AAVE_POOL_ABI,
          functionName: 'getUserAccountData',
          args: [address as `0x${string}`],
        })

        const { totalCollateralBase, totalDebtBase, healthFactor: hfBigInt } = accountData
        const healthFactor = Number(hfBigInt) / 1e18

        // If both are zero, the user has no positions on this Aave market.
        if (totalCollateralBase === 0n && totalDebtBase === 0n) {
          return []
        }

        // Query reserve data and balances for all supported tokens that have an address on this chain
        const tokensToQuery = Object.values(SUPPORTED_TOKENS).filter(t => t.addresses[chain])

        // Fetch prices in parallel
        const priceIds = tokensToQuery.map(t => `coingecko:${t.coingeckoId}`)
        const priceMap = await fetchTokenPrices(priceIds).catch(() => ({} as Record<string, number>))

        const balancePromises = tokensToQuery.map(async (token) => {
          const tokenPositions: RawPosition[] = []
          try {
            const result = await client.readContract({
              address: poolAddress as `0x${string}`,
              abi: AAVE_POOL_ABI,
              functionName: 'getReserveData',
              args: [token.addresses[chain] as `0x${string}`],
            })

            const { aTokenAddress, variableDebtTokenAddress, currentLiquidityRate, currentVariableBorrowRate } = result

            const supplyApy = Number(currentLiquidityRate) / 1e27
            const borrowApy = Number(currentVariableBorrowRate) / 1e27
            const price = priceMap[`coingecko:${token.coingeckoId}`] || 0

            // Check supply balance
            const aTokenBalance = await client.readContract({
              address: aTokenAddress as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [address as `0x${string}`],
            })

            if (aTokenBalance > 0n) {
              const amount = Number(aTokenBalance) / Math.pow(10, token.decimals)
              tokenPositions.push({
                id: `aave-supply-${chain}-${token.symbol}`,
                protocol: 'aave',
                chain,
                asset: token.symbol,
                assetAddress: token.addresses[chain]!,
                amount,
                amountUsd: amount * price,
                currentApy: supplyApy,
                positionType: 'supply',
                claimableRewards: [],
                metadata: { aTokenAddress, healthFactor }
              })
            }

            // Check borrow balance
            const debtBalance = await client.readContract({
              address: variableDebtTokenAddress as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [address as `0x${string}`],
            })

            if (debtBalance > 0n) {
              const amount = Number(debtBalance) / Math.pow(10, token.decimals)
              tokenPositions.push({
                id: `aave-borrow-${chain}-${token.symbol}`,
                protocol: 'aave',
                chain,
                asset: token.symbol,
                assetAddress: token.addresses[chain]!,
                amount,
                amountUsd: amount * price,
                currentApy: borrowApy,
                positionType: 'borrow',
                claimableRewards: [],
                metadata: { variableDebtTokenAddress, healthFactor }
              })
            }
          } catch (e) {
            console.error(`Failed to get Aave details for ${token.symbol} on ${chain}:`, e)
          }
          return tokenPositions
        })

        const balanceResults = await Promise.all(balancePromises)
        for (const res of balanceResults) {
          positions.push(...res)
        }
      } catch (e) {
        console.error('Error fetching Aave positions:', e)
      }

      return positions
    },
  },
  builder: {
    buildTx: async (params: TxBuildParams): Promise<UnsignedTx[]> => {
      const { action, chain, asset, amount, userAddress } = params
      const poolAddress = aavePlugin.addresses[chain]?.poolAddress
      if (!poolAddress) throw new Error(`Aave pool address not found for chain ${chain}`)

      const tokenConfig = SUPPORTED_TOKENS[asset]
      if (!tokenConfig) throw new Error(`Token config not found for asset ${asset}`)

      const assetAddress = tokenConfig.addresses[chain]
      if (!assetAddress) throw new Error(`Token address not found for asset ${asset} on chain ${chain}`)

      const decimals = tokenConfig.decimals
      const isMax = amount === 'max'
      const isWei = params.extraParams?.isWei === true
      const amountBigInt = isMax 
        ? 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn 
        : isWei 
          ? BigInt(amount)
          : BigInt(Math.floor(Number(amount) * Math.pow(10, decimals)))

      const chainMap: Record<ChainId, number> = {
        ethereum: 1,
        arbitrum: 42161,
        base: 8453,
        solana: 0,
      }
      const chainId = chainMap[chain]

      const txs: UnsignedTx[] = []

      if (action === 'supply') {
        // 1. Approve
        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [poolAddress as `0x${string}`, amountBigInt],
        })
        txs.push({
          chainId,
          to: assetAddress,
          data: approveData,
          value: 0n,
          description: `Approve Aave V3 Pool to spend ${amount} ${asset}`,
        })

        // 2. Supply
        const supplyData = encodeFunctionData({
          abi: AAVE_POOL_ABI,
          functionName: 'supply',
          args: [assetAddress as `0x${string}`, amountBigInt, userAddress as `0x${string}`, 0],
        })
        txs.push({
          chainId,
          to: poolAddress,
          data: supplyData,
          value: 0n,
          description: `Supply ${amount} ${asset} to Aave V3`,
        })
      } else if (action === 'withdraw') {
        const withdrawData = encodeFunctionData({
          abi: AAVE_POOL_ABI,
          functionName: 'withdraw',
          args: [assetAddress as `0x${string}`, amountBigInt, userAddress as `0x${string}`],
        })
        txs.push({
          chainId,
          to: poolAddress,
          data: withdrawData,
          value: 0n,
          description: `Withdraw ${isMax ? 'all' : `${amount} ${asset}`} from Aave V3`,
        })
      } else if (action === 'borrow') {
        const borrowData = encodeFunctionData({
          abi: AAVE_POOL_ABI,
          functionName: 'borrow',
          args: [assetAddress as `0x${string}`, amountBigInt, 2n, 0, userAddress as `0x${string}`],
        })
        txs.push({
          chainId,
          to: poolAddress,
          data: borrowData,
          value: 0n,
          description: `Borrow ${amount} ${asset} from Aave V3`,
        })
      } else if (action === 'repay') {
        // 1. Approve
        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [poolAddress as `0x${string}`, amountBigInt],
        })
        txs.push({
          chainId,
          to: assetAddress,
          data: approveData,
          value: 0n,
          description: `Approve Aave V3 Pool to spend ${isMax ? 'unlimited' : `${amount} ${asset}`}`,
        })

        // 2. Repay
        const repayData = encodeFunctionData({
          abi: AAVE_POOL_ABI,
          functionName: 'repay',
          args: [assetAddress as `0x${string}`, amountBigInt, 2n, userAddress as `0x${string}`],
        })
        txs.push({
          chainId,
          to: poolAddress,
          data: repayData,
          value: 0n,
          description: `Repay ${isMax ? 'all' : `${amount} ${asset}`} borrow position on Aave V3`,
        })
      } else {
        throw new Error(`Unsupported action ${action} on Aave V3 plugin`)
      }

      return txs
    },
    describeAction: (params: TxBuildParams) => {
      const { action, amount, asset } = params
      if (action === 'supply') return `Supply ${amount} ${asset} to Aave V3`
      if (action === 'withdraw') return `Withdraw ${amount === 'max' ? 'all' : `${amount} ${asset}`} from Aave V3`
      if (action === 'borrow') return `Borrow ${amount} ${asset} from Aave V3`
      if (action === 'repay') return `Repay ${amount === 'max' ? 'all' : `${amount} ${asset}`} borrow position on Aave V3`
      return `Aave V3 Action`
    },
  },
  rewards: {
    fetchRewards: async (address: string, chain: ChainId): Promise<Reward[]> => {
      const rewardsController = AAVE_REWARDS_CONTROLLER[chain]
      const poolAddress = aavePlugin.addresses[chain]?.poolAddress
      if (!rewardsController || !poolAddress) return []

      const client = getPublicClient(chain)
      const rewards: Reward[] = []

      try {
        // Collect all aToken addresses the user might hold
        const tokensToQuery = Object.values(SUPPORTED_TOKENS).filter(t => t.addresses[chain])
        const aTokenAddresses: string[] = []

        await Promise.all(
          tokensToQuery.map(async (token) => {
            try {
              const result = await client.readContract({
                address: poolAddress as `0x${string}`,
                abi: AAVE_POOL_ABI,
                functionName: 'getReserveData',
                args: [token.addresses[chain] as `0x${string}`],
              })
              const aTokenAddress = result.aTokenAddress
              if (aTokenAddress && aTokenAddress !== '0x0000000000000000000000000000000000000000') {
                // Check user has a balance on this aToken
                const bal = await client.readContract({
                  address: aTokenAddress as `0x${string}`,
                  abi: ERC20_ABI,
                  functionName: 'balanceOf',
                  args: [address as `0x${string}`],
                })
                if (bal > 0n) aTokenAddresses.push(aTokenAddress)
              }
            } catch {
              // Ignore tokens with no reserve on this chain
            }
          })
        )

        if (aTokenAddresses.length === 0) return []

        // For each aToken, get its reward list and query claimable amounts
        const rewardTokenSet = new Set<string>()
        await Promise.all(
          aTokenAddresses.map(async (aToken) => {
            try {
              const rewardTokens = await client.readContract({
                address: rewardsController as `0x${string}`,
                abi: AAVE_REWARDS_CONTROLLER_ABI,
                functionName: 'getRewardsByAsset',
                args: [aToken as `0x${string}`],
              })
              rewardTokens.forEach(r => rewardTokenSet.add(r))
            } catch {
              // No rewards configured for this aToken
            }
          })
        )

        if (rewardTokenSet.size === 0) return []

        // Fetch prices for reward tokens
        // We use a best-effort approach — unknown tokens default to $0 price
        const priceIds = Array.from(rewardTokenSet).map(r => `token:${r}`)
        const priceMap = await fetchTokenPrices(priceIds).catch(() => ({} as Record<string, number>))

        // Query claimable amounts per reward token
        await Promise.all(
          Array.from(rewardTokenSet).map(async (rewardToken) => {
            try {
              const claimable = await client.readContract({
                address: rewardsController as `0x${string}`,
                abi: AAVE_REWARDS_CONTROLLER_ABI,
                functionName: 'getUserRewards',
                args: [aTokenAddresses as `0x${string}`[], address as `0x${string}`, rewardToken as `0x${string}`],
              })

              if (claimable <= 0n) return

              // Resolve reward token symbol and decimals from our known tokens or fall back
              const knownToken = Object.values(SUPPORTED_TOKENS).find(
                t => Object.values(t.addresses).some(a => a?.toLowerCase() === rewardToken.toLowerCase())
              )
              const decimals = knownToken?.decimals ?? 18
              const symbol = knownToken?.symbol ?? rewardToken.slice(0, 6)
              const amount = Number(claimable) / Math.pow(10, decimals)

              // Attempt price lookup with multiple key formats
              const priceKey = knownToken
                ? `coingecko:${knownToken.coingeckoId}`
                : `token:${rewardToken}`
              const price = priceMap[priceKey] ?? 0
              const amountUsd = amount * price

              if (amountUsd >= MIN_REWARD_USD || amount > 0) {
                rewards.push({ token: symbol, amount: amount.toFixed(8), amountUsd })
              }
            } catch (e) {
              console.error(`[aave] Failed to get rewards for token ${rewardToken}:`, e)
            }
          })
        )
      } catch (e) {
        console.error('[aave] fetchRewards error:', e)
      }

      return rewards
    },

    buildClaimTx: async (params: ClaimParams): Promise<UnsignedTx[]> => {
      const { address, chain } = params
      const rewardsController = AAVE_REWARDS_CONTROLLER[chain]
      const poolAddress = aavePlugin.addresses[chain]?.poolAddress
      if (!rewardsController || !poolAddress) {
        throw new Error(`Aave RewardsController not available on ${chain}`)
      }

      const client = getPublicClient(chain)

      // Collect aToken addresses with positive balances
      const tokensToQuery = Object.values(SUPPORTED_TOKENS).filter(t => t.addresses[chain])
      const aTokenAddresses: string[] = []

      await Promise.all(
        tokensToQuery.map(async (token) => {
          try {
            const result = await client.readContract({
              address: poolAddress as `0x${string}`,
              abi: AAVE_POOL_ABI,
              functionName: 'getReserveData',
              args: [token.addresses[chain] as `0x${string}`],
            })
            const aTokenAddress = result.aTokenAddress
            if (aTokenAddress && aTokenAddress !== '0x0000000000000000000000000000000000000000') {
              const bal = await client.readContract({
                address: aTokenAddress as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [address as `0x${string}`],
              })
              if (bal > 0n) aTokenAddresses.push(aTokenAddress)
            }
          } catch {
            // skip
          }
        })
      )

      const chainMap: Record<ChainId, number> = {
        ethereum: 1,
        arbitrum: 42161,
        base: 8453,
        solana: 0,
      }
      const chainId = chainMap[chain]

      const claimData = encodeFunctionData({
        abi: AAVE_REWARDS_CONTROLLER_ABI,
        functionName: 'claimAllRewards',
        args: [aTokenAddresses as `0x${string}`[], address as `0x${string}`],
      })

      return [
        {
          chainId,
          to: rewardsController,
          data: claimData,
          value: 0n,
          description: `Claim all Aave V3 rewards on ${chain}`,
        },
      ]
    },
  } satisfies RewardFetcher,
}
