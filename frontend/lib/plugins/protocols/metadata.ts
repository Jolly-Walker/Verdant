import { ProtocolId } from '@/types/shared'

export interface ProtocolDisplayMetadata {
  id: ProtocolId
  displayName: string
  zerionIds: string[]
}

export const PROTOCOL_DISPLAY_MAP: Record<ProtocolId, ProtocolDisplayMetadata> = {
  aave: {
    id: 'aave',
    displayName: 'Aave V3',
    zerionIds: ['aave-v3']
  },
  morpho: {
    id: 'morpho',
    displayName: 'Morpho',
    zerionIds: ['morpho', 'morpho-blue']
  },
  pendle: {
    id: 'pendle',
    displayName: 'Pendle',
    zerionIds: ['pendle']
  },
  euler: {
    id: 'euler',
    displayName: 'Euler',
    zerionIds: ['euler-v2']
  },
}
