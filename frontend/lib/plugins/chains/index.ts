import type { ChainId } from '@/types/shared';
import type { ChainPlugin } from '../types/chain-plugin';
import { arbitrumPlugin } from './arbitrum';
import { basePlugin } from './base';
import { ethereumPlugin } from './ethereum';
import { solanaPlugin } from './solana';

export * from './metadata';

export const CHAIN_REGISTRY: Record<ChainId, ChainPlugin> = {
  ethereum: ethereumPlugin,
  arbitrum: arbitrumPlugin,
  base: basePlugin,
  solana: solanaPlugin,
};
