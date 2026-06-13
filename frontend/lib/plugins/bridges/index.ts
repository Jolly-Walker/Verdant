import 'server-only';
import type { BridgeId } from '@/types/shared';
import type { BridgePlugin } from '../types/bridge-plugin';
import { acrossBridgePlugin } from './across';
import { chainlinkBridgePlugin } from './chainlink';
import { layerzeroBridgePlugin } from './layerzero';
import { nearIntentsBridgePlugin } from './nearIntents';

export const BRIDGE_REGISTRY: Record<BridgeId, BridgePlugin> = {
  across: acrossBridgePlugin,
  nearIntents: nearIntentsBridgePlugin,
  layerzero: layerzeroBridgePlugin,
  chainlink: chainlinkBridgePlugin,
};
