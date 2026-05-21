import 'server-only';
import { ChainId } from '@/types/shared';
import { fetchWithTimeout } from '../utils/fetch';

export const AAVE_SUBGRAPH_URLS: Partial<Record<ChainId, string>> = {
  ethereum: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3',
  arbitrum: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-arbitrum',
  base: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-base',
};

export interface AaveUserReserve {
  reserve: {
    underlyingAsset: string;
    symbol: string;
    decimals: number;
  };
  currentATokenBalance: string;
  currentVariableDebt: string;
  usageAsCollateralEnabledOnUser: boolean;
}

export interface AaveUserData {
  user: {
    id: string;
    totalCollateralBase: string;
    totalDebtBase: string;
    healthFactor: string;
    userReserves: AaveUserReserve[];
  } | null;
}

/**
 * Fetches Aave V3 user data from the subgraph.
 * Provides richer data than direct RPC, specifically per-reserve collateral info.
 */
export async function fetchAaveUserData(address: string, chain: ChainId): Promise<AaveUserData | null> {
  const url = AAVE_SUBGRAPH_URLS[chain];
  if (!url) return null;

  const query = `
    query GetUserData($user: String!) {
      user(id: $user) {
        id
        totalCollateralBase
        totalDebtBase
        healthFactor
        userReserves {
          reserve {
            underlyingAsset
            symbol
            decimals
          }
          currentATokenBalance
          currentVariableDebt
          usageAsCollateralEnabledOnUser
        }
      }
    }
  `;

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { user: address.toLowerCase() },
      }),
      timeout: 10000,
    });

    if (!response.ok) {
      return null;
    }

    const { data, errors } = await response.json();
    
    if (errors && errors.length > 0) {
      console.error(`Subgraph errors on ${chain}:`, errors);
      return null;
    }

    return data;
  } catch (error) {
    console.error(`Error fetching Aave user data from subgraph on ${chain}:`, error);
    return null;
  }
}
