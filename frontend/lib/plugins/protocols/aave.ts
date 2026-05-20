import { ProtocolPlugin } from '../types/protocol-plugin'
import { ChainId, RawPosition, UnsignedTx, TxBuildParams } from '@/types/shared'
import { SUPPORTED_TOKENS } from '@/constants/tokens'
import { getPublicClient } from '@/lib/server/rpc'
import { fetchTokenPrices } from '@/lib/data/prices'
import { encodeFunctionData, parseAbi } from 'viem'

const AAVE_POOL_ABI = parseAbi([
  'function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
  'function getReserveData(address asset) view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidationThreshold, uint128 variableBorrowIndex, uint128 currentLiquidityRate, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress)',
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
  'function withdraw(address asset, uint256 amount, address to) returns (uint256)',
  'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)',
  'function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf) returns (uint256)'
])

const ERC20_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address spender, uint256 amount) returns (bool)'
])

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
        // 1. Get user account data to check if they have any interaction
        const [totalCollateralBase, totalDebtBase] = await client.readContract({
          address: poolAddress as `0x${string}`,
          abi: AAVE_POOL_ABI,
          functionName: 'getUserAccountData',
          args: [address as `0x${string}`],
        }) as [bigint, bigint, bigint, bigint, bigint, bigint]

        // If both are zero, the user has no positions on this Aave market.
        if (totalCollateralBase === 0n && totalDebtBase === 0n) {
          return []
        }

        // 2. Query reserve data and balances for all supported tokens that have an address on this chain
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
            }) as any

            const aTokenAddress = result[9] as string
            const variableDebtTokenAddress = result[11] as string

            const supplyApy = Number(result[4]) / 1e27
            const borrowApy = Number(result[5]) / 1e27
            const price = priceMap[`coingecko:${token.coingeckoId}`] || 0

            // Check supply balance
            const aTokenBalance = await client.readContract({
              address: aTokenAddress as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [address as `0x${string}`],
            }) as bigint

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
                metadata: { aTokenAddress }
              })
            }

            // Check borrow balance
            const debtBalance = await client.readContract({
              address: variableDebtTokenAddress as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [address as `0x${string}`],
            }) as bigint

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
                metadata: { variableDebtTokenAddress }
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
      const amountBigInt = isMax 
        ? 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn 
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
}
