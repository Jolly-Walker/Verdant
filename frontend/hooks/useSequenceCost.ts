'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDemoSequenceCost } from '@/hooks/useDemoSequenceCost';
import type { CostPreviewResult, StepCost } from '@/types/quote';
import type { SequencePlan } from '@/types/sequencer';

// process.env.NEXT_PUBLIC_DEMO_MODE is a build-time constant — it never
// changes between renders, so branching on it is safe and the eslint
// rules-of-hooks suppression below is intentional and documented.
const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const STALE_WARN_MS = 30_000; // 30s → orange warning
export const STALE_EXPIRE_MS = 60_000; // 60s → disable execution

/**
 * Pure staleness computation, extracted for testability. Pairs each plan step to
 * its cost entry BY ID (never array index — the cost API may reorder or return
 * fewer steps), and treats an unverifiable quote age (NaN) as expired so a
 * malformed timestamp can never present a stale quote as executable.
 */
export function computeQuoteStaleness(
  steps: ReadonlyArray<{ id: string }>,
  costSteps: ReadonlyArray<StepCost>,
  quoteFetchedAtMs: number,
  nowMs: number,
): { stale: Set<string>; expired: Set<string> } {
  const stale = new Set<string>();
  const expired = new Set<string>();
  // NaN age (malformed fetch timestamp) → treat as expired so a quote whose
  // freshness we can't verify is never executable. The fetch-time guard in
  // useRealSequenceCost already rejects a NaN timestamp before we get here; this
  // keeps the pure function correct in isolation (and under test).
  const age = Number.isNaN(quoteFetchedAtMs) ? Infinity : nowMs - quoteFetchedAtMs;

  for (const step of steps) {
    const stepCost = costSteps.find((sc) => sc.stepId === step.id);
    if (!stepCost?.quoteExpiresAt) continue;

    // Respect the bridge's own expiresAt too (skip if malformed → NaN).
    const ownExpiresAt = new Date(stepCost.quoteExpiresAt).getTime();
    const ownExpired = !Number.isNaN(ownExpiresAt) && nowMs >= ownExpiresAt;

    if (age > STALE_EXPIRE_MS || ownExpired) {
      expired.add(step.id);
    } else if (age > STALE_WARN_MS) {
      stale.add(step.id);
    }
  }

  // Expired always implies stale; derive the superset once rather than
  // double-adding to both sets in every branch above.
  for (const id of expired) stale.add(id);

  return { stale, expired };
}

interface UseSequenceCostOptions {
  plan: SequencePlan | null;
  walletAddress?: string;
  currentApy?: number;
  targetApy?: number;
  borrowApy?: number;
  supplyApy?: number;
}

interface UseSequenceCostReturn {
  result: CostPreviewResult | null;
  isLoading: boolean;
  error: string | null;
  /** Step IDs whose bridge quotes are stale (>30s old) */
  staleStepIds: Set<string>;
  /** Step IDs whose bridge quotes are expired (>60s old) — blocks execution */
  expiredStepIds: Set<string>;
  /** Any bridge quote is expired — caller should disable "Begin Sequence" */
  hasExpiredQuotes: boolean;
  refetch: () => void;
}

/**
 * Hook for fetching multi-step sequence cost preview with staleness tracking.
 *
 * - Fetches cost via /api/sequencer/cost when plan changes
 * - Tracks per-step bridge quote staleness against StepCost.quoteExpiresAt
 * - staleStepIds: steps with quotes older than 30s
 * - expiredStepIds: steps with quotes older than 60s (execution blocked)
 */
export function useSequenceCost(options: UseSequenceCostOptions): UseSequenceCostReturn {
  if (IS_DEMO) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useDemoSequenceCost(options);
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useRealSequenceCost(options);
}

function useRealSequenceCost({
  plan,
  walletAddress,
  currentApy,
  targetApy,
  borrowApy,
  supplyApy,
}: UseSequenceCostOptions): UseSequenceCostReturn {
  const [result, setResult] = useState<CostPreviewResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staleStepIds, setStaleStepIds] = useState<Set<string>>(new Set());
  const [expiredStepIds, setExpiredStepIds] = useState<Set<string>>(new Set());

  const fetchIdRef = useRef(0);
  const resultRef = useRef<CostPreviewResult | null>(null);

  // useSequencer recreates the plan OBJECT on every status transition while the
  // plan's identity (id) and step ids are unchanged. Key effects on `planId` and
  // read the latest plan through a ref so a mid-execution status change does not
  // refetch and wipe a legitimate expired-quote block.
  const planRef = useRef(plan);
  planRef.current = plan;
  const planId = plan?.id ?? null;

  const fetchCost = useCallback(async () => {
    const plan = planRef.current;
    if (!plan || !walletAddress) return;

    const fetchId = ++fetchIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/sequencer/cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          walletAddress,
          currentApy,
          targetApy,
          borrowApy,
          supplyApy,
        }),
      });

      if (fetchId !== fetchIdRef.current) return;

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError((errData as { error?: string }).error || `Cost fetch failed: ${res.status}`);
        return;
      }

      const data = await res.json();
      const fetchedAt = new Date(data.quoteFetchedAt);
      if (Number.isNaN(fetchedAt.getTime())) {
        // A malformed timestamp would make every age comparison NaN (always
        // false), silently disabling expiry. Refuse it rather than present a
        // potentially-stale quote as executable.
        setError('Cost preview returned an invalid quote timestamp. Please retry.');
        return;
      }
      const parsed: CostPreviewResult = {
        ...data,
        quoteFetchedAt: fetchedAt,
      };
      setResult(parsed);
      resultRef.current = parsed;
      // Reset staleness on new fetch
      setStaleStepIds(new Set());
      setExpiredStepIds(new Set());
    } catch (err) {
      if (fetchId !== fetchIdRef.current) return;
      console.error('useSequenceCost fetch error:', err);
      setError('Could not load cost preview. Please retry.');
    } finally {
      if (fetchId === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
    // planId (not the plan object) keeps this stable across status transitions.
  }, [planId, walletAddress, currentApy, targetApy, borrowApy, supplyApy]);

  // Fetch on plan change
  useEffect(() => {
    fetchCost();
  }, [fetchCost]);

  // Staleness ticker — check every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const current = resultRef.current;
      const plan = planRef.current;
      if (!current || !plan) return;

      const { stale, expired } = computeQuoteStaleness(
        plan.steps,
        current.steps,
        current.quoteFetchedAt.getTime(),
        Date.now(),
      );

      setStaleStepIds(stale);
      setExpiredStepIds(expired);
    }, 5000);

    return () => clearInterval(interval);
  }, [planId]);

  const refetch = useCallback(() => {
    fetchCost();
  }, [fetchCost]);

  return {
    result,
    isLoading,
    error,
    staleStepIds,
    expiredStepIds,
    hasExpiredQuotes: expiredStepIds.size > 0,
    refetch,
  };
}
