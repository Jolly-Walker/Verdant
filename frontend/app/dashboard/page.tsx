'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { LoopModal } from '@/components/loop/LoopModal';
import { PositionList } from '@/components/positions/PositionList';
import { PositionsProvider } from '@/components/positions/PositionsProvider';
import { SequenceModal } from '@/components/sequence/SequenceModal';
import { SequenceBuilderModal } from '@/components/sequenceBuilder/SequenceBuilderModal';
import { WarningBanner } from '@/components/ui/WarningBanner';
import { useLoopModal } from '@/hooks/useLoopModal';
import { usePositions } from '@/hooks/usePositions';
import { useSequenceBuilderModal } from '@/hooks/useSequenceBuilderModal';
import { useSequenceModal } from '@/hooks/useSequenceModal';
import { useWallet } from '@/hooks/useWallet';
import { formatUsd } from '@/lib/utils/formatting';

/**
 * Owns the single `/api/positions` fetch for the whole dashboard subtree.
 * Every `usePositions()` consumer below — the page body, each PositionCard, and
 * SequenceBuilderModal — reads that one result instead of fetching its own.
 */
export default function Dashboard() {
  return (
    <PositionsProvider>
      <DashboardView />
    </PositionsProvider>
  );
}

function DashboardView() {
  const { isConnected, isMounted } = useWallet();
  const router = useRouter();
  const { positions, isLoading, error, refetch, totalValueUsd, totalRewardsUsd } = usePositions();
  const { isOpen, options, openModal, closeModal } = useSequenceModal();
  const {
    isOpen: isBuilderOpen,
    builderPositionId,
    openBuilder,
    closeBuilder,
  } = useSequenceBuilderModal();
  const { isOpen: isLoopOpen, loopPosition, loopCollateral, openLoop, closeLoop } = useLoopModal();

  useEffect(() => {
    if (isMounted && !isConnected) {
      router.push('/');
    }
  }, [isConnected, isMounted, router]);

  if (!isMounted || !isConnected) {
    return null;
  }

  return (
    <div className="min-h-screen text-verdant-text-primary">
      <AppHeader onSequence={() => openBuilder()} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-verdant-moss/25 bg-verdant-surface-accent px-4 py-3 text-sm text-verdant-text-muted">
            <span className="font-semibold text-verdant-moss">Demo Mode</span>
            {' — '}Positions and transactions are simulated. No wallet connected, no real funds.
          </div>
        )}

        {/* ---------- Ledger masthead ---------- */}
        <header className="mb-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="fl-eyebrow">Field ledger</p>
              <h1 className="fl-serif mt-2 text-3xl text-verdant-pine md:text-4xl">
                Your positions
              </h1>
            </div>
            <button
              type="button"
              onClick={refetch}
              disabled={isLoading}
              className="btn btn-ghost btn-sm border border-verdant-rule hover:border-verdant-moss hover:text-verdant-moss"
            >
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {!isLoading && positions.length > 0 && (
            <dl className="mt-5 flex flex-wrap items-end gap-x-9 gap-y-3">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-widest text-verdant-text-muted">
                  Portfolio
                </dt>
                <dd className="mt-1 font-mono text-[15px] font-semibold text-verdant-text-primary">
                  {formatUsd(totalValueUsd)}
                </dd>
              </div>
              {totalRewardsUsd > 1 && (
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-widest text-verdant-text-muted">
                    Claimable
                  </dt>
                  <dd className="mt-1 font-mono text-[15px] font-semibold text-verdant-profit">
                    {formatUsd(totalRewardsUsd)}
                  </dd>
                </div>
              )}
            </dl>
          )}

          <hr className="fl-double-rule mt-6" />
        </header>

        {error && (
          <div className="mb-6">
            <WarningBanner message={error} />
          </div>
        )}

        <PositionList
          positions={positions}
          isLoading={isLoading}
          onSequence={(template, params) => openModal({ template, params })}
          onOpenBuilder={(positionId) => openBuilder({ positionId })}
          onOpenLoop={(position, collateral) => openLoop(position, collateral)}
        />
      </main>

      <SequenceModal
        isOpen={isOpen}
        onClose={closeModal}
        initialTemplate={options.template}
        initialParams={options.params}
      />

      <SequenceBuilderModal
        isOpen={isBuilderOpen}
        onClose={closeBuilder}
        initialPositionId={builderPositionId}
      />

      {loopPosition && (
        <LoopModal
          isOpen={isLoopOpen}
          onClose={closeLoop}
          position={loopPosition}
          collateralPosition={loopCollateral}
        />
      )}
    </div>
  );
}
