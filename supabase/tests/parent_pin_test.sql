-- Phase 9: the Parent PIN — a local gate on Settings, not a second login.
-- set_parent_pin / verify_parent_pin / has_parent_pin / clear_parent_pin
-- are the only ways to touch family_security; the table itself has no
-- SELECT/UPDATE policy at all (see the migration's own comment on why —
-- the threat model here is specifically a child with legitimate app
-- access and unlimited time, for whom a 4-6 digit PIN's hash being
-- directly readable would be a real risk even hashed).
BEGIN;
SELECT no_plan();

insert into auth.users (id) values
  ('8a000000-0000-0000-0000-000000000001'), -- parent
  ('8a000000-0000-0000-0000-000000000005'), -- the child's own account
  ('8a000000-0000-0000-0000-000000000006'); -- an unrelated parent, different family

insert into public.families (id, name, created_by) values
  ('8a000000-0000-0000-0000-000000000002', 'Test Family', '8a000000-0000-0000-0000-000000000001'),
  ('8a000000-0000-0000-0000-000000000008', 'Other Family', '8a000000-0000-0000-0000-000000000006');

insert into public.children (id, family_id, name)
  values ('8a000000-0000-0000-0000-000000000003', '8a000000-0000-0000-0000-000000000002', 'Test Child');

insert into public.family_memberships (family_id, user_id, role, child_id) values
  ('8a000000-0000-0000-0000-000000000002', '8a000000-0000-0000-0000-000000000001', 'parent', null),
  ('8a000000-0000-0000-0000-000000000002', '8a000000-0000-0000-0000-000000000005', 'child', '8a000000-0000-0000-0000-000000000003'),
  ('8a000000-0000-0000-0000-000000000008', '8a000000-0000-0000-0000-000000000006', 'parent', null);

-- ==== has_parent_pin ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub": "8a000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT is(
  public.has_parent_pin('8a000000-0000-0000-0000-000000000002'),
  false,
  'no PIN set yet'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "8a000000-0000-0000-0000-000000000006", "role": "authenticated"}';
SELECT throws_ok(
  $$ select public.has_parent_pin('8a000000-0000-0000-0000-000000000002') $$,
  'P0001',
  NULL,
  'a non-member cannot even check whether another family has a PIN set'
);
reset role;

-- ==== set_parent_pin ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub": "8a000000-0000-0000-0000-000000000005", "role": "authenticated"}';
SELECT throws_ok(
  $$ select public.set_parent_pin('8a000000-0000-0000-0000-000000000002', '1234') $$,
  'P0001',
  NULL,
  'a child cannot set the parent PIN'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "8a000000-0000-0000-0000-000000000006", "role": "authenticated"}';
SELECT throws_ok(
  $$ select public.set_parent_pin('8a000000-0000-0000-0000-000000000002', '1234') $$,
  'P0001',
  NULL,
  'a different family''s parent cannot set this family''s PIN'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "8a000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT throws_ok(
  $$ select public.set_parent_pin('8a000000-0000-0000-0000-000000000002', '12') $$,
  'P0001',
  NULL,
  'a PIN shorter than 4 digits is rejected'
);
SELECT throws_ok(
  $$ select public.set_parent_pin('8a000000-0000-0000-0000-000000000002', '1234567') $$,
  'P0001',
  NULL,
  'a PIN longer than 6 digits is rejected'
);
SELECT throws_ok(
  $$ select public.set_parent_pin('8a000000-0000-0000-0000-000000000002', 'abcd') $$,
  'P0001',
  NULL,
  'a non-numeric PIN is rejected'
);
reset role;

-- Direct table check here and below (not through has_parent_pin, which
-- requires an authenticated family member to call — nothing is
-- set_local'd immediately after a reset role).
SELECT is(
  (select exists (select 1 from public.family_security where family_id = '8a000000-0000-0000-0000-000000000002' and parent_pin_hash is not null)),
  false,
  'still no PIN set after all the rejected attempts (no row at all yet, so this is false rather than null)'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "8a000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT lives_ok(
  $$ select public.set_parent_pin('8a000000-0000-0000-0000-000000000002', '4242') $$,
  'the family''s own parent can set a valid 4-digit PIN'
);
reset role;

SELECT is(
  (select exists (select 1 from public.family_security where family_id = '8a000000-0000-0000-0000-000000000002' and parent_pin_hash is not null)),
  true,
  'a PIN is now set'
);

-- ==== verify_parent_pin =========================================================
set local role authenticated;
set local request.jwt.claims to '{"sub": "8a000000-0000-0000-0000-000000000005", "role": "authenticated"}';
SELECT throws_ok(
  $$ select public.verify_parent_pin('8a000000-0000-0000-0000-000000000002', '4242') $$,
  'P0001',
  NULL,
  'a child cannot verify the parent PIN either'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "8a000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT is(
  (select public.verify_parent_pin('8a000000-0000-0000-0000-000000000002', '4242')),
  true,
  'the correct PIN verifies'
);
SELECT is(
  (select public.verify_parent_pin('8a000000-0000-0000-0000-000000000002', '0000')),
  false,
  'a wrong PIN does not verify (returns false, not an error — this is a routine wrong guess, not an authorization failure)'
);
reset role;

-- ==== Changing the PIN invalidates the old one ==================================
set local role authenticated;
set local request.jwt.claims to '{"sub": "8a000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT lives_ok(
  $$ select public.set_parent_pin('8a000000-0000-0000-0000-000000000002', '9999') $$,
  'the parent can change the PIN'
);
SELECT is(
  (select public.verify_parent_pin('8a000000-0000-0000-0000-000000000002', '4242')),
  false,
  'the old PIN no longer verifies'
);
SELECT is(
  (select public.verify_parent_pin('8a000000-0000-0000-0000-000000000002', '9999')),
  true,
  'the new PIN verifies'
);
reset role;

-- ==== clear_parent_pin ===========================================================
set local role authenticated;
set local request.jwt.claims to '{"sub": "8a000000-0000-0000-0000-000000000006", "role": "authenticated"}';
SELECT throws_ok(
  $$ select public.clear_parent_pin('8a000000-0000-0000-0000-000000000002') $$,
  'P0001',
  NULL,
  'a different family''s parent cannot clear this family''s PIN'
);
reset role;

-- Direct table check (not through has_parent_pin, which now requires an
-- authenticated family member to call — nothing is set_local'd here).
SELECT is(
  (select exists (select 1 from public.family_security where family_id = '8a000000-0000-0000-0000-000000000002' and parent_pin_hash is not null)),
  true,
  'still set after the unauthorized clear attempt'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "8a000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT lives_ok(
  $$ select public.clear_parent_pin('8a000000-0000-0000-0000-000000000002') $$,
  'the family''s own parent can clear the PIN'
);
SELECT is(
  (select public.has_parent_pin('8a000000-0000-0000-0000-000000000002')),
  false,
  'no PIN set anymore'
);
SELECT is(
  (select public.verify_parent_pin('8a000000-0000-0000-0000-000000000002', 'anything')),
  true,
  'with no PIN set, verification passes regardless of input — nothing to gate'
);
reset role;

SELECT * FROM finish();
ROLLBACK;
