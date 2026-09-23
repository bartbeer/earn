-- Phase 6 TDD list (master spec section 93): complete occurrence, undo
-- completion, double tap, cross-child access, earned amount, maximum
-- amount, integer-cent correctness.
BEGIN;
SELECT no_plan();

insert into auth.users (id) values
  ('84000000-0000-0000-0000-000000000001'), -- parent
  ('84000000-0000-0000-0000-000000000005'), -- child A's own account
  ('84000000-0000-0000-0000-000000000006'), -- child B's own account
  ('84000000-0000-0000-0000-000000000007'); -- an unrelated stranger, no membership anywhere

insert into public.families (id, name, created_by)
  values ('84000000-0000-0000-0000-000000000002', 'Test Family', '84000000-0000-0000-0000-000000000001');

insert into public.children (id, family_id, name) values
  ('84000000-0000-0000-0000-000000000003', '84000000-0000-0000-0000-000000000002', 'Child A'),
  ('84000000-0000-0000-0000-000000000004', '84000000-0000-0000-0000-000000000002', 'Child B');

insert into public.family_memberships (family_id, user_id, role, child_id) values
  ('84000000-0000-0000-0000-000000000002', '84000000-0000-0000-0000-000000000001', 'parent', null),
  ('84000000-0000-0000-0000-000000000002', '84000000-0000-0000-0000-000000000005', 'child', '84000000-0000-0000-0000-000000000003'),
  ('84000000-0000-0000-0000-000000000002', '84000000-0000-0000-0000-000000000006', 'child', '84000000-0000-0000-0000-000000000004');

insert into public.chores (id, family_id, child_id, name, amount_cents, recurrence_type, created_at)
  values ('84000000-0000-0000-0000-000000000010', '84000000-0000-0000-0000-000000000002', '84000000-0000-0000-0000-000000000003', 'Clear table', 50, 'daily', '2026-01-01 00:00:00+00');

-- Fixed "as of" instant, same convention as earlier Phase 5 tests:
-- 2026-09-16 is a Wednesday; the Monday-start week is Sep 14 - Sep 20.
select public._generate_week_occurrences('84000000-0000-0000-0000-000000000002', '2026-09-16 12:00:00+02');

-- ==== complete occurrence, earned amount ====================================
set local role authenticated;
set local request.jwt.claims to '{"sub": "84000000-0000-0000-0000-000000000005", "role": "authenticated"}';

SELECT lives_ok(
  $$ select public.set_occurrence_completion(
       (select id from public.chore_occurrences where chore_id = '84000000-0000-0000-0000-000000000010' and scheduled_date = '2026-09-14'),
       true
     ) $$,
  'a child can mark their own occurrence completed'
);
reset role;

SELECT is(
  (select status from public.chore_occurrences where chore_id = '84000000-0000-0000-0000-000000000010' and scheduled_date = '2026-09-14'),
  'completed',
  'the occurrence status is now completed'
);
SELECT is(
  (select completed_by from public.chore_occurrences where chore_id = '84000000-0000-0000-0000-000000000010' and scheduled_date = '2026-09-14'),
  '84000000-0000-0000-0000-000000000005'::uuid,
  'completed_by records the child who did it'
);
SELECT ok(
  (select completed_at from public.chore_occurrences where chore_id = '84000000-0000-0000-0000-000000000010' and scheduled_date = '2026-09-14') is not null,
  'completed_at is set'
);
SELECT is(
  (select earned_cents from public.weekly_allowances where child_id = '84000000-0000-0000-0000-000000000003' and week_start = '2026-09-14'),
  50,
  'earned amount reflects the one completed occurrence'
);
SELECT is(
  (select maximum_cents from public.weekly_allowances where child_id = '84000000-0000-0000-0000-000000000003' and week_start = '2026-09-14'),
  350,
  'maximum amount is unaffected by completing an occurrence'
);

