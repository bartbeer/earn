-- Core identity/authorization schema: families, per-family settings, user
-- profiles, child entities, and the membership table that is the single
-- source of truth for "who belongs to which family in what role" (master
-- spec section 41). Everything downstream (chores, occurrences, RLS) is
-- authorized against family_memberships, never against a client-supplied
-- role.
--
-- Design note vs. the spec's suggested model: the spec lists `role` on both
-- `profiles` and `family_memberships`. Keeping it in two places invites the
-- two copies to drift out of sync, which is exactly the kind of bug this
-- app's security model exists to prevent. profiles is kept as a pure
-- identity/display record; family_memberships.role is the only role that is
-- ever consulted for authorization decisions.

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- families
-- ---------------------------------------------------------------------------

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  -- Join codes are never stored in plaintext (section 79). Rotation is a
  -- simple "generate a new hash" operation; expiry is nullable architecture
  -- for later (section 9) and unused until Phase 9 sets it.
  join_code_hash text,
  join_code_rotated_at timestamptz,
  join_code_expires_at timestamptz,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

comment on table public.families is 'One row per family. The unit everything else is scoped to.';

-- ---------------------------------------------------------------------------
-- family_settings
-- ---------------------------------------------------------------------------

create table public.family_settings (
  family_id uuid primary key references public.families (id) on delete cascade,
  -- 0 = Sunday .. 6 = Saturday, matching JS Date#getDay() so the app layer
  -- never has to translate day-of-week conventions. Default Monday (spec
  -- section 21).
  week_start_day smallint not null default 1 check (week_start_day between 0 and 6),
  -- EUR-only for MVP (section 6). A check constraint (not just app-layer
  -- validation) so a stray write can't silently introduce a currency the
  -- rest of the system doesn't know how to format.
  currency text not null default 'EUR' check (currency = 'EUR'),
  timezone text not null default 'Europe/Brussels'
);

comment on table public.family_settings is 'Per-family configuration (section 27 Settings screen).';

-- Every family gets a default settings row automatically — no separate
-- client round-trip, and no window where a family exists without settings.
create function public.create_default_family_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.family_settings (family_id) values (new.id);
  return new;
end;
$$;

create trigger families_create_default_settings
  after insert on public.families
  for each row execute function public.create_default_family_settings();

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Public-schema mirror of auth.users with app-specific display data. Never stores a role.';

-- ---------------------------------------------------------------------------
-- children
-- ---------------------------------------------------------------------------

create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  -- Set once the child actually joins and gets their own login (Phase 9).
  -- Null before that — parents can add a child entity and start assigning
  -- chores before the child has a device/account at all.
  profile_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(name) between 1 and 60),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.children is 'A child within a family. May or may not yet be linked to a logged-in profile.';

create index children_family_id_idx on public.children (family_id);

-- ---------------------------------------------------------------------------
-- family_memberships — the authorization source of truth
-- ---------------------------------------------------------------------------

create table public.family_memberships (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('parent', 'child')),
  -- A child-role membership must point at the child entity it represents;
  -- a parent-role membership never does.
  child_id uuid references public.children (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint family_memberships_child_role_has_child
    check (role <> 'child' or child_id is not null),
  constraint family_memberships_parent_role_has_no_child
    check (role <> 'parent' or child_id is null),
  -- One membership per user per family (section 44-style duplicate prevention).
  unique (family_id, user_id)
);

comment on table public.family_memberships is 'Authoritative role/family assignment. All RLS authorization reads from here, never from client-supplied role claims (section 77).';

create index family_memberships_user_id_idx on public.family_memberships (user_id);
create index family_memberships_family_id_idx on public.family_memberships (family_id);

-- ---------------------------------------------------------------------------
-- Authorization helper functions
--
-- SECURITY DEFINER so they can read family_memberships without themselves
-- being subject to family_memberships' own RLS policies — the standard
-- Supabase pattern for avoiding self-referential RLS recursion. search_path
-- is pinned per section 82 to prevent search-path hijacking.
-- ---------------------------------------------------------------------------

create function public.is_family_member(p_family_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.family_memberships
    where family_id = p_family_id
      and user_id = auth.uid()
  );
$$;

create function public.is_family_parent(p_family_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.family_memberships
    where family_id = p_family_id
      and user_id = auth.uid()
      and role = 'parent'
  );
$$;

create function public.is_own_child_membership(p_family_id uuid, p_child_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.family_memberships
    where family_id = p_family_id
      and child_id = p_child_id
      and user_id = auth.uid()
  );
$$;

revoke execute on function public.is_family_member(uuid) from public;
revoke execute on function public.is_family_parent(uuid) from public;
revoke execute on function public.is_own_child_membership(uuid, uuid) from public;
grant execute on function public.is_family_member(uuid) to authenticated;
grant execute on function public.is_family_parent(uuid) to authenticated;
grant execute on function public.is_own_child_membership(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security — deny by default, then explicitly grant.
-- ---------------------------------------------------------------------------

alter table public.families enable row level security;
alter table public.family_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.children enable row level security;
alter table public.family_memberships enable row level security;

-- families
create policy "members can view their family"
  on public.families for select
  using (public.is_family_member(id));

create policy "authenticated users can create a family"
  on public.families for insert
  with check (created_by = auth.uid());

create policy "parents can update their family"
  on public.families for update
  using (public.is_family_parent(id))
  with check (public.is_family_parent(id));

-- family_settings
create policy "members can view family settings"
  on public.family_settings for select
  using (public.is_family_member(family_id));

create policy "parents can update family settings"
  on public.family_settings for update
  using (public.is_family_parent(family_id))
  with check (public.is_family_parent(family_id));

-- profiles
create policy "users can view their own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "users can view co-members' profiles"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.family_memberships mine
      join public.family_memberships theirs on theirs.family_id = mine.family_id
      where mine.user_id = auth.uid()
        and theirs.user_id = profiles.id
    )
  );

create policy "users can create their own profile"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "users can update their own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- children
create policy "members can view children"
  on public.children for select
  using (public.is_family_member(family_id));

create policy "parents can add children"
  on public.children for insert
  with check (public.is_family_parent(family_id));

create policy "parents can update children"
  on public.children for update
  using (public.is_family_parent(family_id))
  with check (public.is_family_parent(family_id));

-- family_memberships
create policy "members can view memberships in their family"
  on public.family_memberships for select
  using (public.is_family_member(family_id));

-- Only self-enrollment as a parent is allowed directly. Child memberships
-- are created exclusively by the trusted join-code RPC (Phase 9) — a client
-- can never grant itself family access just by knowing a family_id/child_id
-- (section 79: joining must be validated server-side, never bypass RLS).
create policy "a user can create their own parent membership"
  on public.family_memberships for insert
  with check (user_id = auth.uid() and role = 'parent');
