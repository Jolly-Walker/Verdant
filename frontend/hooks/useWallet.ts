'use client'

import { useState, useEffect } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react'

const SPOOF_ADDRESS = '0x3a6e410eb151673c3746ef073f1b475d10376e72' as `0x${string}`

export function useWallet() {
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
