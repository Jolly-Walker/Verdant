import 'server-only';
import { encodeFunctionData, parseAbi } from 'viem';
import { SUPPORTED_TOKENS } from '@/constants/tokens';
import { fetchMerklClaims, MERKL_DISTRIBUTOR_ADDRESS, type MerklClaim } from '@/lib/data/merkl';
import { fetchMorphoVaultPositions } from '@/lib/data/morphoApi';
import type { ChainId, RawPosition, Reward, TxBuildParams, UnsignedTx } from '@/types/shared';
import type { ClaimParams, ProtocolPlugin, RewardFetcher } from '../types/protocol-plugin';

/** MetaMorpho vaults are ERC-4626 — supply/withdraw via the standard interface. */
const META_MORPHO_ABI = parseAbi([
  'function deposit(uint256 assets, address receiver) returns (uint256)',
  'function withdraw(uint256 assets, address receiver, address owner) returns (uint256)',
  'function redeem(uint256 shares, address receiver, address owner) returns (uint256)',
]);

const ERC20_APPROVE_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
]);

const MAX_UINT256 = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn;

/**
 * Merkl Distributor ABI — the claim function used by both Morpho and Euler rewards.
 * Source: https://docs.merkl.xyz/merkl-mechanisms/distributor
 */
const MERKL_DISTRIBUTOR_ABI = parseAbi([
  'function claim(address[] users, address[] tokens, uint256[] amounts, bytes32[][] proofs) external',
]);

/**
 * Chain ID mapping for Merkl API numeric IDs.
 */
const EVM_CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453,
};

/**
 * Fetches token prices for Merkl reward tokens.
 * Falls back to 0 if the price cannot be resolved.
 */
