'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Tracks a CSS media query, re-rendering when it flips (e.g. on resize).
 * Reads `window.matchMedia` synchronously, so callers must be client-only —
 * during SSR the server snapshot reports `false`.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onStoreChange);
      return () => mql.removeEventListener('change', onStoreChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
