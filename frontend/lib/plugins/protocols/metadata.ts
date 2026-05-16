import { ProtocolId } from '../types/shared'

export interface ProtocolDisplayMetadata {
  id: ProtocolId
  displayName: string
}

export const PROTOCOL_DISPLAY_MAP: Record<ProtocolId, ProtocolDisplayMetadata> = {
  aave: {
    id: 'aave',
    displayName: 'Aave V3',
  },
  morpho: {
    id: 'morpho',
    displayName: 'Morpho',
  },
  pendle: {
    id: 'pendle',
    displayName: 'Pendle',
  },
  euler: {
    id: 'euler',
    displayName: 'Euler',
  },
}
