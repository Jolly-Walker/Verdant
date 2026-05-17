import { ProtocolId } from '@/types/shared'
import { ProtocolPlugin } from '../types/protocol-plugin'
import { aavePlugin } from './aave'
import { morphoPlugin } from './morpho'
import { pendlePlugin } from './pendle'
import { eulerPlugin } from './euler'

export const PROTOCOL_REGISTRY: Record<ProtocolId, ProtocolPlugin> = {
  aave: aavePlugin,
  morpho: morphoPlugin,
  pendle: pendlePlugin,
  euler: eulerPlugin,
}
