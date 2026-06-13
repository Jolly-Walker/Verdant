import 'server-only';
/**
 * Morpho Blue GraphQL API client.
 * Docs: https://docs.morpho.org/tools/offchain/api/
 * Endpoint: https://blue-api.morpho.org/graphql
 */
import { fetchWithTimeout } from '@/lib/utils/fetch';

const MORPHO_API = 'https://blue-api.morpho.org/graphql';

export interface MorphoVaultPosition {
  vaultAddress: string;
  vaultName: string;
  assetAddress: string;
  assetSymbol: string;
  assetDecimals: number;
  /** Supplied assets in smallest units (string). */
  assets: string;
  assetsUsd: number | null;
  shares: string;
  /** Vault net supply APY as a decimal (e.g. 0.068), or null if unavailable. */
  netApy: number | null;
}

const USER_POSITIONS_QUERY = `
  query VerdantUserVaultPositions($address: String!, $chainId: Int!) {
    userByAddress(address: $address, chainId: $chainId) {
      vaultPositions {
        shares
        assets
        state {
          assets
          assetsUsd
          shares
        }
        vault {
          address
          name
          asset { address symbol decimals }
          state { netApy }
        }
      }
    }
  }
`;

interface RawVaultPosition {
  shares?: string | number;
  assets?: string | number;
  state?: { assets?: string | number; assetsUsd?: number; shares?: string | number };
  vault?: {
    address?: string;
    name?: string;
    asset?: { address?: string; symbol?: string; decimals?: number };
    state?: { netApy?: number };
  };
}

/**
 * Fetches a wallet's MetaMorpho vault supply positions for a chain. Returns an
 * empty array on any error so a Morpho API outage never blocks the dashboard.
 */
export async function fetchMorphoVaultPositions(
  address: string,
  chainId: number,
): Promise<MorphoVaultPosition[]> {
  try {
    const res = await fetchWithTimeout(MORPHO_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: USER_POSITIONS_QUERY,
        variables: { address, chainId },
      }),
      timeout: 10_000,
    });
    if (!res.ok) return [];

    const json = await res.json();
    const raw: RawVaultPosition[] = json?.data?.userByAddress?.vaultPositions ?? [];

    const positions: MorphoVaultPosition[] = [];
    for (const vp of raw) {
      const vault = vp.vault;
      const asset = vault?.asset;
      if (!vault?.address || !asset?.address || !asset.symbol) continue;

      // Prefer the nested state (current values) over the top-level snapshot.
      const assets = String(vp.state?.assets ?? vp.assets ?? '0');
      const shares = String(vp.state?.shares ?? vp.shares ?? '0');

      positions.push({
        vaultAddress: vault.address,
        vaultName: vault.name ?? 'Morpho Vault',
        assetAddress: asset.address,
        assetSymbol: asset.symbol,
        assetDecimals: asset.decimals ?? 18,
        assets,
        assetsUsd: vp.state?.assetsUsd ?? null,
        shares,
        netApy: vault.state?.netApy ?? null,
      });
    }
    return positions;
  } catch {
    return [];
  }
}
