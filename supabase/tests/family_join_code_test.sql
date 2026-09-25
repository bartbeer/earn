-- Phase 9: the secure child join-code flow. rotate_family_join_code
-- (parent generates a code), resolve_family_join_code (anyone signed in
-- can look up what a code resolves to, before committing), and
-- join_family_as_child (the actual, re-validated write) — the only path
-- that's ever allowed to create a child-role family_memberships row.
BEGIN;
SELECT no_plan();

insert into auth.users (id) values
  ('89000000-0000-0000-0000-000000000001'), -- parent
  ('89000000-0000-0000-0000-000000000005'), -- an existing child's own account (already joined)
  ('89000000-0000-0000-0000-000000000006'), -- a brand-new user, no family yet — the one joining
  ('89000000-0000-0000-0000-000000000007'); -- an unrelated parent, different family

insert into public.families (id, name, created_by) values
  ('89000000-0000-0000-0000-000000000002', 'Test Family', '89000000-0000-0000-0000-000000000001'),
  ('89000000-0000-0000-0000-000000000009', 'Other Family', '89000000-0000-0000-0000-000000000007');

-- Emma already has an account and a membership; Lucas doesn't yet — Lucas
-- is who the new user should be able to claim.
insert into public.children (id, family_id, name) values
  ('89000000-0000-0000-0000-000000000003', '89000000-0000-0000-0000-000000000002', 'Emma'),
  ('89000000-0000-0000-0000-000000000004', '89000000-0000-0000-0000-000000000002', 'Lucas');

insert into public.family_memberships (family_id, user_id, role, child_id) values
  ('89000000-0000-0000-0000-000000000002', '89000000-0000-0000-0000-000000000001', 'parent', null),
  ('89000000-0000-0000-0000-000000000002', '89000000-0000-0000-0000-000000000005', 'child', '89000000-0000-0000-0000-000000000003'),
  ('89000000-0000-0000-0000-000000000009', '89000000-0000-0000-0000-000000000007', 'parent', null);

-- ==== rotate_family_join_code ===================================================
set local role authenticated;
set local request.jwt.claims to '{"sub": "89000000-0000-0000-0000-000000000005", "role": "authenticated"}';
SELECT throws_ok(
  $$ select public.rotate_family_join_code('89000000-0000-0000-0000-000000000002') $$,
  'P0001',
  NULL,
  'a child cannot rotate their family''s join code'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "89000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT throws_ok(
  $$ select public.rotate_family_join_code('89000000-0000-0000-0000-000000000002') $$,
  'P0001',
  NULL,
  'a different family''s parent cannot rotate this family''s join code'
);
reset role;

SELECT is(
  (select join_code_hash from public.families where id = '89000000-0000-0000-0000-000000000002'),
  NULL,
  'still no code set after both unauthorized attempts'
);

-- Captured into a temp table (rather than relying on lives_ok, which
-- doesn't expose the scalar it ran) since the rest of these tests need the
-- actual plaintext code, not just proof that rotation succeeded.
set local role authenticated;
set local request.jwt.claims to '{"sub": "89000000-0000-0000-0000-000000000001", "role": "authenticated"}';
create temporary table captured_code as
  select public.rotate_family_join_code('89000000-0000-0000-0000-000000000002') as code;
reset role;

SELECT ok(
  (select join_code_hash is not null from public.families where id = '89000000-0000-0000-0000-000000000002'),
  'a code hash is now stored'
);
SELECT ok(
  (select join_code_expires_at > now() + interval '23 hours' from public.families where id = '89000000-0000-0000-0000-000000000002'),
  'the code expires about 24 hours from now'
);

-- ==== resolve_family_join_code ==================================================
SELECT throws_ok(
  $$ select public.resolve_family_join_code('000000') $$,
  'P0001',
  NULL,
  'a made-up code resolves to nothing'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "89000000-0000-0000-0000-000000000006", "role": "authenticated"}';
SELECT is(
  (select count(*) from public.resolve_family_join_code((select code from captured_code))),
  1::bigint,
  'a brand-new user with no family yet can resolve the code, and it lists exactly one unclaimed child'
);
SELECT is(
  (select child_name from public.resolve_family_join_code((select code from captured_code)) limit 1),
  'Lucas',
  'the unclaimed child is Lucas — Emma is excluded because she''s already joined'
);
reset role;

-- An expired code resolves to nothing, even though the hash still matches.
update public.families set join_code_expires_at = now() - interval '1 minute'
  where id = '89000000-0000-0000-0000-000000000002';

set local role authenticated;
set local request.jwt.claims to '{"sub": "89000000-0000-0000-0000-000000000006", "role": "authenticated"}';
SELECT throws_ok(
  $$ select public.resolve_family_join_code((select code from captured_code)) $$,
  'P0001',
  NULL,
  'an expired code is rejected even though the hash still matches'
);
reset role;

-- Un-expire it for the join tests below.
update public.families set join_code_expires_at = now() + interval '24 hours'
  where id = '89000000-0000-0000-0000-000000000002';

-- ==== join_family_as_child =======================================================
set local role authenticated;
set local request.jwt.claims to '{"sub": "89000000-0000-0000-0000-000000000006", "role": "authenticated"}';

SELECT throws_ok(
  $$ select public.join_family_as_child((select code from captured_code), '89000000-0000-0000-0000-000000000003') $$,
  'P0001',
  NULL,
  'cannot join as Emma — she''s already claimed'
);

SELECT throws_ok(
  $$ select public.join_family_as_child('999999', '89000000-0000-0000-0000-000000000004') $$,
  'P0001',
  NULL,
  'a wrong code is rejected even naming a real, unclaimed child'
);

SELECT throws_ok(
  $$ select public.join_family_as_child((select code from captured_code), 'ffffffff-ffff-ffff-ffff-ffffffffffff') $$,
  'P0001',
  NULL,
  'a nonexistent child id is rejected'
);

SELECT lives_ok(
  $$ select public.join_family_as_child((select code from captured_code), '89000000-0000-0000-0000-000000000004') $$,
  'the new user can join as Lucas with a valid, unexpired code'
);
reset role;

SELECT is(
  (select role from public.family_memberships where child_id = '89000000-0000-0000-0000-000000000004'),
  'child',
  'a child-role membership was created for Lucas'
);
SELECT is(
  (select user_id from public.family_memberships where child_id = '89000000-0000-0000-0000-000000000004'),
  '89000000-0000-0000-0000-000000000006',
  'linked to the joining user''s own account'
);

-- Trying again (already has a membership now) must fail.
set local role authenticated;
set local request.jwt.claims to '{"sub": "89000000-0000-0000-0000-000000000006", "role": "authenticated"}';
SELECT throws_ok(
  $$ select public.join_family_as_child((select code from captured_code), '89000000-0000-0000-0000-000000000003') $$,
  'P0001',
  NULL,
  'a user who already belongs to a family cannot join another (or the same) one again'
);
reset role;

SELECT * FROM finish();
ROLLBACK;
