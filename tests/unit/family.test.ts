import { joinFamilyAsChild, resolveFamilyJoinCode } from '@/lib/api/family';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));

const mockedRpc = supabase.rpc as jest.MockedFunction<typeof supabase.rpc>;

beforeEach(() => {
  mockedRpc.mockReset();
});

// Phase 12: resolve_family_join_code / join_family_as_child no longer throw
// for "the code doesn't resolve to anything" — they return zero rows /
// false instead, so that a rate-limit failure recorded moments earlier in
// the same call isn't silently undone by an uncaught exception rolling
// back the whole transaction (see the migration's own comment). These
// wrapper functions are what turn that back into a thrown error, so the
// rest of the app's existing try/catch call sites don't need to change.
describe('resolveFamilyJoinCode', () => {
  it('throws when the RPC returns zero rows (invalid or expired code)', async () => {
    mockedRpc.mockResolvedValue({ data: [], error: null } as never);

    await expect(resolveFamilyJoinCode('000000')).rejects.toThrow('Invalid or expired join code');
  });

  it('resolves with the family name and unclaimed children when rows come back', async () => {
    mockedRpc.mockResolvedValue({
      data: [
        { family_id: 'family-1', family_name: 'The Smiths', child_id: 'child-1', child_name: 'Lucas' },
      ],
      error: null,
    } as never);

    await expect(resolveFamilyJoinCode('123456')).resolves.toEqual({
      familyName: 'The Smiths',
      children: [{ id: 'child-1', name: 'Lucas' }],
    });
  });

  it('resolves with an empty children list when the code is valid but nobody is left to claim', async () => {
    mockedRpc.mockResolvedValue({
      data: [{ family_id: 'family-1', family_name: 'The Smiths', child_id: null, child_name: null }],
      error: null,
    } as never);

    await expect(resolveFamilyJoinCode('123456')).resolves.toEqual({
      familyName: 'The Smiths',
      children: [],
    });
  });

  it('propagates a real RPC error (e.g. rate-limited) as-is', async () => {
    mockedRpc.mockResolvedValue({
      data: null,
      error: new Error('Too many attempts. Try again in a few minutes.'),
    } as never);

    await expect(resolveFamilyJoinCode('123456')).rejects.toThrow('Too many attempts');
  });
});

describe('joinFamilyAsChild', () => {
  it('throws when the RPC returns false (invalid or expired code)', async () => {
    mockedRpc.mockResolvedValue({ data: false, error: null } as never);

    await expect(joinFamilyAsChild('000000', 'child-1')).rejects.toThrow(
      'Invalid or expired join code',
    );
  });

  it('resolves when the RPC returns true', async () => {
    mockedRpc.mockResolvedValue({ data: true, error: null } as never);

    await expect(joinFamilyAsChild('123456', 'child-1')).resolves.toBeUndefined();
  });

  it('propagates a real RPC error (e.g. already claimed) as-is', async () => {
    mockedRpc.mockResolvedValue({
      data: null,
      error: new Error('This child has already joined'),
    } as never);

    await expect(joinFamilyAsChild('123456', 'child-1')).rejects.toThrow(
      'This child has already joined',
    );
  });
});
