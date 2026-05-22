'use client'

import { useState, useEffect } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react'
import { DEMO_WALLET_ADDRESS } from '@/lib/demo/wallet'

const SPOOF_ADDRESS = '0x3a6e410eb151673c3746ef073f1b475d10376e72' as `0x${string}`

// process.env.NEXT_PUBLIC_DEMO_MODE is a build-time constant — it never
// changes between renders, so branching on it is safe and the eslint
// rules-of-hooks suppression below is intentional and documented.
const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export function useWallet() {
  // Demo mode: bypass all real wallet logic and return a fixed identity.
  // IS_DEMO is a build-time constant so this branch is always the same
  // across renders — conditional hook calls are safe here.
  if (IS_DEMO) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useDemoWallet()
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useRealWallet()
}

function useDemoWallet() {
  return {
    address: DEMO_WALLET_ADDRESS,
    evmAddress: DEMO_WALLET_ADDRESS,
    solanaAddress: undefined,
    isConnected: true,
    isEvmConnected: true,
    isSolanaConnected: false,
    isMounted: true,
    enableDebug: () => {},
    disconnect: () => { window.location.href = '/' },
  }
}

function useRealWallet() {
  const { address: evmAddress, isConnected: isEvmConnected } = useAccount()
  const { disconnect: wagmiDisconnect } = useDisconnect()
  const { publicKey, connected: isSolanaConnected, disconnect: solanaDisconnect } = useSolanaWallet()
  
  const [isDebug, setIsDebug] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsDebug(localStorage.getItem('verdant_debug') === 'true')
    setIsMounted(true)
  }, [])

  const enableDebug = () => {
    localStorage.setItem('verdant_debug', 'true')
    setIsDebug(true)
    window.location.href = '/dashboard'
  }

  const disconnect = () => {
    if (isDebug) {
      localStorage.removeItem('verdant_debug')
      setIsDebug(false)
      window.location.href = '/'
    } else {
      wagmiDisconnect()
      solanaDisconnect()
    }
  }

  const solanaAddress = publicKey?.toBase58()
  const isConnected = isMounted && isDebug ? true : (isEvmConnected || isSolanaConnected)
  
  // Primary address is EVM if connected, else Solana
  const address = isMounted && isDebug ? SPOOF_ADDRESS : (evmAddress || solanaAddress)

  return {
    address,
    evmAddress,
    solanaAddress,
    isConnected,
    isEvmConnected,
    isSolanaConnected,
    isMounted,
    enableDebug,
    disconnect
  }
}
