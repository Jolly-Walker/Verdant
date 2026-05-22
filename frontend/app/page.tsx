'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useWallet } from '@/hooks/useWallet'
import { ConnectButton } from '@/components/wallet/ConnectButton'

export default function Home() {
  const { isConnected, isMounted, enableDebug } = useWallet()
  const router = useRouter()

  useEffect(() => {
    if (isMounted && isConnected) {
      router.push('/dashboard')
    }
  }, [isConnected, isMounted, router])

  if (!isMounted) return null

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="mb-4 text-5xl font-bold tracking-tight">Verdant</h1>
        <p className="mb-8 text-lg opacity-80">Discretionary cross-chain yield execution</p>
        <div className="flex flex-col items-center gap-4">
          {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && (
            <Link
              href="/dashboard"
              className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Try Demo
            </Link>
          )}
          <ConnectButton />
          <button
            onClick={enableDebug}
            className="text-sm text-zinc-500 hover:text-zinc-300 underline underline-offset-4 transition-colors"
          >
            Enter Debug Mode
          </button>
        </div>
      </div>
    </div>
  )
}
