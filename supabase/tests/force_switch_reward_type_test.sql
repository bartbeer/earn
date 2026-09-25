-- force_switch_child_reward_type: an explicit, destructive override of the
-- ordinary reward-type lock (see child_reward_type_test.sql for the normal,
-- non-destructive path). Requested directly: "even if the chore is done, I
-- need to be able to switch... all finished chores in history can be
-- removed permanently for this child." One boundary stays absolute even
-- here: a paid week is never deleted.
BEGIN;
SELECT no_plan();

insert into auth.users (id) values
  ('87000000-0000-0000-0000-000000000001'), -- parent
  ('87000000-0000-0000-0000-000000000005'), -- the child's own account
  ('87000000-0000-0000-0000-000000000006'); -- an unrelated parent, different family

insert into public.families (id, name, created_by) values
  ('87000000-0000-0000-0000-000000000002', 'Test Family', '87000000-0000-0000-0000-000000000001'),
  ('87000000-0000-0000-0000-000000000008', 'Other Family', '87000000-0000-0000-0000-000000000006');

insert into public.children (id, family_id, name, reward_type)
  values ('87000000-0000-0000-0000-000000000003', '87000000-0000-0000-0000-000000000002', 'Test Child', 'stars');

insert into public.family_memberships (family_id, user_id, role, child_id) values
  ('87000000-0000-0000-0000-000000000002', '87000000-0000-0000-0000-000000000001', 'parent', null),
  ('87000000-0000-0000-0000-000000000002', '87000000-0000-0000-0000-000000000005', 'child', '87000000-0000-0000-0000-000000000003'),
  ('87000000-0000-0000-0000-000000000008', '87000000-0000-0000-0000-000000000006', 'parent', null);

-- One active chore plus a completed, unpaid occurrence — exactly what
-- blocks the ordinary (non-destructive) switch.
insert into public.chores (id, family_id, child_id, name, amount_cents, recurrence_type, created_at)
  values ('87000000-0000-0000-0000-000000000004', '87000000-0000-0000-0000-000000000002', '87000000-0000-0000-0000-000000000003', 'Tester', 2, 'daily', '2026-01-01 00:00:00+00');
select public._generate_week_occurrences('87000000-0000-0000-0000-000000000002', '2026-09-25 12:00:00+02');
update public.chore_occurrences set status = 'completed', completed_at = now()
  where chore_id = '87000000-0000-0000-0000-000000000004' and scheduled_date = '2026-09-25';

-- ==== The ordinary switch is blocked, confirming the setup =====================
set local role authenticated;
set local request.jwt.claims to '{"sub": "87000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT throws_ok(
  $$ update public.children set reward_type = 'currency' where id = '87000000-0000-0000-0000-000000000003' $$,
  'P0001',
  NULL,
  'sanity check: the ordinary switch is blocked while an active chore and a completed occurrence exist'
);
reset role;

-- ==== A child cannot force-switch, nor can another family's parent ===========
set local role authenticated;
set local request.jwt.claims to '{"sub": "87000000-0000-0000-0000-000000000005", "role": "authenticated"}';
SELECT throws_ok(
  $$ select public.force_switch_child_reward_type('87000000-0000-0000-0000-000000000003', 'currency') $$,
  'P0001',
  NULL,
  'the child cannot force-switch their own reward type'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "87000000-0000-0000-0000-000000000006", "role": "authenticated"}';
SELECT throws_ok(
  $$ select public.force_switch_child_reward_type('87000000-0000-0000-0000-000000000003', 'currency') $$,
  'P0001',
  NULL,
  'a different family''s parent cannot force-switch this child either'
);
reset role;

SELECT is(
  (select reward_type from public.children where id = '87000000-0000-0000-0000-000000000003'),
  'stars',
  'reward_type is still unchanged after both unauthorized attempts'
);
SELECT is(
  (select count(*) from public.chore_occurrences where child_id = '87000000-0000-0000-0000-000000000003'),
  7::bigint,
  'and the history is still intact — unauthorized calls deleted nothing (7 daily occurrences for the week, one completed)'
);

-- ==== The family's own parent can force-switch, wiping history =============
set local role authenticated;
set local request.jwt.claims to '{"sub": "87000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT lives_ok(
  $$ select public.force_switch_child_reward_type('87000000-0000-0000-0000-000000000003', 'currency') $$,
  'the family''s own parent can force-switch, even with a completed occurrence on record'
);
reset role;

SELECT is(
  (select reward_type from public.children where id = '87000000-0000-0000-0000-000000000003'),
  'currency',
  'reward_type actually changed'
);
SELECT is(
  (select count(*) from public.chore_occurrences where child_id = '87000000-0000-0000-0000-000000000003'),
  0::bigint,
  'every occurrence for this child was deleted, completed or not'
);
SELECT is(
  (select count(*) from public.weekly_allowances where child_id = '87000000-0000-0000-0000-000000000003'),
  0::bigint,
  'weekly_allowances rows for this child were deleted too'
);
SELECT is(
  (select active from public.chores where id = '87000000-0000-0000-0000-000000000004'),
  false,
  'the previously-active chore was deactivated, not deleted (section 43 still applies to the chore definition itself)'
);

-- ==== A paid week is never deleted, even by force ==============================
insert into public.children (id, family_id, name, reward_type)
  values ('87000000-0000-0000-0000-000000000009', '87000000-0000-0000-0000-000000000002', 'Paid Kid', 'stars');
insert into public.weekly_allowances (family_id, child_id, week_start, week_end, maximum_cents, earned_cents, payment_status, paid_amount_cents, paid_at)
  values ('87000000-0000-0000-0000-000000000002', '87000000-0000-0000-0000-000000000009', '2026-09-14', '2026-09-20', 10, 10, 'paid', 10, now());

set local role authenticated;
set local request.jwt.claims to '{"sub": "87000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT throws_ok(
  $$ select public.force_switch_child_reward_type('87000000-0000-0000-0000-000000000009', 'currency') $$,
  'P0001',
  NULL,
  'force-switch refuses outright when a paid week exists — no override, even explicit, deletes a payment record'
);
reset role;

SELECT is(
  (select reward_type from public.children where id = '87000000-0000-0000-0000-000000000009'),
  'stars',
  'reward_type is unchanged'
);
SELECT is(
  (select count(*) from public.weekly_allowances where child_id = '87000000-0000-0000-0000-000000000009' and payment_status = 'paid'),
  1::bigint,
  'the paid week record still exists, untouched'
);

SELECT * FROM finish();
ROLLBACK;
