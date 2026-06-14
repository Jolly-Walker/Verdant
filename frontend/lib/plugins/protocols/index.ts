import type { ProtocolId } from '@/types/shared';
import type { ProtocolPlugin } from '../types/protocol-plugin';
import { aavePlugin } from './aave';
import { eulerPlugin } from './euler';
import { morphoPlugin } from './morpho';
import { pendlePlugin } from './pendle';

export const PROTOCOL_REGISTRY: Record<ProtocolId, ProtocolPlugin> = {
  aave: aavePlugin,
  morpho: morphoPlugin,
  pendle: pendlePlugin,
  euler: eulerPlugin,
};
