import { ProtocolPlugin } from '../types/protocol-plugin'

export const eulerPlugin: ProtocolPlugin = {
  id: 'euler',
  displayName: 'Euler',
  supportedChains: ['ethereum'], // Arbitrum support pending correct EVK vault addresses
  supportedPositionTypes: ['supply', 'borrow'],
  defillamaSlug: 'euler-v2',
  addresses: {
    // Euler EVK EVC (Ethereum Vault Connector) — individual vaults sourced per-market
    ethereum: { poolAddress: '0x0C9a3dd6b8F28529d72d7f9cE918D493519EE383' },
  },
  fetcher: {
    fetchPositions: async () => [],
  },
  builder: {
    buildTx: async () => [],
    describeAction: () => 'Euler Action',
  },
}
