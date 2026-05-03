import { ProtocolPlugin } from '../types/protocol-plugin'

export const morphoPlugin: ProtocolPlugin = {
  id: 'morpho',
  displayName: 'Morpho',
  supportedChains: ['ethereum', 'arbitrum'],
  supportedPositionTypes: ['supply'],
  defillamaSlug: 'morpho-blue',
  addresses: {
    ethereum: { poolAddress: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb' },
    arbitrum: { poolAddress: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb' },
  },
  fetcher: {
    fetchPositions: async () => [],
  },
  builder: {
    buildTx: async () => [],
    describeAction: () => 'Morpho Action',
  },
}
