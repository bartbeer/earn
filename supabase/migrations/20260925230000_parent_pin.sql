-- Phase 9, part 2: the Parent PIN. A local gate on the Settings screen's
-- parent-only sections — not a second login, not tied to the join-code
-- flow. Purpose: a family device sometimes ends up in a child's hands
-- while the parent is still signed in; this stops them poking around
-- Settings without a full sign-out/sign-in.
--
-- The hash lives in its own table with NO select/update policy at all,
-- unlike most of this app's "members can view X" pattern — deliberately
-- so, unlike family_settings' other columns. The threat model here is
-- specifically the child who already has ordinary, legitimate access to
-- the app (their own session or the parent's unlocked device) and
-- unlimited time to try to read whatever the client can see; a PIN's
-- entropy (4-6 digits, 10,000-1,000,000 combinations) is nowhere near
-- strong enough to survive being handed the hash directly; crypt()/bcrypt
-- makes an offline attack slow but not the right primary defense here.
-- Verification instead only ever happens through the SECURITY DEFINER
-- function below, which the client can call but never inspect.
create table public.family_security (
  family_id uuid primary key references public.families (id) on delete cascade,
  parent_pin_hash text
);

comment on table public.family_security is 'Parent PIN hash, reachable only through set_parent_pin/verify_parent_pin/has_parent_pin/clear_parent_pin — deliberately no SELECT/UPDATE policy at all.';

alter table public.family_security enable row level security;

-- ---------------------------------------------------------------------------
create function public.set_parent_pin(p_family_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_family_parent(p_family_id) then
    raise exception 'Not authorized';
  end if;
  if p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN must be 4 to 6 digits';
  end if;

  insert into public.family_security (family_id, parent_pin_hash)
  values (p_family_id, extensions.crypt(p_pin, extensions.gen_salt('bf')))
  on conflict (family_id) do update set parent_pin_hash = excluded.parent_pin_hash;
end;
$$;

revoke execute on function public.set_parent_pin(uuid, text) from public;
grant execute on function public.set_parent_pin(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
create function public.verify_parent_pin(p_family_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  if not public.is_family_parent(p_family_id) then
    raise exception 'Not authorized';
  end if;

  select parent_pin_hash into v_hash
  from public.family_security
  where family_id = p_family_id;

  if v_hash is null then
    return true; -- no PIN set — nothing to gate
  end if;

  return extensions.crypt(p_pin, v_hash) = v_hash;
end;
$$;

revoke execute on function public.verify_parent_pin(uuid, text) from public;
grant execute on function public.verify_parent_pin(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
create function public.has_parent_pin(p_family_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_family_member(p_family_id) then
    raise exception 'Not authorized';
  end if;

  return exists (
    select 1 from public.family_security
    where family_id = p_family_id and parent_pin_hash is not null
  );
end;
$$;

revoke execute on function public.has_parent_pin(uuid) from public;
grant execute on function public.has_parent_pin(uuid) to authenticated;

-- ---------------------------------------------------------------------------
create function public.clear_parent_pin(p_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_family_parent(p_family_id) then
    raise exception 'Not authorized';
  end if;

  delete from public.family_security where family_id = p_family_id;
end;
$$;

revoke execute on function public.clear_parent_pin(uuid) from public;
grant execute on function public.clear_parent_pin(uuid) to authenticated;
