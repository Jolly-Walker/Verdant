import { PROTOCOL_DISPLAY_MAP } from '@/lib/plugins/protocols/metadata'
import { ProtocolId } from '@/lib/plugins/types/shared'

export function useProtocolMetadata() {
  const getProtocolMetadata = (protocolId: ProtocolId) => {
    return PROTOCOL_DISPLAY_MAP[protocolId]
  }

  const allProtocols = Object.values(PROTOCOL_DISPLAY_MAP)
  
  return {
    getProtocolMetadata,
    allProtocols,
    protocolIds: Object.keys(PROTOCOL_DISPLAY_MAP) as ProtocolId[]
  }
}
