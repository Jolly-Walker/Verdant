import { ProtocolPlugin } from '../types/protocol-plugin'

export const eulerPlugin: ProtocolPlugin = {
  id: 'euler',
  displayName: 'Euler',
  supportedChains: ['ethereum', 'arbitrum'],
  supportedPositionTypes: ['supply', 'borrow'],
  defillamaSlug: 'euler',
  addresses: {
    ethereum: { poolAddress: '0x27182842E098f60e3D576794A5bFFb0777E025d3' },
    arbitrum: { poolAddress: '0x27182842E098f60e3D576794A5bFFb0777E025d3' },
  },
  fetcher: {
    fetchPositions: async () => [],
  },
  builder: {
    buildTx: async () => [],
    describeAction: () => 'Euler Action',
  },
}
