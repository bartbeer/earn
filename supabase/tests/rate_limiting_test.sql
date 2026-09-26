-- Phase 12: rate limiting on verify_parent_pin and the join-code
-- functions — both let a client guess a secret repeatedly, and both
-- migrations that introduced them explicitly flagged this as a known gap
-- at the time. security_attempts (and its three helper functions) has no
-- client-facing policy at all; only reachable through the public RPCs.
BEGIN;
SELECT no_plan();

insert into auth.users (id) values
  ('8b000000-0000-0000-0000-000000000001'), -- parent
  ('8b000000-0000-0000-0000-000000000006'), -- a new user, joining
  ('8b000000-0000-0000-0000-000000000007'); -- a second, unrelated new user

insert into public.families (id, name, created_by)
  values ('8b000000-0000-0000-0000-000000000002', 'Test Family', '8b000000-0000-0000-0000-000000000001');

insert into public.children (id, family_id, name)
  values ('8b000000-0000-0000-0000-000000000003', '8b000000-0000-0000-0000-000000000002', 'Lucas');

insert into public.family_memberships (family_id, user_id, role, child_id)
  values ('8b000000-0000-0000-0000-000000000002', '8b000000-0000-0000-0000-000000000001', 'parent', null);

-- ==== verify_parent_pin: 5 wrong guesses locks it for 15 minutes ==============
set local role authenticated;
set local request.jwt.claims to '{"sub": "8b000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT lives_ok(
  $$ select public.set_parent_pin('8b000000-0000-0000-0000-000000000002', '4242') $$,
  'the parent sets a PIN'
);

-- 4 wrong guesses: still allowed to keep guessing.
SELECT is(
  (select public.verify_parent_pin('8b000000-0000-0000-0000-000000000002', '0000')),
  false, 'wrong guess 1 of 5 — not locked yet'
);
SELECT is(
  (select public.verify_parent_pin('8b000000-0000-0000-0000-000000000002', '0000')),
  false, 'wrong guess 2 of 5 — not locked yet'
);
SELECT is(
  (select public.verify_parent_pin('8b000000-0000-0000-0000-000000000002', '0000')),
  false, 'wrong guess 3 of 5 — not locked yet'
);
SELECT is(
  (select public.verify_parent_pin('8b000000-0000-0000-0000-000000000002', '0000')),
  false, 'wrong guess 4 of 5 — not locked yet'
);
-- 5th wrong guess trips the lockout.
SELECT is(
  (select public.verify_parent_pin('8b000000-0000-0000-0000-000000000002', '0000')),
  false, 'wrong guess 5 of 5 — this one trips the lockout'
);

-- Now even the *correct* PIN is rejected outright while locked out.
SELECT throws_ok(
  $$ select public.verify_parent_pin('8b000000-0000-0000-0000-000000000002', '4242') $$,
  'P0001',
  NULL,
  'the correct PIN is rejected while locked out — not just wrong guesses'
);
reset role;

-- Expire the lockout directly (pgTAP can't fast-forward now()).
update public.security_attempts set locked_until = now() - interval '1 minute'
  where subject_type = 'parent_pin' and subject_key = '8b000000-0000-0000-0000-000000000002';

set local role authenticated;
set local request.jwt.claims to '{"sub": "8b000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT is(
  (select public.verify_parent_pin('8b000000-0000-0000-0000-000000000002', '4242')),
  true,
  'once the lockout has expired, the correct PIN verifies again'
);
reset role;

-- A successful verification resets the counter: this family should be
-- able to take 4 more wrong guesses before locking out again, not
-- immediately re-lock from a stale count.
set local role authenticated;
set local request.jwt.claims to '{"sub": "8b000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT is(
  (select public.verify_parent_pin('8b000000-0000-0000-0000-000000000002', '0000')),
  false, 'post-reset wrong guess 1 of 5 — counter genuinely restarted'
);
SELECT is(
  (select public.verify_parent_pin('8b000000-0000-0000-0000-000000000002', '4242')),
  true,
  'the correct PIN still verifies after just one post-reset wrong guess'
);
reset role;

