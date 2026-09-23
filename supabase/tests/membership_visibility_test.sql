-- Regression test for a real bug found by hand-testing the app: in a
-- family with more than one member, a member's own family_memberships
-- query returned OTHER members' rows too, and the app's fetchMembership()
-- (which used .limit(1) with no filter or ordering) sometimes resolved to
-- someone else's role as a result — a child signing in could get treated
-- as a parent. See migration 20260923114930_narrow_membership_visibility.sql.
--
-- Every earlier test happened to use single-member-per-family fixtures, so
-- this never surfaced. This file specifically exercises a family with a
-- parent AND two children.
BEGIN;
SELECT no_plan();

insert into auth.users (id) values
  ('d0000000-0000-0000-0000-000000000001'), -- parent
  ('d0000000-0000-0000-0000-000000000002'), -- child 1 (Emma)
  ('d0000000-0000-0000-0000-000000000003'); -- child 2 (Lucas)

insert into public.families (id, name, created_by)
  values ('d0000000-0000-0000-0000-000000000004', 'Multi-member Family', 'd0000000-0000-0000-0000-000000000001');

insert into public.children (id, family_id, name) values
  ('d0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000004', 'Emma'),
  ('d0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000004', 'Lucas');

insert into public.family_memberships (family_id, user_id, role, child_id) values
  ('d0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 'parent', null),
  ('d0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', 'child', 'd0000000-0000-0000-0000-000000000005'),
  ('d0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000003', 'child', 'd0000000-0000-0000-0000-000000000006');

insert into public.profiles (id, display_name) values
  ('d0000000-0000-0000-0000-000000000001', 'The Parent'),
  ('d0000000-0000-0000-0000-000000000002', 'Emma'),
  ('d0000000-0000-0000-0000-000000000003', 'Lucas');

-- An unrelated user with a profile, in no family at all — must stay invisible.
insert into auth.users (id) values ('d0000000-0000-0000-0000-000000000099');
insert into public.profiles (id, display_name) values
  ('d0000000-0000-0000-0000-000000000099', 'Stranger');

-- As Emma (child 1): her own membership query must return exactly her own
-- row — the whole point of this test.
set local role authenticated;
set local request.jwt.claims to '{"sub": "d0000000-0000-0000-0000-000000000002", "role": "authenticated"}';

SELECT is(
  (select count(*) from public.family_memberships),
  1::bigint,
  'a child in a 3-member family sees exactly one membership row: their own'
);
SELECT is(
  (select role from public.family_memberships limit 1),
  'child',
  'the one row Emma sees has her own role, not the parent''s'
);
SELECT is(
  (select child_id from public.family_memberships limit 1),
  'd0000000-0000-0000-0000-000000000005'::uuid,
  'the one row Emma sees points at her own child_id, not her sibling''s'
);

-- Profile co-visibility still works despite the narrower membership policy
-- (fixed via shares_family_with(), not by re-widening family_memberships):
-- Emma should see her own, the parent's, and Lucas's profiles, but not an
-- unrelated stranger's.
SELECT is(
  (select count(*) from public.profiles),
  3::bigint,
  'Emma sees exactly her family''s three profiles (herself, parent, Lucas) despite the narrower membership policy'
);
SELECT is(
  (select count(*) from public.profiles where display_name = 'Stranger'),
  0::bigint,
  'Emma cannot see an unrelated user''s profile'
);

reset role;

-- As the parent: still sees only their own membership row too, not the
-- children's.
set local role authenticated;
set local request.jwt.claims to '{"sub": "d0000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT is(
  (select count(*) from public.family_memberships),
  1::bigint,
  'the parent also sees exactly one membership row: their own'
);
SELECT is(
  (select role from public.family_memberships limit 1),
  'parent',
  'the parent''s own row correctly shows role parent'
);

reset role;

SELECT * FROM finish();
ROLLBACK;
