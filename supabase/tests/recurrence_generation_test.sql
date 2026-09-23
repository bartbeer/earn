-- Phase 5 TDD list (master spec section 93): daily recurrence, weekly
-- recurrence, selected days, duplicates, mid-week creation, schedule
-- edits, month/year boundaries, timezone behaviour.
BEGIN;
SELECT no_plan();

-- ==== week_start_containing: pure date math (no fixtures needed) ===========
-- Jan 1 2026 is a Thursday.
SELECT is(
  public.week_start_containing('2026-01-01'::date, 1),
  '2025-12-29'::date,
  'week_start_containing crosses a year boundary correctly (Monday start)'
);
SELECT is(
  public.week_start_containing('2026-01-01'::date, 0),
  '2025-12-28'::date,
  'week_start_containing works for a Sunday-start week too'
);
SELECT is(
  public.week_start_containing('2026-09-21'::date, 1),
  '2026-09-21'::date,
  'a Monday is its own week start'
);
-- Feb 1 2026 is a Sunday; the Monday-start week containing it begins Jan 26.
SELECT is(
  public.week_start_containing('2026-02-01'::date, 1),
  '2026-01-26'::date,
  'week_start_containing crosses a month boundary correctly'
);

-- ==== family_local_date: real timezone conversion, not naive UTC ===========
insert into auth.users (id) values ('82000000-0000-0000-0000-000000000001');
insert into public.families (id, name, created_by)
  values ('82000000-0000-0000-0000-000000000002', 'TZ Family', '82000000-0000-0000-0000-000000000001');
-- family_settings row auto-created with the default timezone, Europe/Brussels.

SELECT is(
  public.family_local_date('82000000-0000-0000-0000-000000000002', '2026-01-01 23:30:00+00'::timestamptz),
  '2026-01-02'::date,
  'family_local_date uses the family''s own timezone (Brussels, UTC+1 in January) — 23:30 UTC is already the next day locally'
);
SELECT is(
  public.family_local_date('82000000-0000-0000-0000-000000000002', '2026-07-01 22:30:00+00'::timestamptz),
  '2026-07-02'::date,
  'and correctly accounts for DST (Brussels is UTC+2 in July)'
);

-- ==== _generate_week_occurrences: the core generation logic =================
-- Fixed "as of" instant so the test is deterministic regardless of when it
-- runs: 2026-09-16 is a Wednesday; the Monday-start week is Sep 14 - Sep 20.
insert into auth.users (id) values ('80000000-0000-0000-0000-000000000001'); -- parent
insert into public.families (id, name, created_by)
  values ('80000000-0000-0000-0000-000000000002', 'Test Family', '80000000-0000-0000-0000-000000000001');
insert into public.children (id, family_id, name)
  values ('80000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000002', 'Test Child');
insert into public.family_memberships (family_id, user_id, role)
  values ('80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', 'parent');

-- Chores that already existed well before this week.
insert into public.chores (id, family_id, child_id, name, amount_cents, recurrence_type, created_at) values
  ('80000000-0000-0000-0000-000000000010', '80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000003', 'Clear table', 50, 'daily', '2026-01-01 00:00:00+00'),
  ('80000000-0000-0000-0000-000000000011', '80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000003', 'Room tidy', 250, 'once_weekly', '2026-01-01 00:00:00+00'),
  ('80000000-0000-0000-0000-000000000012', '80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000003', 'Dishwasher', 50, 'selected_days', '2026-01-01 00:00:00+00');
insert into public.chore_schedule (chore_id, day_of_week) values
  ('80000000-0000-0000-0000-000000000011', 6), -- Room tidy: Saturday
  ('80000000-0000-0000-0000-000000000012', 1), ('80000000-0000-0000-0000-000000000012', 3), ('80000000-0000-0000-0000-000000000012', 5); -- Dishwasher: Mon/Wed/Fri

-- A chore created mid-week, on the "as of" day itself.
insert into public.chores (id, family_id, child_id, name, amount_cents, recurrence_type, created_at)
  values ('80000000-0000-0000-0000-000000000013', '80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000003', 'New chore', 75, 'selected_days', '2026-09-16 08:00:00+02');
insert into public.chore_schedule (chore_id, day_of_week) values
  ('80000000-0000-0000-0000-000000000013', 1), ('80000000-0000-0000-0000-000000000013', 3), ('80000000-0000-0000-0000-000000000013', 5); -- Mon/Wed/Fri

SELECT lives_ok(
  $$ select public._generate_week_occurrences('80000000-0000-0000-0000-000000000002', '2026-09-16 12:00:00+02') $$,
  'generation runs without error for a normal week'
);

SELECT is(
  (select count(*) from public.chore_occurrences where chore_id = '80000000-0000-0000-0000-000000000010'),
  7::bigint,
  'daily recurrence: one occurrence per day of the week'
);