async function fetchRewardPricesFromDefillama(
  tokenAddresses: string[],
  chain: string,
): Promise<Record<string, number>> {
  if (tokenAddresses.length === 0) return {};

  const chainPrefix = chain === 'ethereum' ? 'ethereum' : chain;
  const coinsParam = tokenAddresses.map((addr) => `${chainPrefix}:${addr.toLowerCase()}`).join(',');

  try {
    const res = await fetch(`https://coins.llama.fi/prices/current/${coinsParam}`, {
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return {};

    const data = await res.json();
    const priceMap: Record<string, number> = {};
    for (const [key, val] of Object.entries(data.coins ?? {})) {
      const addr = key.split(':')[1];
      if (addr) priceMap[addr.toLowerCase()] = (val as { price: number }).price ?? 0;
    }
    return priceMap;
  } catch {
    return {};
  }
}

/**
 * Converts MerklClaim[] into the Reward[] shape used by the app.
 */
async function merklClaimsToRewards(claims: MerklClaim[], chain: string): Promise<Reward[]> {
  const tokenAddresses = claims.map((c) => c.token);
  const priceMap = await fetchRewardPricesFromDefillama(tokenAddresses, chain);

  return claims.map((claim) => {
    const amount = Number(BigInt(claim.claimableAmount)) / 10 ** claim.decimals;
    const price = priceMap[claim.token.toLowerCase()] ?? 0;
    return {
      token: claim.symbol,
      amount: amount.toFixed(8),
      amountUsd: amount * price,
    };
  });
}

/**
 * Encodes a Merkl Distributor claim transaction.
 */
function buildMerklClaimTx(
  userAddress: string,
  claims: MerklClaim[],
  chainId: number,
  chainLabel: string,
  protocolLabel: string,
): UnsignedTx {
  // Merkl claim(users[], tokens[], amounts[], proofs[][])
  // proofs[i] = the bytes32[] merkle path proving users[i] can claim tokens[i]
  // We submit one user with N tokens, so proofs has N entries (one per token)
  const claimData = encodeFunctionData({
    abi: MERKL_DISTRIBUTOR_ABI,
    functionName: 'claim',
    args: [
      claims.map(() => userAddress as `0x${string}`),
      claims.map((c) => c.token as `0x${string}`),
      claims.map((c) => BigInt(c.claimableAmount)),
      claims.map((c) => c.proof as `0x${string}`[]),
    ],
  });

  return {
    chainId,
    to: MERKL_DISTRIBUTOR_ADDRESS,
    data: claimData,
    value: 0n,
    description: `Claim ${protocolLabel} rewards on ${chainLabel}`,
  };
}

export const morphoPlugin: ProtocolPlugin = {
  id: 'morpho',
  displayName: 'Morpho',
  supportedChains: ['ethereum', 'arbitrum', 'base'],
  supportedPositionTypes: ['supply'],
  defillamaSlug: 'morpho-blue',
  addresses: {
    ethereum: { poolAddress: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb' },
    arbitrum: { poolAddress: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb' },
    base: { poolAddress: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb' },
  },
  fetcher: {
    fetchPositions: async (address: string, chain: ChainId): Promise<RawPosition[]> => {
      const chainId = EVM_CHAIN_IDS[chain];
      if (!chainId) return [];

      const vaultPositions = await fetchMorphoVaultPositions(address, chainId);
      const positions: RawPosition[] = [];

      for (const vp of vaultPositions) {
        // Only surface positions with a non-trivial supplied balance.
        if (!vp.assets || vp.assets === '0') continue;
        const decimals = vp.assetDecimals ?? 18;
        const amount = Number(vp.assets) / 10 ** decimals;
        if (amount <= 0) continue;

        // `amount` is a TOKEN quantity, never a USD value — using it as a fallback
        // mis-values any non-$1 asset by its price (e.g. 0.5 WBTC -> "$0.5"). Prefer
        // the API's USD, then derive it from the spot price, and only as a last
        // resort report 0 (clearly "unknown") rather than the token count.
        let amountUsd = vp.assetsUsd;
        if (amountUsd == null) {
          amountUsd = vp.assetPriceUsd != null ? amount * vp.assetPriceUsd : 0;
          if (amountUsd === 0) {
            console.warn(
              `[morpho] no USD valuation for ${vp.assetSymbol} in vault ${vp.vaultAddress}; reporting $0`,
            );
          }
        }

        positions.push({
          id: `morpho-supply-${chain}-${vp.vaultAddress}`,
          protocol: 'morpho',
          chain,
          asset: vp.assetSymbol,
          assetAddress: vp.assetAddress,
          amount,
          amountUsd,
          currentApy: vp.netApy ?? 0,
          positionType: 'supply',
          claimableRewards: [],
          metadata: {
            vaultAddress: vp.vaultAddress,
            vaultName: vp.vaultName,
            shares: vp.shares,
          },
        });
      }

      return positions;
    },
  },
  builder: {
    // Morpho supply is held in MetaMorpho ERC-4626 vaults. Because an asset can
    // have many vaults, the caller must name the vault via extraParams.vaultAddress
    // (carried on the position metadata) so we never guess the wrong vault.
    buildTx: async (params: TxBuildParams): Promise<UnsignedTx[]> => {
      const { action, chain, asset, amount, userAddress, extraParams } = params;
      const chainId = EVM_CHAIN_IDS[chain];
      if (!chainId) throw new Error(`Morpho is not supported on ${chain}`);

      const vaultAddress = extraParams?.vaultAddress as string | undefined;
      if (!vaultAddress) {
        throw new Error('Morpho buildTx requires extraParams.vaultAddress (the MetaMorpho vault)');
      }

      const tokenConfig = SUPPORTED_TOKENS[asset];
      const assetAddress = tokenConfig?.addresses[chain];
      if (!assetAddress) throw new Error(`Token address not found for ${asset} on ${chain}`);

      const isMax = amount === 'max';
      const isWei = extraParams?.isWei === true;
      const decimals = tokenConfig.decimals;
      const amountBigInt = isMax
        ? MAX_UINT256
        : isWei
          ? BigInt(amount)
          : BigInt(Math.floor(Number(amount) * 10 ** decimals));

      const txs: UnsignedTx[] = [];

      if (action === 'supply') {
        txs.push({
          chainId,
          to: assetAddress,
          data: encodeFunctionData({
            abi: ERC20_APPROVE_ABI,
            functionName: 'approve',
            args: [vaultAddress as `0x${string}`, amountBigInt],
          }),
          value: 0n,
          description: `Approve Morpho vault to spend ${amount} ${asset}`,
        });
        txs.push({
          chainId,
          to: vaultAddress,
          data: encodeFunctionData({
            abi: META_MORPHO_ABI,
            functionName: 'deposit',
            args: [amountBigInt, userAddress as `0x${string}`],
          }),
          value: 0n,
          description: `Supply ${amount} ${asset} to Morpho`,
        });
      } else if (action === 'withdraw') {
        if (isMax) {
          // Burn all shares — redeem(maxUint) withdraws the full balance.
          txs.push({
            chainId,
            to: vaultAddress,
            data: encodeFunctionData({
              abi: META_MORPHO_ABI,
              functionName: 'redeem',
              args: [MAX_UINT256, userAddress as `0x${string}`, userAddress as `0x${string}`],
            }),
            value: 0n,
            description: `Withdraw all ${asset} from Morpho`,
          });
        } else {
          txs.push({
            chainId,
            to: vaultAddress,
            data: encodeFunctionData({
              abi: META_MORPHO_ABI,
              functionName: 'withdraw',
              args: [amountBigInt, userAddress as `0x${string}`, userAddress as `0x${string}`],
            }),
            value: 0n,
            description: `Withdraw ${amount} ${asset} from Morpho`,
          });
        }
      } else {
        throw new Error(`Unsupported action ${action} on Morpho plugin`);
      }

      return txs;
    },
    describeAction: (params: TxBuildParams) => {
      const { action, amount, asset } = params;
      if (action === 'supply') return `Supply ${amount} ${asset} to Morpho`;
      if (action === 'withdraw')
        return `Withdraw ${amount === 'max' ? 'all' : `${amount} ${asset}`} from Morpho`;
      return `Morpho ${action}`;
    },
  },
  rewards: {
    fetchRewards: async (address: string, chain: ChainId): Promise<Reward[]> => {
      // Morpho rewards are distributed via Merkl
      const claims = await fetchMerklClaims(address, chain);
      if (claims.length === 0) return [];

      return merklClaimsToRewards(claims, chain);
    },

    buildClaimTx: async (params: ClaimParams): Promise<UnsignedTx[]> => {
      const { address, chain } = params;
      const chainId = EVM_CHAIN_IDS[chain];
      if (!chainId) throw new Error(`Morpho rewards not supported on ${chain}`);

      const claims = await fetchMerklClaims(address, chain);
      if (claims.length === 0) return [];

      return [buildMerklClaimTx(address, claims, chainId, chain, 'Morpho')];
    },
  } satisfies RewardFetcher,
};
