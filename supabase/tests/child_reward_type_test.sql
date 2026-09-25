-- Extra feature: a parent can choose whether a child earns euros or stars.
-- Defaults to 'currency', settable at creation, and changeable later —
-- locked only while the child has an active chore (which could still
-- generate an occurrence under the old unit) or any chore_occurrences row
-- at all (real recorded history in the old unit, which chores/occurrences
-- don't snapshot their own reward_type to protect against reinterpreting).
-- Deactivating the child's only chore before it's ever generated an
-- occurrence unlocks the type again — see the "unlocked again" case below,
-- which is a real bug reported by hand-testing (the original version of
-- this lock checked for any chores row at all, active or not, which was
-- too conservative).
BEGIN;
SELECT no_plan();

insert into auth.users (id) values
  ('86000000-0000-0000-0000-000000000001'), -- parent
  ('86000000-0000-0000-0000-000000000005'), -- the child's own account
  ('86000000-0000-0000-0000-000000000006'); -- an unrelated parent, different family

insert into public.families (id, name, created_by) values
  ('86000000-0000-0000-0000-000000000002', 'Test Family', '86000000-0000-0000-0000-000000000001'),
  ('86000000-0000-0000-0000-000000000008', 'Other Family', '86000000-0000-0000-0000-000000000006');

insert into public.children (id, family_id, name)
  values ('86000000-0000-0000-0000-000000000003', '86000000-0000-0000-0000-000000000002', 'Test Child');

insert into public.family_memberships (family_id, user_id, role, child_id) values
  ('86000000-0000-0000-0000-000000000002', '86000000-0000-0000-0000-000000000001', 'parent', null),
  ('86000000-0000-0000-0000-000000000002', '86000000-0000-0000-0000-000000000005', 'child', '86000000-0000-0000-0000-000000000003'),
  ('86000000-0000-0000-0000-000000000008', '86000000-0000-0000-0000-000000000006', 'parent', null);

-- ==== Defaults and creation-time choice =======================================
SELECT is(
  (select reward_type from public.children where id = '86000000-0000-0000-0000-000000000003'),
  'currency',
  'a child defaults to currency when no reward_type is given at creation'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "86000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ insert into public.children (id, family_id, name, reward_type)
     values ('86000000-0000-0000-0000-000000000009', '86000000-0000-0000-0000-000000000002', 'Star Kid', 'stars') $$,
  'a parent can create a child with reward_type stars directly'
);
SELECT is(
  (select reward_type from public.children where id = '86000000-0000-0000-0000-000000000009'),
  'stars',
  'the new child''s reward_type is stars, as given'
);

SELECT throws_ok(
  $$ insert into public.children (family_id, name, reward_type)
     values ('86000000-0000-0000-0000-000000000002', 'Bad Kid', 'dollars') $$,
  '23514',
  NULL,
  'an invalid reward_type is rejected by the check constraint'
);
reset role;

-- ==== Changing it later, while chore-less =====================================
set local role authenticated;
set local request.jwt.claims to '{"sub": "86000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$ update public.children set reward_type = 'stars' where id = '86000000-0000-0000-0000-000000000003' $$,
  'a parent can switch a chore-less child from currency to stars'
);
SELECT lives_ok(
  $$ update public.children set reward_type = 'currency' where id = '86000000-0000-0000-0000-000000000003' $$,
  'and switch back again, still chore-less'
);
reset role;

-- ==== Locked while a chore is active ===========================================
insert into public.chores (id, family_id, child_id, name, amount_cents, recurrence_type)
  values ('86000000-0000-0000-0000-000000000004', '86000000-0000-0000-0000-000000000002', '86000000-0000-0000-0000-000000000003', 'Room tidy', 250, 'once_weekly');

set local role authenticated;
set local request.jwt.claims to '{"sub": "86000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ update public.children set reward_type = 'stars' where id = '86000000-0000-0000-0000-000000000003' $$,
  'P0001',
  NULL,
  'while the child has an active chore, changing reward_type is rejected — even with zero occurrences generated yet'
);
reset role;

SELECT is(
  (select reward_type from public.children where id = '86000000-0000-0000-0000-000000000003'),
  'currency',
  'the reward_type is unchanged after the rejected attempt'
);

-- ==== Unlocked again once that chore is deactivated with no occurrences left ===
-- The reported scenario: add a chore, deactivate it before ever generating
-- or completing anything for it. The existing cleanup trigger removes its
-- pending occurrences, leaving zero actual history — reward_type should be
-- free to change again.
set local role authenticated;
set local request.jwt.claims to '{"sub": "86000000-0000-0000-0000-000000000001", "role": "authenticated"}';
update public.chores set active = false where id = '86000000-0000-0000-0000-000000000004';
reset role;

SELECT is(
  (select count(*) from public.chore_occurrences where chore_id = '86000000-0000-0000-0000-000000000004'),
  0::bigint,
  'sanity check: deactivating a never-generated chore leaves zero occurrences behind'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "86000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT lives_ok(
  $$ update public.children set reward_type = 'stars' where id = '86000000-0000-0000-0000-000000000003' $$,
  'deactivating the child''s only chore, with no occurrences ever generated, unlocks reward_type again'
);
reset role;

-- ==== Still locked if real history (a completed occurrence) exists ============
-- A fresh chore, this time actually generated and completed before being
-- deactivated — that earned amount is real recorded history, so switching
-- back must still be blocked even though the chore itself is inactive.
insert into public.chores (id, family_id, child_id, name, amount_cents, recurrence_type, created_at)
  values ('86000000-0000-0000-0000-000000000012', '86000000-0000-0000-0000-000000000002', '86000000-0000-0000-0000-000000000003', 'Dishwasher', 3, 'daily', '2026-01-01 00:00:00+00');
select public._generate_week_occurrences('86000000-0000-0000-0000-000000000002', '2026-09-16 12:00:00+02');
update public.chore_occurrences set status = 'completed', completed_at = now()
  where chore_id = '86000000-0000-0000-0000-000000000012' and scheduled_date = '2026-09-14';

set local role authenticated;
set local request.jwt.claims to '{"sub": "86000000-0000-0000-0000-000000000001", "role": "authenticated"}';
update public.chores set active = false where id = '86000000-0000-0000-0000-000000000012';

SELECT throws_ok(
  $$ update public.children set reward_type = 'currency' where id = '86000000-0000-0000-0000-000000000003' $$,
  'P0001',
  NULL,
  'a completed occurrence still blocks the switch even after its chore is deactivated — real earned history must never be silently reinterpreted'
);
reset role;

-- ==== A child cannot change their own reward_type, nor can another family's parent ====
set local role authenticated;
set local request.jwt.claims to '{"sub": "86000000-0000-0000-0000-000000000005", "role": "authenticated"}';
update public.children set reward_type = 'stars' where id = '86000000-0000-0000-0000-000000000009';
reset role;

SELECT is(
  (select reward_type from public.children where id = '86000000-0000-0000-0000-000000000009'),
  'stars',
  'a child''s attempt to change their own reward_type had no effect (still stars from creation, never touched)'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "86000000-0000-0000-0000-000000000006", "role": "authenticated"}';
update public.children set reward_type = 'currency' where id = '86000000-0000-0000-0000-000000000009';
reset role;

SELECT is(
  (select reward_type from public.children where id = '86000000-0000-0000-0000-000000000009'),
  'stars',
  'a different family''s parent cannot change this child''s reward_type either'
);

SELECT * FROM finish();
ROLLBACK;
