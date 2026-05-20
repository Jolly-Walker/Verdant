import { describe, it, expect, vi } from 'vitest'

// Mock server-only before other imports
vi.mock('server-only', () => ({}))

import { CHAIN_REGISTRY } from '@/lib/plugins/chains'
import { PROTOCOL_REGISTRY } from '@/lib/plugins/protocols'
import { BRIDGE_REGISTRY } from '@/lib/plugins/bridges'

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
})
