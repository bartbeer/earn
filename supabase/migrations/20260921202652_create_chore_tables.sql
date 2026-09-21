-- Chores, their schedules, individual earnable occurrences, and weekly
-- allowance totals (master spec section 41).
--
-- Money is always integer cents (section 6) — every *_cents column is an
-- integer with a non-negative check constraint, never numeric/float.

-- ---------------------------------------------------------------------------
-- chores
-- ---------------------------------------------------------------------------

create table public.chores (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  -- Sanity cap alongside "not negative" — section 63/81: an unreasonable
  -- amount (e.g. a typo with extra zeros) should be rejected outright, not
  -- just discouraged in the UI. €1,000 per single completion is already far
  -- beyond any realistic chore value.
  amount_cents integer not null check (amount_cents >= 0 and amount_cents <= 100000),
  recurrence_type text not null check (recurrence_type in ('once_weekly', 'selected_days', 'daily')),
  -- Deactivated, never deleted, so historical occurrences keep referring to
  -- a real row (section 43).
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.chores is 'A chore definition. Editing amount_cents/name here never rewrites already-created occurrences — those hold their own snapshot (section 42).';

create index chores_family_id_idx on public.chores (family_id);
create index chores_child_id_idx on public.chores (child_id);

-- ---------------------------------------------------------------------------
-- chore_schedule — which weekday(s) a chore occurs on.
-- once_weekly chores have exactly one row (their single day); selected_days
-- chores have one row per chosen day; daily chores have none (every day is
-- implicit, so there is nothing to enumerate).
-- ---------------------------------------------------------------------------

create table public.chore_schedule (
  id uuid primary key default gen_random_uuid(),
  chore_id uuid not null references public.chores (id) on delete cascade,
  -- 0 = Sunday .. 6 = Saturday (JS Date#getDay() convention — see family_settings).
  day_of_week smallint not null check (day_of_week between 0 and 6),
  unique (chore_id, day_of_week)
);

comment on table public.chore_schedule is 'Weekday tags: one row for once_weekly, several for selected_days, none for daily.';

-- ---------------------------------------------------------------------------
-- chore_occurrences — one earnable instance of a chore on one date.
-- ---------------------------------------------------------------------------

create table public.chore_occurrences (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  chore_id uuid not null references public.chores (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  scheduled_date date not null,
  -- Snapshots taken at creation time. These are what make historical weeks
  -- immune to later chore edits/renames/deactivation (section 42) — nothing
  -- ever recomputes them from the current chores row.
  chore_name_snapshot text not null,
  amount_cents_snapshot integer not null check (amount_cents_snapshot >= 0),
  status text not null default 'pending' check (status in ('pending', 'completed')),
  completed_at timestamptz,
  completed_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A given chore can occur at most once per child per date (section 44).
  unique (chore_id, child_id, scheduled_date)
);

comment on table public.chore_occurrences is 'One earnable instance of a chore. Writes happen only through SECURITY DEFINER functions added in later phases — see the RLS section below.';

create index chore_occurrences_family_id_idx on public.chore_occurrences (family_id);
create index chore_occurrences_child_id_scheduled_date_idx
  on public.chore_occurrences (child_id, scheduled_date);

-- ---------------------------------------------------------------------------
-- weekly_allowances — one row per child per week.
-- ---------------------------------------------------------------------------

create table public.weekly_allowances (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  week_start date not null,
  week_end date not null,
  maximum_cents integer not null default 0 check (maximum_cents >= 0),
  earned_cents integer not null default 0 check (earned_cents >= 0 and earned_cents <= maximum_cents),
  payment_status text not null default 'not_paid' check (payment_status in ('not_paid', 'paid')),
  -- Snapshot taken the moment a parent marks the week paid (section 24).
  -- Never recalculated afterwards, even if chore amounts change later.
  paid_amount_cents integer check (paid_amount_cents >= 0),
  paid_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_id, week_start),
  constraint weekly_allowances_paid_fields_consistent check (
    (payment_status = 'paid' and paid_amount_cents is not null and paid_at is not null)
    or
    (payment_status = 'not_paid' and paid_amount_cents is null and paid_at is null)
  )
);

comment on table public.weekly_allowances is 'One row per child per week. maximum/earned are recalculated by trusted server-side logic (Phase 6/7); paid_amount_cents is a frozen snapshot (section 24), never recalculated.';

create index weekly_allowances_family_id_idx on public.weekly_allowances (family_id);
create index weekly_allowances_child_id_idx on public.weekly_allowances (child_id);

-- updated_at auto-touch, reused by every table that has the column.
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger chores_set_updated_at
  before update on public.chores
  for each row execute function public.set_updated_at();

create trigger chore_occurrences_set_updated_at
  before update on public.chore_occurrences
  for each row execute function public.set_updated_at();

create trigger weekly_allowances_set_updated_at
  before update on public.weekly_allowances
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.chores enable row level security;
alter table public.chore_schedule enable row level security;
alter table public.chore_occurrences enable row level security;
alter table public.weekly_allowances enable row level security;

-- chores
create policy "members can view chores"
  on public.chores for select
  using (public.is_family_member(family_id));

create policy "parents can create chores"
  on public.chores for insert
  with check (public.is_family_parent(family_id));

create policy "parents can update chores"
  on public.chores for update
  using (public.is_family_parent(family_id))
  with check (public.is_family_parent(family_id));

-- chore_schedule (scoped through its parent chore's family)
create policy "members can view chore schedules"
  on public.chore_schedule for select
  using (
    exists (
      select 1 from public.chores c
      where c.id = chore_schedule.chore_id
        and public.is_family_member(c.family_id)
    )
  );

create policy "parents can manage chore schedules"
  on public.chore_schedule for all
  using (
    exists (
      select 1 from public.chores c
      where c.id = chore_schedule.chore_id
        and public.is_family_parent(c.family_id)
    )
  )
  with check (
    exists (
      select 1 from public.chores c
      where c.id = chore_schedule.chore_id
        and public.is_family_parent(c.family_id)
    )
  );

-- chore_occurrences: members can read. There is deliberately NO client-side
-- write policy yet. Occurrence generation (Phase 5) and completion toggling
-- (Phase 6) both need narrow, purpose-built SECURITY DEFINER functions
-- rather than a raw UPDATE policy — a raw policy permissive enough to let a
-- child flip `status` would also let them rewrite amount_cents_snapshot in
-- the same statement, which is exactly the attack section 75 calls out.
create policy "members can view occurrences"
  on public.chore_occurrences for select
  using (public.is_family_member(family_id));

-- weekly_allowances: members can read. Same reasoning as chore_occurrences —
-- maximum/earned are server-recalculated (Phase 6/7) and payment status
-- changes go through a dedicated function that snapshots paid_amount_cents
-- from the server's own earned_cents, never from client input (Phase 8).
create policy "members can view weekly allowances"
  on public.weekly_allowances for select
  using (public.is_family_member(family_id));
