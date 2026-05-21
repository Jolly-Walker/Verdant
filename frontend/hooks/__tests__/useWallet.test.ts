/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useWallet } from '../useWallet'
import { useAccount } from 'wagmi'
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react'

// Mock wagmi
vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  useDisconnect: vi.fn(() => ({ disconnect: vi.fn() })),
}))

// Mock solana wallet adapter
vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: vi.fn(),
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    clear: () => { store = {} },
    removeItem: (key: string) => { delete store[key] }
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('useWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // Default mock implementation
    vi.mocked(useAccount).mockReturnValue({
      address: undefined,
      isConnected: false,
    } as unknown as ReturnType<typeof useAccount>)
    vi.mocked(useSolanaWallet).mockReturnValue({
      publicKey: null,
      connected: false,
      disconnect: vi.fn(),
    } as unknown as ReturnType<typeof useSolanaWallet>)
  })

  it('returns EVM address when connected to EVM', () => {
    const mockEvmAddress = '0x1234567890123456789012345678901234567890'
    vi.mocked(useAccount).mockReturnValue({
      address: mockEvmAddress as `0x${string}`,
      isConnected: true,
    } as unknown as ReturnType<typeof useAccount>)

    const { result } = renderHook(() => useWallet())

    expect(result.current.address).toBe(mockEvmAddress)
    expect(result.current.isEvmConnected).toBe(true)
    expect(result.current.isSolanaConnected).toBe(false)
  })

  it('returns Solana address when connected to Solana and not EVM', () => {
    const mockSolanaAddress = 'vines1vzrYbzRwuAfsG9ogCc5PsTdi7nLBYv5dg7S'
    vi.mocked(useSolanaWallet).mockReturnValue({
      publicKey: { toBase58: () => mockSolanaAddress },
      connected: true,
      disconnect: vi.fn(),
    } as unknown as ReturnType<typeof useSolanaWallet>)

    const { result } = renderHook(() => useWallet())

    expect(result.current.address).toBe(mockSolanaAddress)
    expect(result.current.solanaAddress).toBe(mockSolanaAddress)
    expect(result.current.isSolanaConnected).toBe(true)
  })

  it('prefers EVM address when both are connected', () => {
    const mockEvmAddress = '0x1234567890123456789012345678901234567890'
    const mockSolanaAddress = 'vines1vzrYbzRwuAfsG9ogCc5PsTdi7nLBYv5dg7S'
    
    vi.mocked(useAccount).mockReturnValue({
      address: mockEvmAddress as `0x${string}`,
      isConnected: true,
    } as unknown as ReturnType<typeof useAccount>)
    vi.mocked(useSolanaWallet).mockReturnValue({
      publicKey: { toBase58: () => mockSolanaAddress },
      connected: true,
      disconnect: vi.fn(),
    } as unknown as ReturnType<typeof useSolanaWallet>)

    const { result } = renderHook(() => useWallet())

    expect(result.current.address).toBe(mockEvmAddress)
    expect(result.current.isEvmConnected).toBe(true)
    expect(result.current.isSolanaConnected).toBe(true)
  })
})
