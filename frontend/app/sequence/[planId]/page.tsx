'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { SequenceComplete } from '@/components/sequence/SequenceComplete';
import { SequencePlanView } from '@/components/sequence/SequencePlanView';
import { SequenceStepActionsProvider } from '@/components/sequence/SequenceStepCard';
import { Spinner } from '@/components/ui/Spinner';
import { useSequenceCost } from '@/hooks/useSequenceCost';
import { useSequencer } from '@/hooks/useSequencer';
import { useWallet } from '@/hooks/useWallet';
import { getLastDemoPlan } from '@/lib/demo/sequencer';
import { getFocusedStep } from '@/lib/sequencer/engine';
import { fetchWithTimeout } from '@/lib/utils/fetch';

const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

/** Every state of this page — including loading and error — keeps the nav. */
function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="text-verdant-text-primary">
      <AppHeader />
      {children}
    </div>
  );
}

function PageNotice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center sm:px-6">
      <h1 className="fl-serif text-2xl text-verdant-pine">{title}</h1>
      {children}
    </div>
  );
}

export default function SequenceExecutionPage({ params }: { params: { planId: string } }) {
  const router = useRouter();
  const { address } = useWallet();
  const { plan, currentStep, simulateStep, executeStep, signStep, setPlan } = useSequencer();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [simError, setSimError] = useState<string | null>(null);

  const simulatingStepId = useRef<string | null>(null);

  const {
    result: costResult,
    isLoading: costLoading,
    staleStepIds,
    expiredStepIds,
    hasExpiredQuotes,
    refetch: refetchCost,
  } = useSequenceCost({
    plan,
    walletAddress: address || undefined,
  });

  // A reverted simulation comes back as HTTP 200 (the step carries the revert
  // reason and renders its own failure panel); this only rejects when the
  // request itself fails, which used to vanish into console.error.
  const runSimulation = useCallback(
    async (stepId: string) => {
      setSimError(null);
      try {
        return await simulateStep(stepId);
      } catch (err: unknown) {
        setSimError(
          err instanceof Error ? err.message : 'Could not reach the simulator — please retry.',
        );
        throw err;
      }
    },
    [simulateStep],
  );

  useEffect(() => {
    // Demo mode keeps plans in client state only; rehydrate the one just created
    // on the dashboard rather than hitting the real API (which has no demo plan).
    if (IS_DEMO) {
      const demoPlan = getLastDemoPlan();
      if (demoPlan) {
        setPlan(demoPlan);
      } else {
        setError('Demo plan expired — start a new sequence from the dashboard.');
      }
      setLoading(false);
      return;
    }

    if (!address) return;

    fetchWithTimeout(`/api/sequencer/plan/${params.planId}?wallet=${address}`)
      .then((res) => {
        if (!res.ok) throw new Error('Plan not found or unauthorized');
        return res.json();
      })
      .then((data) => {
        setPlan(data.plan);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [params.planId, address, setPlan]);

  useEffect(() => {
    if (
      plan &&
      currentStep &&
      currentStep.status === 'pending' &&
      simulatingStepId.current !== currentStep.id
    ) {
      simulatingStepId.current = currentStep.id;
      // runSimulation already surfaced the message in `simError`; clearing the
      // guard lets the banner (and the step card) trigger another attempt.
      runSimulation(currentStep.id).catch(() => {
        simulatingStepId.current = null;
      });
    }

    // Intentionally depends on primitive values only — re-running on every
    // plan/currentStep object identity change would re-trigger simulation on
    // each refetch; the simulatingStepId ref additionally guards against
    // double-simulating the same step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id, currentStep?.id, currentStep?.status, simulateStep]);

  const focusedStepId = useMemo(() => (plan ? (getFocusedStep(plan)?.id ?? null) : null), [plan]);

  // SequencePlanView forwards only `onAction` to the step cards, so retry and
  // bridge-completion reach them through context (see SequenceStepActions).
  const stepActions = useMemo(
    () => ({ simulateStep: runSimulation, completeStep: signStep }),
    [runSimulation, signStep],
  );

  const retryFocusedSimulation = () => {
    if (!focusedStepId) return;
    simulatingStepId.current = focusedStepId;
    runSimulation(focusedStepId).catch(() => {
      simulatingStepId.current = null;
    });
  };

  if (!address)
    return (
      <PageShell>
        <PageNotice title="Connect your wallet">
          <p className="mt-3 text-[15px] leading-relaxed text-verdant-text-muted">
            Connect the wallet that owns this sequence to review and execute its steps.
          </p>
        </PageNotice>
      </PageShell>
    );

  if (loading)
    return (
      <PageShell>
        <PageNotice title="Loading plan">
          <div className="mt-6 flex justify-center">
            <Spinner />
          </div>
        </PageNotice>
      </PageShell>
    );

  if (error)
    return (
      <PageShell>
        <PageNotice title="Sequence unavailable">
          <p className="mt-3 text-[15px] leading-relaxed text-verdant-loss">{error}</p>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="btn btn-secondary btn-sm mt-6"
          >
            Back to positions
          </button>
        </PageNotice>
      </PageShell>
    );

  if (!plan)
    return (
      <PageShell>
        <PageNotice title="Plan not found">
          <p className="mt-3 text-[15px] leading-relaxed text-verdant-text-muted">
            This sequence no longer exists, or it belongs to another wallet.
          </p>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="btn btn-secondary btn-sm mt-6"
          >
            Back to positions
          </button>
        </PageNotice>
      </PageShell>
    );

  if (plan.status === 'complete') {
    return (
      <PageShell>
        <SequenceComplete plan={plan} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      {simError && (
        <div className="mx-auto max-w-[1180px] px-4 pt-8 sm:px-6">
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-lg border border-verdant-loss/25 bg-verdant-loss/10 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm text-verdant-loss">
              Simulation request failed — {simError} Nothing was signed.
            </p>
            <button
              type="button"
              onClick={retryFocusedSimulation}
              disabled={!focusedStepId}
              className="btn btn-danger btn-sm shrink-0"
            >
              Retry simulation
            </button>
          </div>
        </div>
      )}

      <SequenceStepActionsProvider actions={stepActions}>
        <SequencePlanView
          plan={plan}
          currentStepId={focusedStepId}
          onSign={executeStep}
          onEdit={() => router.back()}
          costResult={costResult}
          costLoading={costLoading}
          staleStepIds={staleStepIds}
          expiredStepIds={expiredStepIds}
          hasExpiredQuotes={hasExpiredQuotes}
          onRefetchCost={refetchCost}
        />
      </SequenceStepActionsProvider>
    </PageShell>
  );
}
