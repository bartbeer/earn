import { resolveAppState } from '@/lib/authState';
import type { Membership } from '@/types/domain';

const parentMembership: Membership = {
  familyId: 'family-1',
  familyName: 'Michielsen',
  role: 'parent',
  childId: null,
};

const childMembership: Membership = {
  familyId: 'family-1',
  familyName: 'Michielsen',
  role: 'child',
  childId: 'child-1',
};

describe('resolveAppState', () => {
  it('is signed_out when there is no session, regardless of memberships', () => {
    expect(resolveAppState(false, [parentMembership])).toEqual({ status: 'signed_out' });
    expect(resolveAppState(false, [])).toEqual({ status: 'signed_out' });
  });

  it('is needs_family when signed in with no memberships', () => {
    expect(resolveAppState(true, [])).toEqual({ status: 'needs_family' });
  });

  it('is active with the parent membership when signed in as a parent', () => {
    expect(resolveAppState(true, [parentMembership])).toEqual({
      status: 'active',
      membership: parentMembership,
    });
  });

  it('is active with the child membership when signed in as a child', () => {
    expect(resolveAppState(true, [childMembership])).toEqual({
      status: 'active',
      membership: childMembership,
    });
  });

  it('picks the first membership when a user somehow has more than one (MVP has no multi-family UI)', () => {
    expect(resolveAppState(true, [parentMembership, childMembership])).toEqual({
      status: 'active',
      membership: parentMembership,
    });
  });
});
