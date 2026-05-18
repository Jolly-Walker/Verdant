'use client'

import { ConnectButton as RainbowConnectButton } from '@rainbow-me/rainbowkit'
import { SolanaConnectButton } from './SolanaConnectButton'

export function ConnectButton() {
  return (
    <div className="flex items-center gap-2">
      <RainbowConnectButton />
      <SolanaConnectButton />
    </div>
  )
}
