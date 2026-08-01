'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { useWallet } from '@/hooks/useWallet';

export default function Home() {
  const { isConnected, isMounted, enableDebug } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (isMounted && isConnected) {
      router.push('/dashboard');
    }
  }, [isConnected, isMounted, router]);

  if (!isMounted) return null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12">
      <div className="w-full max-w-md text-center">
        <p className="fl-eyebrow">Cross-chain yield execution</p>
        <h1 className="fl-serif mt-3 text-6xl text-verdant-pine md:text-7xl">Verdant</h1>
        <p className="mx-auto mt-4 max-w-sm text-base text-verdant-text-muted md:text-lg">
          Every allocation is yours to decide. Verdant makes executing it fast, simulated, and
          transparent.
        </p>

        <hr className="fl-double-rule mx-auto mt-8 max-w-[160px]" />

        <div className="mt-8 flex flex-col items-center gap-4">
          {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && (
            <Link href="/dashboard" className="btn btn-primary btn-lg w-full max-w-xs">
              Try Demo
            </Link>
          )}
          <ConnectButton />
          <button
            type="button"
            onClick={enableDebug}
            className="text-sm text-verdant-text-muted underline underline-offset-4 transition-colors hover:text-verdant-text-primary"
          >
            Enter Debug Mode
          </button>
        </div>
      </div>
    </main>
  );
}
