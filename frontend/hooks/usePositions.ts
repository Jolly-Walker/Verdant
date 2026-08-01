'use client';

import { type PositionsState, usePositionsContext } from '@/components/positions/PositionsProvider';

/**
 * Reads portfolio positions.
 *
 * The data itself is owned by `PositionsProvider` (see
 * `components/positions/PositionsProvider.tsx`), so any number of consumers
 * under one provider share a single `/api/positions` request. The provider is
 * required — a consumer rendered outside one is a wiring bug, surfaced here.
 */
export function usePositions(): PositionsState {
  const shared = usePositionsContext();
  if (shared === null) {
    throw new Error('usePositions must be rendered inside a PositionsProvider');
  }
  return shared;
}
