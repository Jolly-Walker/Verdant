import { CHAIN_REGISTRY } from '@/lib/plugins/chains';
import { PROTOCOL_REGISTRY } from '@/lib/plugins/protocols';
import type { ChainId, ProtocolId } from '@/types/shared';
import { findPoolApy } from './defillama';

/**
 * Resolve an internal `ProtocolId`/`ChainId` to their DefiLlama identifiers
 * (project slug like `aave-v3`, chain name like `Ethereum`) via the plugin
 * registries, then look up the pool APY.
 *
 * `findPoolApy` matches on DefiLlama identifiers, NOT our internal ids — calling
 * it with raw ids (`'aave'`/`'ethereum'`) silently misses and resolves APY to 0.
 * Centralising the resolution here keeps the three call sites (cost-preview
 * calculator, `/api/apys`, and conceptually the protocol fetchers) from each
 * re-deriving it. Returns `null` for unknown protocol/chain ids.
 *
 * Lives here rather than in `defillama.ts` to avoid the circular import
 * protocol-plugins → defillama → protocol-plugins.
 */
export function findPoolApyByIds(
  protocol: ProtocolId,
  chain: ChainId,
  asset: string,
): ReturnType<typeof findPoolApy> {
  const protocolPlugin = PROTOCOL_REGISTRY[protocol];
  const chainPlugin = CHAIN_REGISTRY[chain];
  if (!protocolPlugin || !chainPlugin) return Promise.resolve(null);
  return findPoolApy(protocolPlugin.defillamaSlug, chainPlugin.defillamaChain, asset);
}
