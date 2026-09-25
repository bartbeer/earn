-- Phase 8: set_week_payment_status. "Mark as paid" was UI-only since
-- Phase 1-3 (history/[weekId].tsx) — this is the real backend write,
-- following set_occurrence_completion's pattern: the client can request
-- paid/not_paid, but the paid amount itself is always the server's own
-- current earned_cents, never client-supplied.
BEGIN;
SELECT no_plan();

insert into auth.users (id) values
  ('88000000-0000-0000-0000-000000000001'), -- parent
  ('88000000-0000-0000-0000-000000000005'), -- the child's own account
  ('88000000-0000-0000-0000-000000000006'); -- an unrelated parent, different family

insert into public.families (id, name, created_by) values
  ('88000000-0000-0000-0000-000000000002', 'Test Family', '88000000-0000-0000-0000-000000000001'),
  ('88000000-0000-0000-0000-000000000008', 'Other Family', '88000000-0000-0000-0000-000000000006');

insert into public.children (id, family_id, name)
  values ('88000000-0000-0000-0000-000000000003', '88000000-0000-0000-0000-000000000002', 'Test Child');

insert into public.family_memberships (family_id, user_id, role, child_id) values
  ('88000000-0000-0000-0000-000000000002', '88000000-0000-0000-0000-000000000001', 'parent', null),
  ('88000000-0000-0000-0000-000000000002', '88000000-0000-0000-0000-000000000005', 'child', '88000000-0000-0000-0000-000000000003'),
  ('88000000-0000-0000-0000-000000000008', '88000000-0000-0000-0000-000000000006', 'parent', null);

-- A real chore + real completions, generated for a week that's genuinely
-- in the past relative to the actual system clock — set_week_payment_status
-- uses now(), not a testable "as of" param, so this can't use a fixed
-- future-proof date the way other tests do. 2026-09-07 - 09-13 is safely
-- before this suite's real run date.
insert into public.chores (id, family_id, child_id, name, amount_cents, recurrence_type, created_at)
  values ('88000000-0000-0000-0000-000000000010', '88000000-0000-0000-0000-000000000002', '88000000-0000-0000-0000-000000000003', 'Clear table', 50, 'daily', '2026-01-01 00:00:00+00');
select public._generate_week_occurrences('88000000-0000-0000-0000-000000000002', '2026-09-09 12:00:00+02');
update public.chore_occurrences set status = 'completed', completed_at = now()
  where chore_id = '88000000-0000-0000-0000-000000000010' and scheduled_date in ('2026-09-07', '2026-09-08', '2026-09-09');
select public._generate_week_occurrences('88000000-0000-0000-0000-000000000002', '2026-09-09 12:00:00+02');

SELECT is(
  (select earned_cents from public.weekly_allowances where child_id = '88000000-0000-0000-0000-000000000003' and week_start = '2026-09-07'),
  150,
  'sanity check: 3 completed occurrences at 50 each'
);

-- ==== Authorization: a child cannot mark a week paid ==========================
set local role authenticated;
set local request.jwt.claims to '{"sub": "88000000-0000-0000-0000-000000000005", "role": "authenticated"}';
SELECT throws_ok(
  $$ select public.set_week_payment_status(
       (select id from public.weekly_allowances where child_id = '88000000-0000-0000-0000-000000000003' and week_start = '2026-09-07'),
       true
     ) $$,
  'P0001',
  NULL,
  'the child cannot mark their own week as paid'
);
reset role;

-- ==== Authorization: another family's parent cannot either ====================
set local role authenticated;
set local request.jwt.claims to '{"sub": "88000000-0000-0000-0000-000000000006", "role": "authenticated"}';
SELECT throws_ok(
  $$ select public.set_week_payment_status(
       (select id from public.weekly_allowances where child_id = '88000000-0000-0000-0000-000000000003' and week_start = '2026-09-07'),
       true
     ) $$,
  'P0001',
  NULL,
  'a different family''s parent cannot mark this week as paid'
);
reset role;