-- ==== resolve_family_join_code / join_family_as_child: shared bucket per user ====
set local role authenticated;
set local request.jwt.claims to '{"sub": "8b000000-0000-0000-0000-000000000001", "role": "authenticated"}';
create temporary table captured_code as
  select public.rotate_family_join_code('8b000000-0000-0000-0000-000000000002') as code;
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "8b000000-0000-0000-0000-000000000006", "role": "authenticated"}';

-- Doesn't throw for a wrong code (see the migration's own comment: raising
-- in the same call as recording the failure would silently undo the
-- recording, since an uncaught exception rolls back the whole
-- transaction) — zero rows instead.
SELECT is(
  (select count(*) from public.resolve_family_join_code('000001')), 0::bigint, 'wrong code 1 of 10'
);
SELECT is(
  (select count(*) from public.resolve_family_join_code('000002')), 0::bigint, 'wrong code 2 of 10'
);
SELECT is(
  (select count(*) from public.resolve_family_join_code('000003')), 0::bigint, 'wrong code 3 of 10'
);
SELECT is(
  (select count(*) from public.resolve_family_join_code('000004')), 0::bigint, 'wrong code 4 of 10'
);
SELECT is(
  (select count(*) from public.resolve_family_join_code('000005')), 0::bigint, 'wrong code 5 of 10'
);
SELECT is(
  (select count(*) from public.resolve_family_join_code('000006')), 0::bigint, 'wrong code 6 of 10'
);
SELECT is(
  (select count(*) from public.resolve_family_join_code('000007')), 0::bigint, 'wrong code 7 of 10'
);
SELECT is(
  (select count(*) from public.resolve_family_join_code('000008')), 0::bigint, 'wrong code 8 of 10'
);
SELECT is(
  (select count(*) from public.resolve_family_join_code('000009')), 0::bigint, 'wrong code 9 of 10'
);
SELECT is(
  (select count(*) from public.resolve_family_join_code('000010')), 0::bigint,
  'wrong code 10 of 10 — this one trips the lockout'
);

-- Now even the real, correct, unexpired code is rejected outright.
SELECT throws_ok(
  $$ select public.resolve_family_join_code((select code from captured_code)) $$,
  'P0001',
  NULL,
  'the correct code is rejected while locked out — not just wrong guesses'
);

-- join_family_as_child shares the same bucket — also rejected outright.
SELECT throws_ok(
  $$ select public.join_family_as_child((select code from captured_code), '8b000000-0000-0000-0000-000000000003') $$,
  'P0001',
  NULL,
  'join_family_as_child is also locked out — the two functions share one bucket, not independent limits'
);
reset role;

-- A different user is completely unaffected by the first user's lockout.
set local role authenticated;
set local request.jwt.claims to '{"sub": "8b000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT is(
  (select count(*) from public.resolve_family_join_code((select code from captured_code))),
  1::bigint,
  'a different user can still resolve the real code — lockouts are per user, not global'
);
reset role;

-- Expire the first user's lockout directly.
update public.security_attempts set locked_until = now() - interval '1 minute'
  where subject_type = 'join_code' and subject_key = '8b000000-0000-0000-0000-000000000006';

set local role authenticated;
set local request.jwt.claims to '{"sub": "8b000000-0000-0000-0000-000000000006", "role": "authenticated"}';
SELECT is(
  (select public.join_family_as_child((select code from captured_code), '8b000000-0000-0000-0000-000000000003')),
  true,
  'once the lockout has expired, the correct code works again — and this success resets the counter too'
);
reset role;

-- ==== security_attempts has no client-facing access at all =====================
set local role authenticated;
set local request.jwt.claims to '{"sub": "8b000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT is(
  (select count(*) from public.security_attempts),
  0::bigint,
  'a family''s own parent cannot read security_attempts at all — no SELECT policy exists'
);
reset role;

SELECT * FROM finish();
ROLLBACK;
