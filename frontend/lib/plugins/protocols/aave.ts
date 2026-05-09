import { ProtocolPlugin } from '../types/protocol-plugin'

export const aavePlugin: ProtocolPlugin = {
  id: 'aave',
  displayName: 'Aave V3',
  supportedChains: ['ethereum', 'arbitrum', 'base'],
  supportedPositionTypes: ['supply', 'borrow'],
  defillamaSlug: 'aave-v3',
  addresses: {
    ethereum: { poolAddress: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2' },
    arbitrum: { poolAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD' },
    base: { poolAddress: '0xA238Dd80C2596972E0670346274589599170D65d' },
  },
  fetcher: {
    fetchPositions: async () => [],
  },
  builder: {
    buildTx: async () => [],
    describeAction: () => 'Aave Action',
  },
}
