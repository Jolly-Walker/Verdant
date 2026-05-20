import 'server-only'
import { BridgeId } from '@/types/shared'
import { BridgePlugin } from '../types/bridge-plugin'
import { acrossBridgePlugin } from './across'
import { nearIntentsBridgePlugin } from './nearIntents'
import { layerzeroBridgePlugin } from './layerzero'
import { chainlinkBridgePlugin } from './chainlink'

export const BRIDGE_REGISTRY: Record<BridgeId, BridgePlugin> = {
  across: acrossBridgePlugin,
  nearIntents: nearIntentsBridgePlugin,
  layerzero: layerzeroBridgePlugin,
  chainlink: chainlinkBridgePlugin
}
