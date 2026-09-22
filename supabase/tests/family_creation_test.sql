-- Regression test for a real bug found while wiring up the app's
-- "create family" onboarding flow: Postgres checks the SELECT policy on
-- rows an INSERT ... RETURNING produces, not just the INSERT's WITH CHECK.
-- A brand new user creating their first family has no family_memberships
-- row yet, so the original "members can view their family" policy made
-- `INSERT INTO families ... RETURNING` fail outright — even though the
-- INSERT's own WITH CHECK was satisfied. Same issue, separately, for the
-- membership row itself. See migration
-- 20260922195345_fix_family_creation_return_visibility.sql.
BEGIN;
SELECT no_plan();

insert into auth.users (id) values ('e0000000-0000-0000-0000-000000000001');

set local role authenticated;
set local request.jwt.claims to '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- The exact shape of the app's createFamily() call: insert then read back
-- via RETURNING, before any membership row exists.
SELECT lives_ok(
  $$ insert into public.families (id, name, created_by)
     values ('e0000000-0000-0000-0000-000000000002', 'New Family', 'e0000000-0000-0000-0000-000000000001')
     returning id $$,
  'a brand new user (no membership yet) can create a family and read the row back via RETURNING'
);

SELECT lives_ok(
  $$ insert into public.family_memberships (family_id, user_id, role)
     values ('e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'parent')
     returning id $$,
  'the same user can then create their own parent membership and read it back via RETURNING'
);

-- And a normal follow-up SELECT (the actual fetchMembership() shape) also
-- works once both rows exist.
SELECT is(
  (select role from public.family_memberships where family_id = 'e0000000-0000-0000-0000-000000000002'),
  'parent',
  'the new membership is readable via a plain SELECT afterwards'
);

reset role;

SELECT * FROM finish();
ROLLBACK;
