'use client';

import { useSyncExternalStore } from 'react';

/** True on the client after hydration — avoids Privy/auth SSR mismatches. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}
