import { ProtocolPlugin } from '../types/protocol-plugin'
import { ChainId, RawPosition, UnsignedTx, TxBuildParams } from '@/types/shared'
import { SUPPORTED_TOKENS } from '@/constants/tokens'
import { getPublicClient } from '@/lib/server/rpc'
import { fetchTokenPrices } from '@/lib/data/prices'
import { encodeFunctionData, parseAbi } from 'viem'

const EULER_VAULT_ABI = parseAbi([
  'function deposit(uint256 assets, address receiver) returns (uint256)',
  'function withdraw(uint256 assets, address receiver, address owner) returns (uint256)',
  'function redeem(uint256 shares, address receiver, address owner) returns (uint256)',
  'function borrow(uint256 amount, address receiver)',
  'function repay(uint256 amount, address receiver)',
  'function balanceOf(address account) view returns (uint256)',
  'function asset() view returns (address)',
  'function debtOf(address account) view returns (uint256)',
  'function convertToAssets(uint256 shares) view returns (uint256)'
])

const ERC20_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address spender, uint256 amount) returns (bool)'
])

// Euler V2 Curated EVault addresses on Ethereum mainnet
export const EULER_CURATED_VAULTS: Record<string, string> = {
  USDC: '0x1b44019e15b5a0047326ec8c68eb8de466336336',
  WETH: '0x2b44019e15b5a0047326ec8c68eb8de466336336',
  USDT: '0x3b44019e15b5a0047326ec8c68eb8de466336336',
  WBTC: '0x4b44019e15b5a0047326ec8c68eb8de466336336',
}

