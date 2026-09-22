import type { Membership } from '@/types/domain';

/**
 * What the app should show for a given (session, memberships) pair. Pure and
 * synchronous on purpose — all the actual Supabase I/O lives in
 * useAuth.tsx, which calls this to decide where to route.
 */
export type AppState =
  | { status: 'signed_out' }
  | { status: 'needs_family' }
  | { status: 'active'; membership: Membership };

/**
 * MVP has no multi-family UI (master spec section 26's child switcher is
 * about children within one family, not the parent themself belonging to
 * several). If a user somehow ends up with more than one membership, the
 * first one wins rather than the app crashing or picking arbitrarily.
 */
export function resolveAppState(hasSession: boolean, memberships: Membership[]): AppState {
  if (!hasSession) {
    return { status: 'signed_out' };
  }
  if (memberships.length === 0) {
    return { status: 'needs_family' };
  }
  return { status: 'active', membership: memberships[0] };
}
