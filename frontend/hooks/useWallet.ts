'use client'

import { useState, useEffect } from 'react'
import { useAccount, useDisconnect } from 'wagmi'

const SPOOF_ADDRESS = '0x8ab71ad4037a06002fdcfbef051f2fa9799df240' as `0x${string}`

export function useWallet() {
  const account = useAccount()
  const { disconnect: wagmiDisconnect } = useDisconnect()
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
    }
  }

  const isConnected = isMounted && isDebug ? true : account.isConnected
  const address = isMounted && isDebug ? SPOOF_ADDRESS : account.address

  return {
    address,
    isConnected,
    isMounted,
    enableDebug,
    disconnect
  }
}