SELECT is(
  (select payment_status from public.weekly_allowances where child_id = '88000000-0000-0000-0000-000000000003' and week_start = '2026-09-07'),
  'not_paid',
  'still not paid after both unauthorized attempts'
);

-- ==== A week that hasn't ended yet cannot be marked paid =======================
insert into public.weekly_allowances (family_id, child_id, week_start, week_end, maximum_cents, earned_cents)
  values ('88000000-0000-0000-0000-000000000002', '88000000-0000-0000-0000-000000000003', '9999-01-06', '9999-01-12', 100, 50);

set local role authenticated;
set local request.jwt.claims to '{"sub": "88000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT throws_ok(
  $$ select public.set_week_payment_status(
       (select id from public.weekly_allowances where child_id = '88000000-0000-0000-0000-000000000003' and week_start = '9999-01-06'),
       true
     ) $$,
  'P0001',
  NULL,
  'a week that has not ended yet cannot be marked paid, even by the family''s own parent'
);
reset role;

-- ==== The family's own parent can mark an ended week paid, snapshotting the amount ====
set local role authenticated;
set local request.jwt.claims to '{"sub": "88000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT lives_ok(
  $$ select public.set_week_payment_status(
       (select id from public.weekly_allowances where child_id = '88000000-0000-0000-0000-000000000003' and week_start = '2026-09-07'),
       true
     ) $$,
  'the family''s own parent can mark an ended week as paid'
);
reset role;

SELECT is(
  (select payment_status from public.weekly_allowances where child_id = '88000000-0000-0000-0000-000000000003' and week_start = '2026-09-07'),
  'paid',
  'payment_status is now paid'
);
SELECT is(
  (select paid_amount_cents from public.weekly_allowances where child_id = '88000000-0000-0000-0000-000000000003' and week_start = '2026-09-07'),
  150,
  'paid_amount_cents snapshots the server''s own earned_cents at the moment of payment, not anything client-supplied'
);
SELECT isnt(
  (select paid_at from public.weekly_allowances where child_id = '88000000-0000-0000-0000-000000000003' and week_start = '2026-09-07'),
  NULL,
  'paid_at is set'
);

-- ==== Once paid, occurrence completion is frozen (integration with Phase 6) ===
SELECT throws_ok(
  $$ select public.set_occurrence_completion(
       (select id from public.chore_occurrences where chore_id = '88000000-0000-0000-0000-000000000010' and scheduled_date = '2026-09-10'),
       true
     ) $$,
  'P0001',
  NULL,
  'once this week is paid, its occurrences can no longer be toggled — set_occurrence_completion''s own paid-week guard applies'
);

-- ==== Undo re-opens the week ====================================================
set local role authenticated;
set local request.jwt.claims to '{"sub": "88000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT lives_ok(
  $$ select public.set_week_payment_status(
       (select id from public.weekly_allowances where child_id = '88000000-0000-0000-0000-000000000003' and week_start = '2026-09-07'),
       false
     ) $$,
  'the parent can undo payment'
);
reset role;

SELECT is(
  (select payment_status from public.weekly_allowances where child_id = '88000000-0000-0000-0000-000000000003' and week_start = '2026-09-07'),
  'not_paid',
  'payment_status is back to not_paid'
);
SELECT is(
  (select paid_amount_cents from public.weekly_allowances where child_id = '88000000-0000-0000-0000-000000000003' and week_start = '2026-09-07'),
  NULL,
  'paid_amount_cents is cleared'
);
SELECT is(
  (select paid_at from public.weekly_allowances where child_id = '88000000-0000-0000-0000-000000000003' and week_start = '2026-09-07'),
  NULL,
  'paid_at is cleared'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "88000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT lives_ok(
  $$ select public.set_occurrence_completion(
       (select id from public.chore_occurrences where chore_id = '88000000-0000-0000-0000-000000000010' and scheduled_date = '2026-09-10'),
       true
     ) $$,
  'undoing payment re-opens the week — its occurrences can be toggled again'
);
reset role;

SELECT * FROM finish();
ROLLBACK;