SELECT is(
  (select count(*) from public.chore_occurrences where chore_id = '80000000-0000-0000-0000-000000000011'),
  1::bigint,
  'weekly recurrence: exactly one occurrence'
);
SELECT is(
  (select scheduled_date from public.chore_occurrences where chore_id = '80000000-0000-0000-0000-000000000011'),
  '2026-09-19'::date,
  'the weekly occurrence lands on the configured Saturday'
);

SELECT is(
  (select count(*) from public.chore_occurrences where chore_id = '80000000-0000-0000-0000-000000000012'),
  3::bigint,
  'selected days: one occurrence per chosen weekday'
);
SELECT is(
  (select array_agg(scheduled_date order by scheduled_date) from public.chore_occurrences where chore_id = '80000000-0000-0000-0000-000000000012'),
  array['2026-09-14'::date, '2026-09-16'::date, '2026-09-18'::date],
  'the selected-days occurrences land on Mon/Wed/Fri specifically'
);

SELECT is(
  (select count(*) from public.chore_occurrences where chore_id = '80000000-0000-0000-0000-000000000013'),
  2::bigint,
  'mid-week creation: only occurrences from the chore''s creation date onward'
);
SELECT is(
  (select count(*) from public.chore_occurrences where chore_id = '80000000-0000-0000-0000-000000000013' and scheduled_date = '2026-09-14'),
  0::bigint,
  'mid-week creation: no occurrence is backdated to before the chore existed'
);

SELECT is(
  (select maximum_cents from public.weekly_allowances where child_id = '80000000-0000-0000-0000-000000000003' and week_start = '2026-09-14'),
  900,
  'weekly_allowances.maximum_cents reflects everything generated (350 + 250 + 150 + 150)'
);

-- ==== duplicates: re-running generation must not create extra rows =========
SELECT lives_ok(
  $$ select public._generate_week_occurrences('80000000-0000-0000-0000-000000000002', '2026-09-16 12:00:00+02') $$,
  'generation can be safely re-run with the same as-of instant'
);
SELECT is(
  (select count(*) from public.chore_occurrences where family_id = '80000000-0000-0000-0000-000000000002'),
  13::bigint,
  'no duplicate occurrences after re-running generation (7 + 1 + 3 + 2, unchanged)'
);

-- ==== schedule edits: a newly added day is picked up on the next run =======
insert into public.chore_schedule (chore_id, day_of_week)
  values ('80000000-0000-0000-0000-000000000011', 0); -- Room tidy also now on Sunday
SELECT lives_ok(
  $$ select public._generate_week_occurrences('80000000-0000-0000-0000-000000000002', '2026-09-16 12:00:00+02') $$,
  'generation can be re-run after a schedule edit'
);
SELECT is(
  (select count(*) from public.chore_occurrences where chore_id = '80000000-0000-0000-0000-000000000011'),
  2::bigint,
  'adding a day to the schedule and re-running generation adds the new occurrence'
);
SELECT is(
  (select count(*) from public.chore_occurrences where chore_id = '80000000-0000-0000-0000-000000000011' and scheduled_date = '2026-09-20'),
  1::bigint,
  'the newly added Sunday occurrence lands on the correct date within the week'
);

-- ==== generate_current_week_occurrences: the public wrapper =================
insert into auth.users (id) values
  ('81000000-0000-0000-0000-000000000001'), -- parent, family member
  ('81000000-0000-0000-0000-000000000002'); -- unrelated user, no membership anywhere
insert into public.families (id, name, created_by)
  values ('81000000-0000-0000-0000-000000000003', 'Wrapper Family', '81000000-0000-0000-0000-000000000001');
insert into public.children (id, family_id, name)
  values ('81000000-0000-0000-0000-000000000004', '81000000-0000-0000-0000-000000000003', 'Child');
insert into public.family_memberships (family_id, user_id, role)
  values ('81000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000001', 'parent');
insert into public.chores (id, family_id, child_id, name, amount_cents, recurrence_type)
  values ('81000000-0000-0000-0000-000000000005', '81000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000004', 'Feed the cat', 50, 'daily');

set local role authenticated;
set local request.jwt.claims to '{"sub": "81000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SELECT throws_ok(
  $$ select public.generate_current_week_occurrences('81000000-0000-0000-0000-000000000003') $$,
  'P0001',
  NULL,
  'a user who is not a member of the family cannot trigger generation for it'
);
reset role;

SELECT is(
  (select count(*) from public.chore_occurrences where family_id = '81000000-0000-0000-0000-000000000003'),
  0::bigint,
  'the denied attempt generated nothing'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "81000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT lives_ok(
  $$ select public.generate_current_week_occurrences('81000000-0000-0000-0000-000000000003') $$,
  'a real family member can trigger generation for their own family'
);
reset role;

SELECT ok(
  (select count(*) from public.chore_occurrences where family_id = '81000000-0000-0000-0000-000000000003') > 0,
  'the family member''s call actually generated occurrences'
);

SELECT * FROM finish();
ROLLBACK;