-- ==== undo completion =========================================================
set local role authenticated;
set local request.jwt.claims to '{"sub": "84000000-0000-0000-0000-000000000005", "role": "authenticated"}';
SELECT lives_ok(
  $$ select public.set_occurrence_completion(
       (select id from public.chore_occurrences where chore_id = '84000000-0000-0000-0000-000000000010' and scheduled_date = '2026-09-14'),
       false
     ) $$,
  'a child can undo their own completion'
);
reset role;

SELECT is(
  (select status from public.chore_occurrences where chore_id = '84000000-0000-0000-0000-000000000010' and scheduled_date = '2026-09-14'),
  'pending',
  'the occurrence is back to pending'
);
SELECT ok(
  (select completed_at from public.chore_occurrences where chore_id = '84000000-0000-0000-0000-000000000010' and scheduled_date = '2026-09-14') is null,
  'completed_at is cleared on undo'
);
SELECT is(
  (select earned_cents from public.weekly_allowances where child_id = '84000000-0000-0000-0000-000000000003' and week_start = '2026-09-14'),
  0,
  'earned amount drops back to zero after undo'
);

-- ==== double tap: repeating the same completion call is a safe no-op ========
set local role authenticated;
set local request.jwt.claims to '{"sub": "84000000-0000-0000-0000-000000000005", "role": "authenticated"}';
SELECT lives_ok(
  $$ select public.set_occurrence_completion(
       (select id from public.chore_occurrences where chore_id = '84000000-0000-0000-0000-000000000010' and scheduled_date = '2026-09-14'),
       true
     ) $$,
  'complete once'
);
SELECT lives_ok(
  $$ select public.set_occurrence_completion(
       (select id from public.chore_occurrences where chore_id = '84000000-0000-0000-0000-000000000010' and scheduled_date = '2026-09-14'),
       true
     ) $$,
  'completing the same occurrence again (double tap) does not error'
);
SELECT lives_ok(
  $$ select public.set_occurrence_completion(
       (select id from public.chore_occurrences where chore_id = '84000000-0000-0000-0000-000000000010' and scheduled_date = '2026-09-14'),
       true
     ) $$,
  'and a third rapid repeat still does not error'
);
reset role;

SELECT is(
  (select count(*) from public.chore_occurrences where chore_id = '84000000-0000-0000-0000-000000000010' and scheduled_date = '2026-09-14'),
  1::bigint,
  'double tap creates no duplicate occurrence rows'
);
SELECT is(
  (select earned_cents from public.weekly_allowances where child_id = '84000000-0000-0000-0000-000000000003' and week_start = '2026-09-14'),
  50,
  'double tap never double-counts the earned amount (recomputed from source of truth, not incremented)'
);

-- ==== cross-child access ======================================================
set local role authenticated;
set local request.jwt.claims to '{"sub": "84000000-0000-0000-0000-000000000006", "role": "authenticated"}';
SELECT throws_ok(
  $$ select public.set_occurrence_completion(
       (select id from public.chore_occurrences where chore_id = '84000000-0000-0000-0000-000000000010' and scheduled_date = '2026-09-15'),
       true
     ) $$,
  'P0001',
  NULL,
  'child B cannot mark child A''s occurrence completed'
);
reset role;

SELECT is(
  (select status from public.chore_occurrences where chore_id = '84000000-0000-0000-0000-000000000010' and scheduled_date = '2026-09-15'),
  'pending',
  'child B''s denied attempt had no effect'
);

-- A stranger with no membership anywhere is denied too.
set local role authenticated;
set local request.jwt.claims to '{"sub": "84000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT throws_ok(
  $$ select public.set_occurrence_completion(
       (select id from public.chore_occurrences where chore_id = '84000000-0000-0000-0000-000000000010' and scheduled_date = '2026-09-15'),
       true
     ) $$,
  'P0001',
  NULL,
  'a user who is not a family member at all cannot touch any occurrence'
);
reset role;

-- ==== a parent can also correct completion (section 16) =====================
set local role authenticated;
set local request.jwt.claims to '{"sub": "84000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT lives_ok(
  $$ select public.set_occurrence_completion(
       (select id from public.chore_occurrences where chore_id = '84000000-0000-0000-0000-000000000010' and scheduled_date = '2026-09-14'),
       false
     ) $$,
  'a parent can correct (undo) a child''s completion'
);
reset role;

