'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useDisconnect } from 'wagmi'
import { ConnectButton } from '@/components/wallet/ConnectButton'

export default function Dashboard() {
  const { isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const router = useRouter()

  useEffect(() => {
    if (!isConnected) {
      router.push('/')
    }
  }, [isConnected, router])

  if (!isConnected) {
    return null
  }

  return (
    <div className="min-h-screen p-8">
      <header className="flex items-center justify-between pb-6 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold">Verdant</h1>
        </div>
        <div className="flex items-center gap-4">
          <ConnectButton />
          <button 
            onClick={() => disconnect()}
            className="px-4 py-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
          >
            Disconnect
          </button>
        </div>
      </header>
      
      <main className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Your Positions</h2>
        <div className="p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 text-center opacity-70">
          Positions loading placeholder...
        </div>
      </main>
    </div>
  )
}
