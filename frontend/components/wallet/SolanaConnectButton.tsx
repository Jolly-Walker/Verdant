'use client'

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import '@solana/wallet-adapter-react-ui/styles.css'

export function SolanaConnectButton() {
  return (
    <div className="solana-button-container">
      <WalletMultiButton className="!bg-verdant-moss hover:!bg-verdant-moss-dark !rounded-md !h-10 !text-sm !font-semibold" />
    </div>
  )
}