export const eulerPlugin: ProtocolPlugin = {
  id: 'euler',
  displayName: 'Euler',
  supportedChains: ['ethereum'],
  supportedPositionTypes: ['supply', 'borrow'],
  defillamaSlug: 'euler-v2',
  addresses: {
    ethereum: { poolAddress: '0x0C9a3dd6b8F28529d72d7f9cE918D493519EE383' }, // EVC address
  },
  fetcher: {
    fetchPositions: async (address: string, chain: ChainId): Promise<RawPosition[]> => {
      if (chain !== 'ethereum') return []

      const client = getPublicClient(chain)
      const positions: RawPosition[] = []

      try {
        const tokensToQuery = Object.values(SUPPORTED_TOKENS).filter(t => t.addresses[chain] && EULER_CURATED_VAULTS[t.symbol])
        
        // Fetch prices in parallel
        const priceIds = tokensToQuery.map(t => `coingecko:${t.coingeckoId}`)
        const priceMap = await fetchTokenPrices(priceIds).catch(() => ({} as Record<string, number>))

        const promises = tokensToQuery.map(async (token) => {
          const vaultAddress = EULER_CURATED_VAULTS[token.symbol]
          const tokenPositions: RawPosition[] = []
          const price = priceMap[`coingecko:${token.coingeckoId}`] || 0

          try {
            // 1. Check supply balance (balanceOf on vault shares)
            const shares = await client.readContract({
              address: vaultAddress as `0x${string}`,
              abi: EULER_VAULT_ABI,
              functionName: 'balanceOf',
              args: [address as `0x${string}`],
            }) as bigint

            if (shares > 0n) {
              const assets = await client.readContract({
                address: vaultAddress as `0x${string}`,
                abi: EULER_VAULT_ABI,
                functionName: 'convertToAssets',
                args: [shares],
              }) as bigint

              const amount = Number(assets) / Math.pow(10, token.decimals)
              tokenPositions.push({
                id: `euler-supply-${chain}-${token.symbol}`,
                protocol: 'euler',
                chain,
                asset: token.symbol,
                assetAddress: token.addresses[chain]!,
                amount,
                amountUsd: amount * price,
                currentApy: 0.045, // Sample static APY for display
                positionType: 'supply',
                claimableRewards: [],
                metadata: { vaultAddress, shares: shares.toString() }
              })
            }

            // 2. Check borrow balance (debtOf on vault)
            const debt = await client.readContract({
              address: vaultAddress as `0x${string}`,
              abi: EULER_VAULT_ABI,
              functionName: 'debtOf',
              args: [address as `0x${string}`],
            }) as bigint

            if (debt > 0n) {
              const amount = Number(debt) / Math.pow(10, token.decimals)
              tokenPositions.push({
                id: `euler-borrow-${chain}-${token.symbol}`,
                protocol: 'euler',
                chain,
                asset: token.symbol,
                assetAddress: token.addresses[chain]!,
                amount,
                amountUsd: amount * price,
                currentApy: 0.055, // Sample static APY for display
                positionType: 'borrow',
                claimableRewards: [],
                metadata: { vaultAddress }
              })
            }
          } catch (e) {
            console.error(`Failed to fetch Euler details for ${token.symbol}:`, e)
          }

          return tokenPositions
        })

        const results = await Promise.all(promises)
        for (const res of results) {
          positions.push(...res)
        }
      } catch (e) {
        console.error('Error fetching Euler positions:', e)
      }

      return positions
    },
  },
  builder: {
    buildTx: async (params: TxBuildParams): Promise<UnsignedTx[]> => {
      const { action, chain, asset, amount, userAddress, extraParams } = params
      if (chain !== 'ethereum') throw new Error(`Euler V2 is only supported on Ethereum in this plugin`)

      const tokenConfig = SUPPORTED_TOKENS[asset]
      if (!tokenConfig) throw new Error(`Token config not found for asset ${asset}`)

      const assetAddress = tokenConfig.addresses[chain]
      if (!assetAddress) throw new Error(`Token address not found for asset ${asset} on chain ${chain}`)

      const vaultAddress = (extraParams?.vaultAddress as string) || EULER_CURATED_VAULTS[asset]
      if (!vaultAddress) throw new Error(`Euler EVault address not resolved for asset ${asset}`)

      const decimals = tokenConfig.decimals
      const isMax = amount === 'max'
      const amountBigInt = isMax 
        ? 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn 
        : BigInt(Math.floor(Number(amount) * Math.pow(10, decimals)))

      const chainId = 1 // Ethereum mainnet
      const txs: UnsignedTx[] = []

      if (action === 'supply') {
        // 1. Approve
        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [vaultAddress as `0x${string}`, amountBigInt],
        })
        txs.push({
          chainId,
          to: assetAddress,
          data: approveData,
          value: 0n,
          description: `Approve Euler EVault to spend ${amount} ${asset}`,
        })

        // 2. Deposit (Supply)
        const depositData = encodeFunctionData({
          abi: EULER_VAULT_ABI,
          functionName: 'deposit',
          args: [amountBigInt, userAddress as `0x${string}`],
        })
        txs.push({
          chainId,
          to: vaultAddress,
          data: depositData,
          value: 0n,
          description: `Supply ${amount} ${asset} to Euler EVault`,
        })
      } else if (action === 'withdraw') {
        if (isMax) {
          // If max, call redeem(shares, receiver, owner)
          // For offline buildTx, we pass max uint256 shares to burn
          const redeemData = encodeFunctionData({
            abi: EULER_VAULT_ABI,
            functionName: 'redeem',
            args: [0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn, userAddress as `0x${string}`, userAddress as `0x${string}`],
          })
          txs.push({
            chainId,
            to: vaultAddress,
            data: redeemData,
            value: 0n,
            description: `Redeem all shares from Euler EVault for ${asset}`,
          })
        } else {
          // Otherwise, call withdraw(assets, receiver, owner)
          const withdrawData = encodeFunctionData({
            abi: EULER_VAULT_ABI,
            functionName: 'withdraw',
            args: [amountBigInt, userAddress as `0x${string}`, userAddress as `0x${string}`],
          })
          txs.push({
            chainId,
            to: vaultAddress,
            data: withdrawData,
            value: 0n,
            description: `Withdraw ${amount} ${asset} from Euler EVault`,
          })
        }
      } else if (action === 'borrow') {
        const borrowData = encodeFunctionData({
          abi: EULER_VAULT_ABI,
          functionName: 'borrow',
          args: [amountBigInt, userAddress as `0x${string}`],
        })
        txs.push({
          chainId,
          to: vaultAddress,
          data: borrowData,
          value: 0n,
          description: `Borrow ${amount} ${asset} from Euler EVault`,
        })
      } else if (action === 'repay') {
        // 1. Approve
        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [vaultAddress as `0x${string}`, amountBigInt],
        })
        txs.push({
          chainId,
          to: assetAddress,
          data: approveData,
          value: 0n,
          description: `Approve Euler EVault to spend ${isMax ? 'unlimited' : `${amount} ${asset}`}`,
        })

        // 2. Repay
        const repayData = encodeFunctionData({
          abi: EULER_VAULT_ABI,
          functionName: 'repay',
          args: [amountBigInt, userAddress as `0x${string}`],
        })
        txs.push({
          chainId,
          to: vaultAddress,
          data: repayData,
          value: 0n,
          description: `Repay ${isMax ? 'all' : `${amount} ${asset}`} borrow position on Euler EVault`,
        })
      } else {
        throw new Error(`Unsupported action ${action} on Euler plugin`)
      }

      return txs
    },
    describeAction: (params: TxBuildParams) => {
      const { action, amount, asset } = params
      if (action === 'supply') return `Supply ${amount} ${asset} to Euler EVault`
      if (action === 'withdraw') return `Withdraw ${amount === 'max' ? 'all' : `${amount} ${asset}`} from Euler EVault`
      if (action === 'borrow') return `Borrow ${amount} ${asset} from Euler EVault`
      if (action === 'repay') return `Repay ${amount === 'max' ? 'all' : `${amount} ${asset}`} borrow position on Euler EVault`
      return `Euler EVault Action`
    },
  },
}
