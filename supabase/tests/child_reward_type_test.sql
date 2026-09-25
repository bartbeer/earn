-- Extra feature: a parent can choose whether a child earns euros or stars.
-- Defaults to 'currency', settable at creation, and changeable later only
-- while the child still has zero chores — once they have one (active or
-- not), the type locks, because chores/occurrences don't snapshot their own
-- reward_type and there's no safe way to reinterpret an existing
-- amount_cents across a unit change.
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

-- ==== Locked once a chore exists ==============================================
insert into public.chores (id, family_id, child_id, name, amount_cents, recurrence_type)
  values ('86000000-0000-0000-0000-000000000004', '86000000-0000-0000-0000-000000000002', '86000000-0000-0000-0000-000000000003', 'Room tidy', 250, 'once_weekly');

set local role authenticated;
set local request.jwt.claims to '{"sub": "86000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
  $$ update public.children set reward_type = 'stars' where id = '86000000-0000-0000-0000-000000000003' $$,
  'P0001',
  NULL,
  'once the child has a chore, changing reward_type is rejected — even by their own family''s parent'
);
reset role;

SELECT is(
  (select reward_type from public.children where id = '86000000-0000-0000-0000-000000000003'),
  'currency',
  'the reward_type is unchanged after the rejected attempt'
);

-- Deactivating the chore doesn't unlock it either — history in the old unit
-- still exists, the same as an active chore would.
set local role authenticated;
set local request.jwt.claims to '{"sub": "86000000-0000-0000-0000-000000000001", "role": "authenticated"}';
update public.chores set active = false where id = '86000000-0000-0000-0000-000000000004';

SELECT throws_ok(
  $$ update public.children set reward_type = 'stars' where id = '86000000-0000-0000-0000-000000000003' $$,
  'P0001',
  NULL,
  'reward_type stays locked even once the child''s only chore is deactivated, not just while active'
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
