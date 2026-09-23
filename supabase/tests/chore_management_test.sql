-- Phase 4 TDD list (master spec section 93): create chore, edit chore,
-- deactivate chore, amount validation, family isolation, child cannot edit
-- chore. Amount validation and basic family isolation/child-cannot-edit
-- are already covered by constraints_test.sql / permissions_test.sql /
-- family_isolation_test.sql — this file covers what's new in Phase 4:
-- schedule rows, deactivation, and the section 68 edge case (editing a
-- chore must never rewrite an already-created occurrence's snapshot).
BEGIN;
SELECT no_plan();

insert into auth.users (id) values
  ('90000000-0000-0000-0000-000000000001'), -- parent
  ('90000000-0000-0000-0000-000000000005'), -- the child's own account
  ('90000000-0000-0000-0000-000000000006'); -- an unrelated parent, different family

insert into public.families (id, name, created_by) values
  ('90000000-0000-0000-0000-000000000002', 'Test Family', '90000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000007', 'Other Family', '90000000-0000-0000-0000-000000000006');

insert into public.children (id, family_id, name)
  values ('90000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000002', 'Test Child');

insert into public.family_memberships (family_id, user_id, role, child_id) values
  ('90000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001', 'parent', null),
  ('90000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000005', 'child', '90000000-0000-0000-0000-000000000003'),
  ('90000000-0000-0000-0000-000000000007', '90000000-0000-0000-0000-000000000006', 'parent', null);

-- ==== As the parent: create a chore with a schedule ==========================
set local role authenticated;
set local request.jwt.claims to '{"sub": "90000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ insert into public.chores (id, family_id, child_id, name, amount_cents, recurrence_type)
     values ('90000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000003', 'Room tidy', 250, 'once_weekly') $$,
  'a parent can create a chore'
);

SELECT lives_ok(
  $$ insert into public.chore_schedule (chore_id, day_of_week) values ('90000000-0000-0000-0000-000000000004', 6) $$,
  'a parent can add that chore''s single once_weekly schedule day'
);

SELECT lives_ok(
  $$ insert into public.chores (id, family_id, child_id, name, amount_cents, recurrence_type)
     values ('90000000-0000-0000-0000-000000000008', '90000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000003', 'Dishwasher', 50, 'selected_days') $$,
  'a parent can create a second, selected_days chore'
);
SELECT lives_ok(
  $$ insert into public.chore_schedule (chore_id, day_of_week)
     values ('90000000-0000-0000-0000-000000000008', 1), ('90000000-0000-0000-0000-000000000008', 3), ('90000000-0000-0000-0000-000000000008', 5) $$,
  'a parent can add multiple selected_days schedule rows in one go'
);
SELECT is(
  (select count(*) from public.chore_schedule where chore_id = '90000000-0000-0000-0000-000000000008'),
  3::bigint,
  'all three selected_days rows were saved'
);

-- ==== Snapshot immutability on edit (section 68 / 42) =========================
-- Occurrence generation is Phase 5's job — there is still no client INSERT
-- policy on chore_occurrences (see Phase 2 migration comments), so this
-- fixture row is inserted as the unrestricted connection, same as every
-- other test file's fixtures, then the parent role resumes for the edit.
reset role;
insert into public.chore_occurrences (family_id, chore_id, child_id, scheduled_date, chore_name_snapshot, amount_cents_snapshot)
  values ('90000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000003', '2026-09-19', 'Room tidy', 250);

set local role authenticated;
set local request.jwt.claims to '{"sub": "90000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ update public.chores set name = 'Tidy the whole room', amount_cents = 400 where id = '90000000-0000-0000-0000-000000000004' $$,
  'a parent can edit a chore''s name and amount'
);

SELECT is(
  (select name from public.chores where id = '90000000-0000-0000-0000-000000000004'),
  'Tidy the whole room',
  'the chore''s current name reflects the edit'
);
SELECT is(
  (select chore_name_snapshot from public.chore_occurrences where chore_id = '90000000-0000-0000-0000-000000000004'),
  'Room tidy',
  'an existing occurrence''s name snapshot is untouched by the later edit'
);
SELECT is(
  (select amount_cents_snapshot from public.chore_occurrences where chore_id = '90000000-0000-0000-0000-000000000004'),
  250,
  'an existing occurrence''s amount snapshot is untouched by the later edit'
);

-- ==== Deactivation (section 43: archive, never delete) ========================
SELECT lives_ok(
  $$ update public.chores set active = false where id = '90000000-0000-0000-0000-000000000004' $$,
  'a parent can deactivate a chore'
);
SELECT is(
  (select active from public.chores where id = '90000000-0000-0000-0000-000000000004'),
  false,
  'the chore is marked inactive, not deleted'
);
SELECT is(
  (select count(*) from public.chore_occurrences where chore_id = '90000000-0000-0000-0000-000000000004'),
  1::bigint,
  'the deactivated chore''s historical occurrence still exists'
);

reset role;

-- ==== As the child: cannot create, edit, or deactivate =========================
set local role authenticated;
set local request.jwt.claims to '{"sub": "90000000-0000-0000-0000-000000000005", "role": "authenticated"}';

SELECT throws_ok(
  $$ insert into public.chores (family_id, child_id, name, amount_cents, recurrence_type)
     values ('90000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000003', 'Sneaky chore', 500, 'daily') $$,
  '42501',
  NULL,
  'a child cannot create a chore'
);

update public.chores set active = true where id = '90000000-0000-0000-0000-000000000004';
update public.chores set amount_cents = 99999 where id = '90000000-0000-0000-0000-000000000008';

reset role;

SELECT is(
  (select active from public.chores where id = '90000000-0000-0000-0000-000000000004'),
  false,
  'the child''s attempt to reactivate the chore had no effect'
);
SELECT is(
  (select amount_cents from public.chores where id = '90000000-0000-0000-0000-000000000008'),
  50,
  'the child''s attempt to change the amount had no effect'
);

-- ==== Cross-family: another family's parent cannot touch this chore ===========
set local role authenticated;
set local request.jwt.claims to '{"sub": "90000000-0000-0000-0000-000000000006", "role": "authenticated"}';

update public.chores set amount_cents = 1 where id = '90000000-0000-0000-0000-000000000008';
SELECT is(
  (select count(*) from public.chores where id = '90000000-0000-0000-0000-000000000008'),
  0::bigint,
  'a parent from a different family cannot even see this chore, let alone edit it'
);

reset role;

SELECT is(
  (select amount_cents from public.chores where id = '90000000-0000-0000-0000-000000000008'),
  50,
  'the other family''s parent''s edit attempt had no effect'
);

SELECT * FROM finish();
ROLLBACK;
