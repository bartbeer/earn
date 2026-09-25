-- Regression test for a real bug found by hand-testing: deactivating a
-- chore correctly stopped it from generating NEW occurrences, but left
-- already-generated pending ones sitting on the child's Week screen for
-- the rest of the week. Section 43 ("archive, don't delete") is about
-- historical chore definitions/occurrences surviving a chore's
-- deactivation — it was never meant to keep showing a child undone work
-- the parent just said they don't need anymore.
--
-- Fix, implemented as a trigger (not app code) so it applies no matter
-- which client path flips active=false: deactivating a chore deletes its
-- PENDING occurrences (nothing earned yet, nothing lost) but leaves
-- COMPLETED ones alone (the child already did the work and it already
-- counted toward earned_cents — deactivating the chore must not claw that
-- back). A paid week is left untouched entirely, matching sections 48-49.
BEGIN;
SELECT no_plan();

insert into auth.users (id) values ('83000000-0000-0000-0000-000000000001');
insert into public.families (id, name, created_by)
  values ('83000000-0000-0000-0000-000000000002', 'Test Family', '83000000-0000-0000-0000-000000000001');
insert into public.children (id, family_id, name)
  values ('83000000-0000-0000-0000-000000000003', '83000000-0000-0000-0000-000000000002', 'Test Child');
insert into public.family_memberships (family_id, user_id, role)
  values ('83000000-0000-0000-0000-000000000002', '83000000-0000-0000-0000-000000000001', 'parent');

insert into public.chores (id, family_id, child_id, name, amount_cents, recurrence_type, created_at)
  values ('83000000-0000-0000-0000-000000000010', '83000000-0000-0000-0000-000000000002', '83000000-0000-0000-0000-000000000003', 'Clear table', 50, 'daily', '2026-01-01 00:00:00+00');

-- Fixed "as of" instant, same convention as recurrence_generation_test.sql:
-- 2026-09-16 is a Wednesday; the Monday-start week is Sep 14 - Sep 20.
select public._generate_week_occurrences('83000000-0000-0000-0000-000000000002', '2026-09-16 12:00:00+02');

update public.chore_occurrences set status = 'completed', completed_at = now()
  where chore_id = '83000000-0000-0000-0000-000000000010' and scheduled_date = '2026-09-14';
-- Re-run generation to sync weekly_allowances.earned_cents with that completion.
select public._generate_week_occurrences('83000000-0000-0000-0000-000000000002', '2026-09-16 12:00:00+02');

SELECT is(
  (select count(*) from public.chore_occurrences where chore_id = '83000000-0000-0000-0000-000000000010'),
  7::bigint,
  'sanity check: 7 daily occurrences exist before deactivation'
);
SELECT is(
  (select maximum_cents from public.weekly_allowances where child_id = '83000000-0000-0000-0000-000000000003' and week_start = '2026-09-14'),
  350,
  'sanity check: maximum reflects all 7 occurrences before deactivation'
);
SELECT is(
  (select earned_cents from public.weekly_allowances where child_id = '83000000-0000-0000-0000-000000000003' and week_start = '2026-09-14'),
  50,
  'sanity check: earned reflects the one completed occurrence'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "83000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT lives_ok(
  $$ update public.chores set active = false where id = '83000000-0000-0000-0000-000000000010' $$,
  'a parent can deactivate a chore'
);
reset role;

SELECT is(
  (select count(*) from public.chore_occurrences where chore_id = '83000000-0000-0000-0000-000000000010'),
  1::bigint,
  'deactivating the chore removes its pending occurrences, leaving only the completed one'
);
SELECT is(
  (select status from public.chore_occurrences where chore_id = '83000000-0000-0000-0000-000000000010'),
  'completed',
  'the one remaining occurrence is the completed one — the child keeps credit for it'
);
SELECT is(
  (select maximum_cents from public.weekly_allowances where child_id = '83000000-0000-0000-0000-000000000003' and week_start = '2026-09-14'),
  50,
  'maximum_cents shrinks to match what''s left after the cleanup'
);
SELECT is(
  (select earned_cents from public.weekly_allowances where child_id = '83000000-0000-0000-0000-000000000003' and week_start = '2026-09-14'),
  50,
  'earned_cents is unaffected by deactivation — already-earned money is never clawed back'
);

