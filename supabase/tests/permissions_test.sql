-- Proves a child cannot perform parent-only actions, directly against the
-- database rather than trusting that the UI simply doesn't show the button
-- (master spec sections 7, 75, 85). Also proves the matching parent actions
-- still work, so these aren't just "nobody can do anything" false positives.
--
-- Note on style: RLS denies an UPDATE/DELETE by making the row invisible to
-- the USING clause, which affects 0 rows silently rather than raising an
-- error. throws_ok is used only for INSERT denials (a failed WITH CHECK on
-- a new row IS a hard error); UPDATE denials are proven by performing the
-- write, then switching back to an unrestricted role to confirm nothing
-- changed.
BEGIN;
SELECT no_plan();

-- Fixtures: one family with a parent and a child who has their own login. --
insert into auth.users (id) values
  ('a0000000-0000-0000-0000-000000000001'), -- parent
  ('a0000000-0000-0000-0000-000000000005'); -- the child's own account

insert into public.families (id, name, created_by)
  values ('a0000000-0000-0000-0000-000000000002', 'Test Family', 'a0000000-0000-0000-0000-000000000001');

insert into public.children (id, family_id, name)
  values ('a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'Test Child');

insert into public.family_memberships (family_id, user_id, role, child_id) values
  ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'parent', null),
  ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000005', 'child', 'a0000000-0000-0000-0000-000000000003');

insert into public.chores (id, family_id, child_id, name, amount_cents, recurrence_type)
  values ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'Room tidy', 250, 'once_weekly');

-- ==== As the child ==========================================================
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000005", "role": "authenticated"}';

-- Can view their own family's chore (children need this to see the Week screen).
SELECT is((select count(*) from public.chores), 1::bigint, 'the child can view their own chore');

-- Cannot create a chore.
SELECT throws_ok(
  $$ insert into public.chores (family_id, child_id, name, amount_cents, recurrence_type)
     values ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'Sneaky chore', 500, 'daily') $$,
  '42501',
  NULL,
  'a child cannot create a chore'
);

-- Cannot change a chore's amount (the core "don't let a child set their own pay" rule).
update public.chores set amount_cents = 99999 where id = 'a0000000-0000-0000-0000-000000000004';

-- Cannot add a sibling.
SELECT throws_ok(
  $$ insert into public.children (family_id, name)
     values ('a0000000-0000-0000-0000-000000000002', 'Sneaky sibling') $$,
  '42501',
  NULL,
  'a child cannot add another child'
);

-- Cannot edit their own (or any) child record.
update public.children set name = 'Renamed', active = false where id = 'a0000000-0000-0000-0000-000000000003';

-- Cannot change family settings.
update public.family_settings set currency = 'EUR', week_start_day = 0 where family_id = 'a0000000-0000-0000-0000-000000000002';

-- Cannot add a schedule row to an existing chore.
SELECT throws_ok(
  $$ insert into public.chore_schedule (chore_id, day_of_week)
     values ('a0000000-0000-0000-0000-000000000004', 3) $$,
  '42501',
  NULL,
  'a child cannot add a chore schedule entry'
);

-- Cannot self-promote by editing their own membership's role.
update public.family_memberships set role = 'parent', child_id = null
  where family_id = 'a0000000-0000-0000-0000-000000000002' and user_id = 'a0000000-0000-0000-0000-000000000005';

reset role;

-- ==== Back to an unrestricted connection: confirm nothing actually changed ==
SELECT is(
  (select amount_cents from public.chores where id = 'a0000000-0000-0000-0000-000000000004'),
  250,
  'the chore amount is unchanged after the child''s update attempt'
);
SELECT is(
  (select name from public.children where id = 'a0000000-0000-0000-0000-000000000003'),
  'Test Child',
  'the child''s name is unchanged after the child''s update attempt'
);
SELECT is(
  (select active from public.children where id = 'a0000000-0000-0000-0000-000000000003'),
  true,
  'the child''s active flag is unchanged after the child''s update attempt'
);
SELECT is(
  (select currency from public.family_settings where family_id = 'a0000000-0000-0000-0000-000000000002'),
  'EUR',
  'family settings currency is unchanged after the child''s update attempt'
);
SELECT is(
  (select week_start_day from public.family_settings where family_id = 'a0000000-0000-0000-0000-000000000002'),
  1::smallint,
  'family settings week_start_day is unchanged after the child''s update attempt (stayed at its default, 1)'
);
SELECT is(
  (select role from public.family_memberships where user_id = 'a0000000-0000-0000-0000-000000000005'),
  'child',
  'the child''s own membership role is unchanged after their self-promotion attempt'
);
SELECT is(
  (select count(*) from public.chore_schedule where chore_id = 'a0000000-0000-0000-0000-000000000004'),
  0::bigint,
  'no chore schedule row was actually added by the child'
);

-- ==== As the parent: the same actions succeed ===============================
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ insert into public.chores (family_id, child_id, name, amount_cents, recurrence_type)
     values ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'Dishwasher', 50, 'daily') $$,
  'a parent can create a chore'
);

SELECT lives_ok(
  $$ update public.chores set amount_cents = 300 where id = 'a0000000-0000-0000-0000-000000000004' $$,
  'a parent can change a chore''s amount'
);

SELECT lives_ok(
  $$ update public.family_settings set week_start_day = 0 where family_id = 'a0000000-0000-0000-0000-000000000002' $$,
  'a parent can change family settings'
);

reset role;

SELECT is(
  (select amount_cents from public.chores where id = 'a0000000-0000-0000-0000-000000000004'),
  300,
  'the parent''s amount change actually persisted'
);

SELECT * FROM finish();
ROLLBACK;
