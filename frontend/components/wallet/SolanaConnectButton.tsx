'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import '@solana/wallet-adapter-react-ui/styles.css'

export function SolanaConnectButton() {
  return (
    <div className="solana-button-container">
      <WalletMultiButton className="!bg-zinc-800 !hover:bg-zinc-700 !rounded-lg !h-10 !text-sm !font-medium" />
    </div>
  )
}