-- ==== A paid week must never be touched by this cleanup (sections 48-49) ====
insert into public.chores (id, family_id, child_id, name, amount_cents, recurrence_type, created_at)
  values ('83000000-0000-0000-0000-000000000011', '83000000-0000-0000-0000-000000000002', '83000000-0000-0000-0000-000000000003', 'Dishwasher', 50, 'daily', '2025-01-01 00:00:00+00');
insert into public.chore_occurrences (family_id, chore_id, child_id, scheduled_date, chore_name_snapshot, amount_cents_snapshot, status)
  values ('83000000-0000-0000-0000-000000000002', '83000000-0000-0000-0000-000000000011', '83000000-0000-0000-0000-000000000003', '2026-09-08', 'Dishwasher', 50, 'pending');
insert into public.weekly_allowances (family_id, child_id, week_start, week_end, maximum_cents, earned_cents, payment_status, paid_amount_cents, paid_at)
  values ('83000000-0000-0000-0000-000000000002', '83000000-0000-0000-0000-000000000003', '2026-09-07', '2026-09-13', 50, 0, 'paid', 0, now());

set local role authenticated;
set local request.jwt.claims to '{"sub": "83000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT lives_ok(
  $$ update public.chores set active = false where id = '83000000-0000-0000-0000-000000000011' $$,
  'a parent can deactivate a chore whose only occurrence is in an already-paid week'
);
reset role;

SELECT is(
  (select count(*) from public.chore_occurrences where chore_id = '83000000-0000-0000-0000-000000000011'),
  1::bigint,
  'the paid week''s pending occurrence is left alone, not deleted'
);
SELECT is(
  (select maximum_cents from public.weekly_allowances where child_id = '83000000-0000-0000-0000-000000000003' and week_start = '2026-09-07'),
  50,
  'the paid week''s maximum_cents is untouched by the cleanup'
);

-- ==== A week left with zero occurrences resets to zero, not a stale value ====
-- Regression: deactivating a chore that was the *only* source of a week's
-- occurrences deleted the pending ones but left maximum_cents/earned_cents
-- at their pre-deactivation value — the cleanup's weekly_allowances UPDATE
-- was guarded by "only touch weeks that still have some occurrence left",
-- which skips exactly the case that most needs updating: zero remaining.
insert into public.chores (id, family_id, child_id, name, amount_cents, recurrence_type, created_at)
  values ('83000000-0000-0000-0000-000000000013', '83000000-0000-0000-0000-000000000002', '83000000-0000-0000-0000-000000000003', 'Feed the cat', 30, 'daily', '2026-09-16 00:00:00+00');
select public._generate_week_occurrences('83000000-0000-0000-0000-000000000002', '2026-09-16 12:00:00+02');

SELECT is(
  (select maximum_cents from public.weekly_allowances where child_id = '83000000-0000-0000-0000-000000000003' and week_start = '2026-09-14'),
  50 + 30 * 5,
  'sanity check: maximum_cents grew to include this new chore''s occurrences (Wed-Sun, 5 days)'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "83000000-0000-0000-0000-000000000001", "role": "authenticated"}';
update public.chores set active = false where id = '83000000-0000-0000-0000-000000000013';
reset role;

SELECT is(
  (select count(*) from public.chore_occurrences where chore_id = '83000000-0000-0000-0000-000000000013'),
  0::bigint,
  'sanity check: this chore''s never-completed occurrences were all deleted'
);
SELECT is(
  (select maximum_cents from public.weekly_allowances where child_id = '83000000-0000-0000-0000-000000000003' and week_start = '2026-09-14'),
  50,
  'maximum_cents falls back to just the still-completed occurrence from earlier in this test, not a stale higher value'
);

SELECT * FROM finish();
ROLLBACK;
