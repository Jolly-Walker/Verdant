import { describe, it, expect } from 'vitest'
import { deduplicatePositions } from '../aggregation'
import { Position } from '@/types/position'

describe('deduplicatePositions', () => {
  it('removes duplicate positions based on protocol, chain, asset, and type', () => {
    const positions: Partial<Position>[] = [
      {
        id: '1',
        protocol: 'aave',
        chain: 'ethereum',
        asset: 'USDC',
        assetAddress: '0x123',
        positionType: 'supply',
        metadata: {}
      },
      {
        id: '2',
        protocol: 'aave',
        chain: 'ethereum',
        asset: 'USDC',
        assetAddress: '0x123',
        positionType: 'supply',
        metadata: { enriched: true }
      }
    ]

    const result = deduplicatePositions(positions as Position[])
    expect(result.length).toBe(1)
    expect(result[0].metadata.enriched).toBe(true)
  })

  it('keeps positions on different chains', () => {
    const positions: Partial<Position>[] = [
      {
        id: '1',
        protocol: 'aave',
        chain: 'ethereum',
        asset: 'USDC',
        assetAddress: '0x123',
        positionType: 'supply',
      },
      {
        id: '2',
        protocol: 'aave',
        chain: 'arbitrum',
        asset: 'USDC',
        assetAddress: '0x456',
        positionType: 'supply',
      }
    ]

    const result = deduplicatePositions(positions as Position[])
    expect(result.length).toBe(2)
  })

  it('keeps positions of different types', () => {
    const positions: Partial<Position>[] = [
      {
        id: '1',
        protocol: 'aave',
        chain: 'ethereum',
        asset: 'USDC',
        assetAddress: '0x123',
        positionType: 'supply',
      },
      {
        id: '2',
        protocol: 'aave',
        chain: 'ethereum',
        asset: 'USDC',
        assetAddress: '0x123',
        positionType: 'borrow',
      }
    ]

    const result = deduplicatePositions(positions as Position[])
    expect(result.length).toBe(2)
  })
})
