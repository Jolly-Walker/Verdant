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
    buildTx: async (params) => {
      // Mock implementation: in a real app, this would use Pendle SDK to build a redemption tx
      return [
        {
          chainId: params.chain,
          to: '0x0000000000000000000000000000000000000000', // Router address would go here
          data: '0x', // redemption data
          value: 0n,
          description: `Redeem ${params.amount} ${params.asset} on Pendle`,
        }
      ]
    },
    describeAction: (params) => {
      if (params.action === 'withdraw') {
        return `Redeem ${params.asset} on Pendle`
      }
      return `Pendle ${params.action}`
    },
  },
}
