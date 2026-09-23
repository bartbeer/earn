import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { fetchChildren } from '@/lib/api/family';
import type { Child } from '@/types/domain';

interface UseFamilyChildrenResult {
  children: Child[];
  isLoading: boolean;
  error: Error | null;
  /** Re-fetches without needing a navigation focus event — e.g. right after deactivating a child on the same screen. */
  refetch: () => void;
}

/**
 * The active children for a family, shared by the Week/History/Settings/
 * chore-management screens. Refetches on focus (not just on mount) — a
 * plain useEffect here previously meant that adding a child and navigating
 * back to a screen already in the stack (which React Navigation refocuses
 * rather than remounts) never showed the new child anywhere.
 */
export function useFamilyChildren(familyId: string): UseFamilyChildrenResult {
  const [children, setChildren] = useState<Child[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(() => {
    // Empty familyId only happens for a render tick before the route guard
    // in _layout.tsx has settled on 'active' state — nothing to fetch yet.
    if (!familyId) return undefined;

    let isMounted = true;
    fetchChildren(familyId)
      .then((result) => {
        if (isMounted) {
          setChildren(result);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (isMounted) setError(err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [familyId]);

  useFocusEffect(load);

  return { children, isLoading, error, refetch: load };
}
