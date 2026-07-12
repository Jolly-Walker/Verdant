/**
 * Server-only RPC utilities.
 *
 * This module MUST only be imported within /app/api/ server routes or other
 * server-only modules (lib/costPreview/, lib/data/). It accesses non-public
 * environment variables that would be undefined in the client bundle.
 */

import 'server-only';
import { createPublicClient, http, type PublicClient, type Chain as ViemChain } from 'viem';
import { arbitrum, base, mainnet } from 'viem/chains';
import type { ChainId } from '@/types/shared';
import { getServerEnvOrWarn, type ServerEnv } from './env';

const ALCHEMY_HOSTS: Record<ChainId, string> = {
  ethereum: 'https://eth-mainnet.g.alchemy.com/v2/',
  arbitrum: 'https://arb-mainnet.g.alchemy.com/v2/',
  base: 'https://base-mainnet.g.alchemy.com/v2/',
  solana: 'https://solana-mainnet.g.alchemy.com/v2/',
};

const ALCHEMY_KEY_VARS: Record<ChainId, keyof ServerEnv> = {
  ethereum: 'ALCHEMY_API_KEY_ETHEREUM',
  arbitrum: 'ALCHEMY_API_KEY_ARBITRUM',
  base: 'ALCHEMY_API_KEY_BASE',
  solana: 'ALCHEMY_API_KEY_SOLANA',
};

/**
 * Get the Alchemy RPC URL for a given chain.
 * Server-side only — if the chain's API key env var is missing, a one-time
 * warning is logged and the returned URL will fail with 401 when used.
 */
export function getRpcUrl(chain: ChainId): string {
  const key = getServerEnvOrWarn(
    ALCHEMY_KEY_VARS[chain],
    `RPC calls for ${chain} will fail with 401`,
  );
  return `${ALCHEMY_HOSTS[chain]}${key ?? ''}`;
}

/**
 * Get a viem PublicClient for a given EVM chain.
 */
export function getPublicClient(chain: ChainId): PublicClient {
  const rpcUrl = getRpcUrl(chain);

  const chainMap: Record<string, ViemChain> = {
    ethereum: mainnet,
    arbitrum: arbitrum,
    base: base,
  };

  const viemChain = chainMap[chain];
  if (!viemChain) {
    throw new Error(`Unsupported EVM chain: ${chain}`);
  }

  return createPublicClient({
    chain: viemChain,
    transport: http(rpcUrl),
  });
}

/**
 * Fetch the current gas price from Alchemy for a given chain.
 * Returns gas price in Gwei. Falls back to hardcoded estimates on failure.
 */
export async function fetchGasPrice(chain: ChainId): Promise<number> {
  const FALLBACK_GWEI: Record<ChainId, number> = {
    ethereum: 25,
    arbitrum: 0.1,
    base: 0.1,
    solana: 0,
  };

  if (chain === 'solana') return 0;

  try {
    const client = getPublicClient(chain);
    const gasPrice = await client.getGasPrice();
    return Number(gasPrice) / 1e9; // Convert wei to gwei
  } catch (err) {
    console.warn(`Gas price fetch failed for ${chain}, using fallback:`, err);
    return FALLBACK_GWEI[chain];
  }
}
