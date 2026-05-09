import { describe, it, expect } from 'vitest'
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
  })
})
