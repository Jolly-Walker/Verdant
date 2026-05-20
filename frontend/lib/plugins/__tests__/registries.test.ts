import { describe, it, expect, vi } from 'vitest'

// Mock server-only before other imports
vi.mock('server-only', () => ({}))

import { CHAIN_REGISTRY } from '@/lib/plugins/chains'
import { PROTOCOL_REGISTRY } from '@/lib/plugins/protocols'
import { BRIDGE_REGISTRY, getBridgeQuotes } from '@/lib/plugins/bridges'

describe('Plugin Registries', () => {
  it('should have a functional CHAIN_REGISTRY', () => {
    expect(CHAIN_REGISTRY.ethereum).toBeDefined()
    expect(CHAIN_REGISTRY.arbitrum).toBeDefined()
    expect(CHAIN_REGISTRY.base).toBeDefined()
    expect(CHAIN_REGISTRY.ethereum.displayName).toBe('Ethereum')
    expect(CHAIN_REGISTRY.arbitrum.id).toBe('arbitrum')
    expect(CHAIN_REGISTRY.base.chainIdOrNetwork).toBe(8453)
  })

  it('should have a functional PROTOCOL_REGISTRY', () => {
    expect(PROTOCOL_REGISTRY.aave).toBeDefined()
    expect(PROTOCOL_REGISTRY.morpho).toBeDefined()
    expect(PROTOCOL_REGISTRY.aave.displayName).toBe('Aave V3')
    expect(PROTOCOL_REGISTRY.aave.supportedChains).toContain('ethereum')
    expect(PROTOCOL_REGISTRY.aave.supportedChains).toContain('base')
    expect(PROTOCOL_REGISTRY.morpho.supportedChains).toContain('base')
  })

  it('should have a functional BRIDGE_REGISTRY', () => {
    expect(BRIDGE_REGISTRY.across).toBeDefined()
    expect(BRIDGE_REGISTRY.nearIntents).toBeDefined()
    expect(BRIDGE_REGISTRY.across.displayName).toBe('Across Protocol')
  })

  describe('getBridgeQuotes', () => {
    it('should return quotes sorted by expectedOutputAmount', async () => {
      const params = {
        fromChain: 'ethereum' as const,
        toChain: 'arbitrum' as const,
        token: 'USDC',
        amount: '1000000000',
        recipientAddress: '0x123'
      }

      const quotes = await getBridgeQuotes(params)
      
      if (quotes.length > 1) {
        for (let i = 0; i < quotes.length - 1; i++) {
          expect(BigInt(quotes[i].expectedOutputAmount)).toBeGreaterThanOrEqual(BigInt(quotes[i+1].expectedOutputAmount))
        }
      }
    })

    it('should correctly sort quotes with amounts exceeding MAX_SAFE_INTEGER', async () => {
      // MAX_SAFE_INTEGER is ~9e15. We use ~10e18 with small differences.
      const largeAmount1 = '10000000000000000001'
      const largeAmount2 = '10000000000000000005'
      const largeAmount3 = '10000000000000000003'

      const mockBridge1 = {
        id: 'bridge1',
        supportedTokens: ['ETH'],
        supportedRoutes: [{ from: 'ethereum', to: 'arbitrum' }],
        getQuote: async () => ({ bridgeId: 'bridge1', expectedOutputAmount: largeAmount1 })
      }
      const mockBridge2 = {
        id: 'bridge2',
        supportedTokens: ['ETH'],
        supportedRoutes: [{ from: 'ethereum', to: 'arbitrum' }],
        getQuote: async () => ({ bridgeId: 'bridge2', expectedOutputAmount: largeAmount2 })
      }
      const mockBridge3 = {
        id: 'bridge3',
        supportedTokens: ['ETH'],
        supportedRoutes: [{ from: 'ethereum', to: 'arbitrum' }],
        getQuote: async () => ({ bridgeId: 'bridge3', expectedOutputAmount: largeAmount3 })
      }

      const originalRegistry = { ...BRIDGE_REGISTRY }
      Object.keys(BRIDGE_REGISTRY).forEach(key => delete BRIDGE_REGISTRY[key as any])
      BRIDGE_REGISTRY['bridge1' as any] = mockBridge1 as any
      BRIDGE_REGISTRY['bridge2' as any] = mockBridge2 as any
      BRIDGE_REGISTRY['bridge3' as any] = mockBridge3 as any

      try {
        const quotes = await getBridgeQuotes({
          fromChain: 'ethereum',
          toChain: 'arbitrum',
          token: 'ETH',
          amount: '10000000000000000000',
          recipientAddress: '0x123'
        })

        expect(quotes).toHaveLength(3)
        expect(quotes[0].bridgeId).toBe('bridge2') // ...005
        expect(quotes[1].bridgeId).toBe('bridge3') // ...003
        expect(quotes[2].bridgeId).toBe('bridge1') // ...001
      } finally {
        Object.keys(BRIDGE_REGISTRY).forEach(key => delete BRIDGE_REGISTRY[key as any])
        Object.assign(BRIDGE_REGISTRY, originalRegistry)
      }
    })
  })
})
