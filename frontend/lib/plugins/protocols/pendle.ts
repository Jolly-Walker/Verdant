import { ProtocolPlugin } from '../types/protocol-plugin'

export const pendlePlugin: ProtocolPlugin = {
  id: 'pendle',
  displayName: 'Pendle',
  supportedChains: ['ethereum', 'arbitrum'],
  supportedPositionTypes: ['pendle-pt', 'pendle-yt'],
  defillamaSlug: 'pendle',
  addresses: {
    ethereum: { poolAddress: '0x888888888889758F76e7103c6CbF23ABbF58F946' },
    arbitrum: { poolAddress: '0x888888888889758F76e7103c6CbF23ABbF58F946' },
  },
  fetcher: {
    fetchPositions: async () => [],
  },
  builder: {
    buildTx: async () => [],
    describeAction: () => 'Pendle Action',
  },
}
