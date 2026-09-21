-- Local development seed data (master spec sections 38-40). Run automatically
-- by `supabase db reset`. Creates the Michielsen family with three real,
-- login-capable accounts (Parent/Emma/Lucas — all password "password123")
-- plus enough chore/occurrence/history data that every screen has something
-- to show immediately after a fresh reset.
--
-- Week dates are computed from CURRENT_DATE rather than hardcoded, so the
-- "current week" always actually looks current whenever the DB is reset —
-- the same approach src/lib/mockData.ts uses on the frontend.

-- ---------------------------------------------------------------------------
-- Auth users (parent + two children, all password-auth for easy local
-- testing). Real child onboarding via join code / anonymous auth is a
-- Phase 9 concern — these seeded accounts exist purely for local dev.
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'f0000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'parent@earn.app',
    crypt('password123', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'f0000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'emma@earn.app',
    crypt('password123', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'f0000000-0000-0000-0000-000000000003',
    'authenticated', 'authenticated', 'lucas@earn.app',
    crypt('password123', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''
  );

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values
  (gen_random_uuid(), 'f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001',
   jsonb_build_object('sub', 'f0000000-0000-0000-0000-000000000001', 'email', 'parent@earn.app'), 'email', now(), now(), now()),
  (gen_random_uuid(), 'f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002',
   jsonb_build_object('sub', 'f0000000-0000-0000-0000-000000000002', 'email', 'emma@earn.app'), 'email', now(), now(), now()),
  (gen_random_uuid(), 'f0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000003',
   jsonb_build_object('sub', 'f0000000-0000-0000-0000-000000000003', 'email', 'lucas@earn.app'), 'email', now(), now(), now());

insert into public.profiles (id, display_name) values
  ('f0000000-0000-0000-0000-000000000001', 'Parent'),
  ('f0000000-0000-0000-0000-000000000002', 'Emma'),
  ('f0000000-0000-0000-0000-000000000003', 'Lucas');

-- ---------------------------------------------------------------------------
-- Family, children, memberships
-- ---------------------------------------------------------------------------

insert into public.families (id, name, created_by) values
  ('f0000000-0000-0000-0000-000000000010', 'Michielsen', 'f0000000-0000-0000-0000-000000000001');
-- family_settings row is created automatically by the families insert trigger.
-- join_code_hash is left null — join-code generation is a Phase 9 feature.

insert into public.children (id, family_id, profile_id, name) values
  ('f0000000-0000-0000-0000-000000000011', 'f0000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000002', 'Emma'),
  ('f0000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000003', 'Lucas');

insert into public.family_memberships (family_id, user_id, role, child_id) values
  ('f0000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000001', 'parent', null),
  ('f0000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000002', 'child', 'f0000000-0000-0000-0000-000000000011'),
  ('f0000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000003', 'child', 'f0000000-0000-0000-0000-000000000012');

-- ---------------------------------------------------------------------------
-- Chores (section 38)
-- ---------------------------------------------------------------------------

insert into public.chores (id, family_id, child_id, name, amount_cents, recurrence_type) values
  ('f0000000-0000-0000-0000-000000000021', 'f0000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000011', 'Room tidy', 250, 'once_weekly'),
  ('f0000000-0000-0000-0000-000000000022', 'f0000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000011', 'Dishwasher', 50, 'selected_days'),
  ('f0000000-0000-0000-0000-000000000023', 'f0000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000011', 'Clear table', 50, 'daily'),
  ('f0000000-0000-0000-0000-000000000024', 'f0000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000011', 'Laundry', 150, 'once_weekly'),
  ('f0000000-0000-0000-0000-000000000031', 'f0000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000012', 'Feed the cat', 50, 'daily'),
  ('f0000000-0000-0000-0000-000000000032', 'f0000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000012', 'Tidy room', 200, 'once_weekly'),
  ('f0000000-0000-0000-0000-000000000033', 'f0000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000012', 'Take out trash', 75, 'selected_days');

-- day_of_week: 0 = Sunday .. 6 = Saturday
insert into public.chore_schedule (chore_id, day_of_week) values
  ('f0000000-0000-0000-0000-000000000021', 6),                 -- Room tidy: Saturday
  ('f0000000-0000-0000-0000-000000000022', 1), ('f0000000-0000-0000-0000-000000000022', 3), ('f0000000-0000-0000-0000-000000000022', 5), -- Dishwasher: Mon/Wed/Fri
  ('f0000000-0000-0000-0000-000000000024', 0),                 -- Laundry: Sunday
  ('f0000000-0000-0000-0000-000000000032', 3),                 -- Tidy room: Wednesday
  ('f0000000-0000-0000-0000-000000000033', 1), ('f0000000-0000-0000-0000-000000000033', 4); -- Take out trash: Mon/Thu

-- ---------------------------------------------------------------------------
-- Three weeks of occurrences + weekly_allowances (section 39):
--   bucket 0 = this week      -> partially completed, not paid
--   bucket 1 = last week      -> fully completed, paid
--   bucket 2 = two weeks ago  -> partially completed, not paid
-- ---------------------------------------------------------------------------

do $$
declare
  v_family_id constant uuid := 'f0000000-0000-0000-0000-000000000010';
  v_monday date := current_date - (((extract(dow from current_date)::int + 6) % 7));
  v_bucket int;
  v_week_start date;
  v_week_end date;
  v_child_id uuid;
  v_user_id uuid;
  v_chore record;
  v_day_offset int;
  v_date date;
  v_idx int;
  v_status text;
  v_completed_by uuid;
  v_completed_at timestamptz;
  v_max int;
  v_earned int;
  v_payment_status text;
  v_paid_amount int;
  v_paid_at timestamptz;
begin
  create temporary table seed_chore_defs (
    child_id uuid,
    chore_id uuid,
    chore_name text,
    amount_cents integer,
    days int[]
  ) on commit drop;

  insert into seed_chore_defs values
    ('f0000000-0000-0000-0000-000000000011', 'f0000000-0000-0000-0000-000000000021', 'Room tidy', 250, array[6]),
    ('f0000000-0000-0000-0000-000000000011', 'f0000000-0000-0000-0000-000000000022', 'Dishwasher', 50, array[1, 3, 5]),
    ('f0000000-0000-0000-0000-000000000011', 'f0000000-0000-0000-0000-000000000023', 'Clear table', 50, array[0, 1, 2, 3, 4, 5, 6]),
    ('f0000000-0000-0000-0000-000000000011', 'f0000000-0000-0000-0000-000000000024', 'Laundry', 150, array[0]),
    ('f0000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-000000000031', 'Feed the cat', 50, array[0, 1, 2, 3, 4, 5, 6]),
    ('f0000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-000000000032', 'Tidy room', 200, array[3]),
    ('f0000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-000000000033', 'Take out trash', 75, array[1, 4]);

  for v_bucket in 0..2 loop
    v_week_start := v_monday - (v_bucket * 7);
    v_week_end := v_week_start + 6;

    for v_child_id in select distinct child_id from seed_chore_defs loop
      v_user_id := case v_child_id
        when 'f0000000-0000-0000-0000-000000000011' then 'f0000000-0000-0000-0000-000000000002'
        when 'f0000000-0000-0000-0000-000000000012' then 'f0000000-0000-0000-0000-000000000003'
      end;
      v_max := 0;
      v_earned := 0;
      v_idx := 0;

      for v_chore in select * from seed_chore_defs where child_id = v_child_id loop
        for v_day_offset in 0..6 loop
          v_date := v_week_start + v_day_offset;
          continue when not (extract(dow from v_date)::int = any(v_chore.days));

          if v_bucket = 1 then
            v_status := 'completed';
          elsif v_bucket = 2 then
            v_status := case when v_idx % 2 = 0 then 'completed' else 'pending' end;
          elsif v_date < current_date then
            v_status := 'completed';
          elsif v_date = current_date then
            v_status := case when v_idx % 2 = 0 then 'completed' else 'pending' end;
          else
            v_status := 'pending';
          end if;

          v_max := v_max + v_chore.amount_cents;
          if v_status = 'completed' then
            v_earned := v_earned + v_chore.amount_cents;
            v_completed_by := v_user_id;
            v_completed_at := v_date::timestamptz + interval '18 hours';
          else
            v_completed_by := null;
            v_completed_at := null;
          end if;

          insert into public.chore_occurrences (
            family_id, chore_id, child_id, scheduled_date,
            chore_name_snapshot, amount_cents_snapshot, status, completed_at, completed_by
          ) values (
            v_family_id, v_chore.chore_id, v_child_id, v_date,
            v_chore.chore_name, v_chore.amount_cents, v_status, v_completed_at, v_completed_by
          );

          v_idx := v_idx + 1;
        end loop;
      end loop;

      if v_bucket = 1 then
        v_payment_status := 'paid';
        v_paid_amount := v_earned;
        v_paid_at := v_week_end::timestamptz + interval '1 day';
      else
        v_payment_status := 'not_paid';
        v_paid_amount := null;
        v_paid_at := null;
      end if;

      insert into public.weekly_allowances (
        family_id, child_id, week_start, week_end, maximum_cents, earned_cents,
        payment_status, paid_amount_cents, paid_at
      ) values (
        v_family_id, v_child_id, v_week_start, v_week_end, v_max, v_earned,
        v_payment_status, v_paid_amount, v_paid_at
      );
    end loop;
  end loop;
end $$;
