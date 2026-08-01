'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { DEFAULT_MIN_USD_THRESHOLD } from '@/constants/settings';
import { useDemoPositions } from '@/hooks/useDemoPositions';
import { useWallet } from '@/hooks/useWallet';
import type { Position } from '@/types/position';

// process.env.NEXT_PUBLIC_DEMO_MODE is a build-time constant — it never changes
// between renders. Here it selects a *component type* rather than branching hook
// calls, so the demo and real providers never share a hook order.
const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

/** The value shared by `PositionsProvider` and returned by `usePositions()`. */
export interface PositionsState {
  positions: Position[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  totalValueUsd: number;
  totalRewardsUsd: number;
}

const PositionsContext = createContext<PositionsState | null>(null);

/**
 * Reads the shared positions state; `null` when no `PositionsProvider` is
 * mounted above the caller (`usePositions()` treats that as a wiring bug).
 */
export function usePositionsContext(): PositionsState | null {
  return useContext(PositionsContext);
}

/**
 * The `/api/positions` fetch itself. Exactly one instance should exist per
 * tree — `PositionsProvider` owns it. `/api/positions` is rate-limited to
 * 60 req/min (SPECS §19), so an un-deduped fetch-per-consumer self-inflicts
 * a 429 on dashboards with many positions.
 */
function usePositionsFetch(): PositionsState {
  const { evmAddress, solanaAddress, isConnected, isMounted } = useWallet();
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!isMounted || (!evmAddress && !solanaAddress) || !isConnected) {
      setPositions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const url = new URL('/api/positions', window.location.origin);
      if (evmAddress) url.searchParams.set('address', evmAddress);
      if (solanaAddress) url.searchParams.set('solana', solanaAddress);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      const allPositions = (data.positions || []) as Position[];

      // Filter out small balances based on threshold
      // This is currently hardcoded to a default constant but will eventually be a user setting
      const filteredPositions = allPositions.filter(
        (p) => p.amountUsd >= DEFAULT_MIN_USD_THRESHOLD,
      );
      setPositions(filteredPositions);
    } catch (err) {
      setError('Could not load positions. Using cached data.');
      console.error(err);
      // Keep previous positions as stale data
    } finally {
      setIsLoading(false);
    }
  }, [evmAddress, solanaAddress, isConnected, isMounted]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return useMemo(() => {
    const totalValueUsd = positions.reduce((sum, p) => sum + p.amountUsd, 0);
    const totalRewardsUsd = positions.reduce(
      (sum, p) => sum + p.claimableRewards.reduce((rs, r) => rs + r.amountUsd, 0),
      0,
    );

    return {
      positions,
      isLoading,
      error,
      refetch: fetchData,
      totalValueUsd,
      totalRewardsUsd,
    };
  }, [positions, isLoading, error, fetchData]);
}

function RealPositionsProvider({ children }: { children: ReactNode }) {
  const value = usePositionsFetch();
  return <PositionsContext.Provider value={value}>{children}</PositionsContext.Provider>;
}

function DemoPositionsProvider({ children }: { children: ReactNode }) {
  const value = useDemoPositions();
  return <PositionsContext.Provider value={value}>{children}</PositionsContext.Provider>;
}

/**
 * Performs the positions fetch once and shares it with every `usePositions()`
 * consumer below it. Mount it above anything that reads positions — the
 * dashboard mounts it around the whole page, modals included.
 */
export function PositionsProvider({ children }: { children: ReactNode }) {
  const Provider = IS_DEMO ? DemoPositionsProvider : RealPositionsProvider;
  return <Provider>{children}</Provider>;
}
