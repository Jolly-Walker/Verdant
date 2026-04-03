'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@/components/wallet/ConnectButton'

export default function Home() {
  const { isConnected } = useAccount()
  const router = useRouter()

  useEffect(() => {
    if (isConnected) {
      router.push('/dashboard')
    }
  }, [isConnected, router])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="mb-4 text-5xl font-bold tracking-tight">Verdant</h1>
        <p className="mb-8 text-lg opacity-80">Discretionary cross-chain yield execution</p>
        <div className="flex justify-center">
          <ConnectButton />
        </div>
      </div>
    </div>
  )
}