SELECT is(
  (select earned_cents from public.weekly_allowances where child_id = '84000000-0000-0000-0000-000000000003' and week_start = '2026-09-14'),
  0,
  'the parent''s correction is reflected in the earned amount'
);

-- ==== nonexistent occurrence ===================================================
set local role authenticated;
set local request.jwt.claims to '{"sub": "84000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT throws_ok(
  $$ select public.set_occurrence_completion('00000000-0000-0000-0000-000000000099', true) $$,
  'P0001',
  NULL,
  'toggling a nonexistent occurrence id fails cleanly'
);
reset role;

-- ==== integer-cent correctness with an odd amount ============================
insert into public.chores (id, family_id, child_id, name, amount_cents, recurrence_type, created_at)
  values ('84000000-0000-0000-0000-000000000011', '84000000-0000-0000-0000-000000000002', '84000000-0000-0000-0000-000000000003', 'Odd amount chore', 33, 'once_weekly', '2026-01-01 00:00:00+00');
insert into public.chore_schedule (chore_id, day_of_week) values ('84000000-0000-0000-0000-000000000011', 1); -- Monday
select public._generate_week_occurrences('84000000-0000-0000-0000-000000000002', '2026-09-16 12:00:00+02');

set local role authenticated;
set local request.jwt.claims to '{"sub": "84000000-0000-0000-0000-000000000005", "role": "authenticated"}';
SELECT lives_ok(
  $$ select public.set_occurrence_completion(
       (select id from public.chore_occurrences where chore_id = '84000000-0000-0000-0000-000000000011' and scheduled_date = '2026-09-14'),
       true
     ) $$,
  'completing an odd-cent-amount occurrence works'
);
reset role;

SELECT is(
  (select earned_cents from public.weekly_allowances where child_id = '84000000-0000-0000-0000-000000000003' and week_start = '2026-09-14'),
  33,
  'the odd amount (33 cents) is reflected exactly, no rounding drift'
);

-- ==== a paid week can never be toggled (sections 48-49) ======================
insert into public.chores (id, family_id, child_id, name, amount_cents, recurrence_type, created_at)
  values ('84000000-0000-0000-0000-000000000012', '84000000-0000-0000-0000-000000000002', '84000000-0000-0000-0000-000000000003', 'Old chore', 50, 'daily', '2025-01-01 00:00:00+00');
insert into public.chore_occurrences (family_id, chore_id, child_id, scheduled_date, chore_name_snapshot, amount_cents_snapshot, status)
  values ('84000000-0000-0000-0000-000000000002', '84000000-0000-0000-0000-000000000012', '84000000-0000-0000-0000-000000000003', '2026-09-08', 'Old chore', 50, 'pending');
insert into public.weekly_allowances (family_id, child_id, week_start, week_end, maximum_cents, earned_cents, payment_status, paid_amount_cents, paid_at)
  values ('84000000-0000-0000-0000-000000000002', '84000000-0000-0000-0000-000000000003', '2026-09-07', '2026-09-13', 50, 0, 'paid', 0, now());

set local role authenticated;
set local request.jwt.claims to '{"sub": "84000000-0000-0000-0000-000000000005", "role": "authenticated"}';
SELECT throws_ok(
  $$ select public.set_occurrence_completion(
       (select id from public.chore_occurrences where chore_id = '84000000-0000-0000-0000-000000000012' and scheduled_date = '2026-09-08'),
       true
     ) $$,
  'P0001',
  NULL,
  'an occurrence in an already-paid week cannot be toggled'
);
reset role;

SELECT is(
  (select status from public.chore_occurrences where chore_id = '84000000-0000-0000-0000-000000000012' and scheduled_date = '2026-09-08'),
  'pending',
  'the paid week''s occurrence is unaffected by the denied attempt'
);

SELECT * FROM finish();
ROLLBACK;
