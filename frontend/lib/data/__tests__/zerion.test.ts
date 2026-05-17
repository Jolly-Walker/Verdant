import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock server-only before other imports
vi.mock('server-only', () => ({}))

import { getVerdantProtocol, normaliseZerionPositions, ZerionPosition } from '../zerion'

describe('Zerion Data Normalization', () => {
  beforeEach(() => {
    vi.stubEnv('ZERION_API_KEY', 'test-api-key')
  })

  describe('getVerdantProtocol', () => {
    it('should map Aave variants correctly', () => {
      expect(getVerdantProtocol('Aave V3', 'aUSDC', 'Aave USDC')).toBe('aave')
      expect(getVerdantProtocol(null, 'aUSDC', 'Aave USDC')).toBe('aave')
      expect(getVerdantProtocol('Aave', 'USDC', 'USDC')).toBe('aave')
    })

    it('should map Morpho variants correctly', () => {
      expect(getVerdantProtocol('Morpho Blue', 'USDC', 'HyperUSDC')).toBe('morpho')
      expect(getVerdantProtocol(null, 'hyperusdc', 'some name')).toBe('morpho')
      expect(getVerdantProtocol('Morpho', 'USDC', 'USDC')).toBe('morpho')
    })

    it('should map Pendle variants correctly', () => {
      expect(getVerdantProtocol('Pendle', 'PT-eETH', 'Pendle PT')).toBe('pendle')
    })

    it('should map Euler variants correctly', () => {
      expect(getVerdantProtocol('Euler V2', 'eUSDC', 'Euler USDC')).toBe('euler')
    })

    it('should return null for unknown protocols', () => {
      expect(getVerdantProtocol('Uniswap', 'UNI-V2', 'Uniswap LP')).toBeNull()
      expect(getVerdantProtocol(null, 'USDC', 'USD Coin')).toBeNull()
    })
  })

  describe('normaliseZerionPositions', () => {
    interface MockOverrides {
      attributes?: Record<string, unknown>;
      relationships?: Record<string, unknown>;
      chain?: string;
      id?: string;
    }

    const createMockPosition = (overrides: MockOverrides = {}): ZerionPosition => {
      const attributes = {
        name: 'USDC',
        protocol: 'Aave V3',
        position_type: 'deposit' as const,
        value: 1000,
        quantity: {
          decimals: 6,
          float: 1000,
          numeric: '1000000000'
        },
        apy: 0.05,
        fungible_info: {
          symbol: 'USDC',
          name: 'USD Coin',
          implementations: [
            { chain_id: 'ethereum', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6 }
          ]
        },
        ...(overrides.attributes || {})
      }

      const relationships = {
        chain: { data: { id: overrides.chain || 'ethereum' } },
        ...(overrides.relationships || {})
      }

      return {
        type: 'positions',
        id: overrides.id || 'test-id',
        attributes,
        relationships
      } as ZerionPosition
    }


    it('should normalize a basic supply position correctly', () => {
      const raw = [createMockPosition()]
      const normalized = normaliseZerionPositions(raw)

      expect(normalized).toHaveLength(1)
      expect(normalized[0]).toMatchObject({
        id: 'test-id',
        protocol: 'aave',
        chain: 'ethereum',
        asset: 'USDC',
        assetAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        amount: 1000,
        amountUsd: 1000,
        currentApy: 0.05,
        positionType: 'supply',
        priceUsd: 1
      })
    })

    it('should normalize a borrow position correctly', () => {
      const raw = [createMockPosition({
        attributes: {
          position_type: 'loan',
          protocol: 'Euler'
        }
      })]
      const normalized = normaliseZerionPositions(raw)

      expect(normalized).toHaveLength(1)
      expect(normalized[0].positionType).toBe('borrow')
      expect(normalized[0].protocol).toBe('euler')
    })

    it('should normalize a wallet token correctly', () => {
      const raw = [createMockPosition({
        attributes: {
          position_type: 'wallet',
          protocol: null
        }
      })]
      const normalized = normaliseZerionPositions(raw)

      expect(normalized).toHaveLength(1)
      expect(normalized[0].positionType).toBe('wallet')
      expect(normalized[0].protocol).toBe('wallet')
    })

    it('should normalize staked/locked positions as LP', () => {
      const staked = createMockPosition({ attributes: { position_type: 'staked', protocol: 'Pendle' } })
      const locked = createMockPosition({ attributes: { position_type: 'locked', protocol: 'Pendle' } })
      
      const normalized = normaliseZerionPositions([staked, locked])

      expect(normalized[0].positionType).toBe('lp')
      expect(normalized[1].positionType).toBe('lp')
    })

    it('should correctly map chains (Ethereum, Arbitrum, Base)', () => {
      const eth = createMockPosition({ chain: 'ethereum' })
      const arb = createMockPosition({ chain: 'arbitrum' })
      const base = createMockPosition({ chain: 'base' })
      
      const normalized = normaliseZerionPositions([eth, arb, base])

      expect(normalized[0].chain).toBe('ethereum')
      expect(normalized[1].chain).toBe('arbitrum')
      expect(normalized[2].chain).toBe('base')
    })

    it('should filter out unsupported chains', () => {
      const raw = [createMockPosition({ chain: 'polygon' })]
      const normalized = normaliseZerionPositions(raw)

      expect(normalized).toHaveLength(0)
    })

    it('should filter out unknown non-wallet protocols', () => {
      const raw = [createMockPosition({
        attributes: {
          protocol: 'Unknown Protocol',
          position_type: 'deposit'
        }
      })]
      const normalized = normaliseZerionPositions(raw)

      expect(normalized).toHaveLength(0)
    })

    it('should handle zero quantity in price calculation', () => {
      const raw = [createMockPosition({
        attributes: {
          value: 100,
          quantity: { float: 0 }
        }
      })]
      const normalized = normaliseZerionPositions(raw)

      expect(normalized[0].priceUsd).toBe(100) // Fallback to / 1
    })

    it('should extract correct asset address for the specific chain', () => {
      const raw = [createMockPosition({
        chain: 'arbitrum',
        attributes: {
          fungible_info: {
            symbol: 'USDC',
            name: 'USD Coin',
            implementations: [
              { chain_id: 'ethereum', address: '0xeth', decimals: 6 },
              { chain_id: 'arbitrum', address: '0xarb', decimals: 6 }
            ]
          }
        }
      })]
      const normalized = normaliseZerionPositions(raw)

      expect(normalized[0].assetAddress).toBe('0xarb')
    })

    it('should use p.attributes.name if fungible_info is missing', () => {
      const raw = [createMockPosition({
        attributes: {
          name: 'Custom Token',
          fungible_info: null,
          protocol: 'Aave V3'
        }
      })]
      const normalized = normaliseZerionPositions(raw)

      expect(normalized[0].asset).toBe('Custom Token')
    })

    it('should handle missing implementation address', () => {
      const raw = [createMockPosition({
        attributes: {
          fungible_info: {
            symbol: 'USDC',
            name: 'USD Coin',
            implementations: [
              { chain_id: 'ethereum', address: null, decimals: 6 }
            ]
          }
        }
      })]
      const normalized = normaliseZerionPositions(raw)

      expect(normalized[0].assetAddress).toBe('')
    })

    it('should default to supply position type for unknown Zerion types', () => {
      const raw = [createMockPosition({
        attributes: {
          position_type: 'investment',
          protocol: 'Aave V3'
        }
      })]
      const normalized = normaliseZerionPositions(raw)

      expect(normalized[0].positionType).toBe('supply')
    })

    it('should handle null value and quantity', () => {
      const raw = [createMockPosition({
        attributes: {
          value: null,
          quantity: { float: 0 }
        }
      })]
      const normalized = normaliseZerionPositions(raw)

      expect(normalized[0].amountUsd).toBe(0)
      expect(normalized[0].amount).toBe(0)
      expect(normalized[0].priceUsd).toBe(0)
    })

    it('should filter out positions where protocol is wallet but positionType is not wallet', () => {
      const raw = [createMockPosition({
        attributes: {
          protocol: null,
          position_type: 'deposit' // getVerdantProtocol returns null, posType becomes supply
        }
      })]
      const normalized = normaliseZerionPositions(raw)

      expect(normalized).toHaveLength(0)
    })
  })
})

