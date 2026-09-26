-- Phase 12: rate limiting for the two functions that let a client guess a
-- secret over and over — verify_parent_pin (4-6 digits, 10,000-1,000,000
-- combinations) and resolve_family_join_code/join_family_as_child (6
-- digits, 900,000 combinations). Both migrations that introduced these
-- explicitly flagged this as a known gap at the time ("no attempt-rate-
-- limiting beyond the code space and expiry... worth revisiting").
--
-- A small, reusable lockout table rather than one bespoke mechanism per
-- function: both need the exact same shape (count failures, lock out past
-- a threshold, reset on success, expire the lockout after a cooldown).
-- Deliberately no SELECT/UPDATE policy at all, matching family_security —
-- reachable only through the helper functions below, which are not
-- granted to `authenticated` at all: they're called *from* the public
-- RPCs (which already run as the functions' owner under SECURITY
-- DEFINER), never directly by a client.
create table public.security_attempts (
  subject_type text not null,
  subject_key text not null,
  failed_count int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (subject_type, subject_key)
);

comment on table public.security_attempts is 'Failed-attempt counters for rate-limited actions (parent PIN, join code). Reachable only through assert_not_locked_out/record_failed_attempt/reset_attempts — no client-facing policy at all.';

alter table public.security_attempts enable row level security;

-- ---------------------------------------------------------------------------
create function public.assert_not_locked_out(p_subject_type text, p_subject_key text)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_locked_until timestamptz;
begin
  select locked_until into v_locked_until
  from public.security_attempts
  where subject_type = p_subject_type and subject_key = p_subject_key;

  if v_locked_until is not null and v_locked_until > now() then
    raise exception 'Too many attempts. Try again in a few minutes.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Records one failed attempt, locking out once p_max_attempts is reached.
-- A lockout that has already expired starts the count fresh at 1 rather
-- than continuing to climb forever.
-- ---------------------------------------------------------------------------
create function public.record_failed_attempt(
  p_subject_type text,
  p_subject_key text,
  p_max_attempts int,
  p_lockout interval
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.security_attempts (subject_type, subject_key, failed_count, updated_at)
  values (p_subject_type, p_subject_key, 1, now())
  on conflict (subject_type, subject_key) do update
  set failed_count = case
        when security_attempts.locked_until is not null and security_attempts.locked_until <= now()
          then 1
        else security_attempts.failed_count + 1
      end,
      updated_at = now()
  returning failed_count into v_count;

  if v_count >= p_max_attempts then
    update public.security_attempts
    set locked_until = now() + p_lockout
    where subject_type = p_subject_type and subject_key = p_subject_key;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
create function public.reset_attempts(p_subject_type text, p_subject_key text)
returns void
language plpgsql
set search_path = public
as $$
begin
  delete from public.security_attempts
  where subject_type = p_subject_type and subject_key = p_subject_key;
end;
$$;

-- None of the three helpers above are granted to authenticated/public —
-- they run as whichever SECURITY DEFINER function calls them, under that
-- function's own elevated privileges, never directly at a client's request.

-- ---------------------------------------------------------------------------
-- verify_parent_pin: 5 wrong guesses locks the family's PIN check for 15
-- minutes. Locked out only once a PIN actually exists — nothing to brute-
-- force otherwise.
-- ---------------------------------------------------------------------------
create or replace function public.verify_parent_pin(p_family_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_correct boolean;
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

  perform public.assert_not_locked_out('parent_pin', p_family_id::text);

  v_correct := extensions.crypt(p_pin, v_hash) = v_hash;

  if v_correct then
    perform public.reset_attempts('parent_pin', p_family_id::text);
  else
    perform public.record_failed_attempt('parent_pin', p_family_id::text, 5, interval '15 minutes');
  end if;

  return v_correct;
end;
$$;

-- ---------------------------------------------------------------------------
-- resolve_family_join_code / join_family_as_child: 10 wrong codes locks
-- the *calling user* out of both for 15 minutes — one shared bucket, since
-- both represent guessing the same 900,000-code space and a limit on only
-- one of them would just push brute-forcing onto the other.
--
-- Neither function raises for "the code was wrong" specifically (unlike
-- most other failures here, which still raise as before) — a real bug
-- caught while building this: an uncaught exception aborts the whole
-- transaction, which would silently undo record_failed_attempt's own
-- INSERT/UPDATE from moments earlier in the same call, since PostgREST
-- runs one RPC call as one transaction with no autonomous-transaction
-- support in plain PL/pgSQL. Recording a failure and then still raising
-- in the same call would make the recording itself never actually
-- persist. Returning a value instead (empty rows / false) lets the
-- transaction commit normally, so the count genuinely sticks —
-- verify_parent_pin above already gets this right by returning false
-- rather than raising for a wrong guess, which is why only these two
-- needed reworking.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_family_join_code(p_join_code text)
returns table (family_id uuid, family_name text, child_id uuid, child_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_family_name text;
  v_has_unclaimed boolean;
begin
  perform public.assert_not_locked_out('join_code', auth.uid()::text);

  select f.id, f.name into v_family_id, v_family_name
  from public.families f
  where f.join_code_hash is not null
    and f.join_code_expires_at > now()
    and extensions.crypt(p_join_code, f.join_code_hash) = f.join_code_hash
  limit 1;

  if v_family_id is null then
    perform public.record_failed_attempt('join_code', auth.uid()::text, 10, interval '15 minutes');
    return; -- zero rows: the caller treats this as "invalid or expired code"
  end if;

  perform public.reset_attempts('join_code', auth.uid()::text);

  select exists (
    select 1 from public.children c
    where c.family_id = v_family_id
      and c.active = true
      and not exists (select 1 from public.family_memberships fm where fm.child_id = c.id)
  ) into v_has_unclaimed;

  if v_has_unclaimed then
    return query
      select v_family_id, v_family_name, c.id, c.name
      from public.children c
      where c.family_id = v_family_id
        and c.active = true
        and not exists (select 1 from public.family_memberships fm where fm.child_id = c.id);
  else
    -- The code itself was valid — one row with real family info and null
    -- child fields, so the caller can tell "valid code, nobody left to
    -- claim" apart from "invalid code" (zero rows) rather than the two
    -- looking identical.
    return query select v_family_id, v_family_name, null::uuid, null::text;
  end if;
end;
$$;

-- Return type is changing (void -> boolean), which CREATE OR REPLACE
-- can't do — the original must be dropped first.
drop function public.join_family_as_child(text, uuid);

create function public.join_family_as_child(p_join_code text, p_child_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
begin
  perform public.assert_not_locked_out('join_code', auth.uid()::text);

  select f.id into v_family_id
  from public.families f
  where f.join_code_hash is not null
    and f.join_code_expires_at > now()
    and extensions.crypt(p_join_code, f.join_code_hash) = f.join_code_hash
  limit 1;

  if v_family_id is null then
    perform public.record_failed_attempt('join_code', auth.uid()::text, 10, interval '15 minutes');
    return false; -- the caller treats this as "invalid or expired code"
  end if;

  if not exists (
    select 1 from public.children c
    where c.id = p_child_id and c.family_id = v_family_id and c.active = true
  ) then
    raise exception 'That child is not part of this family';
  end if;

  if exists (select 1 from public.family_memberships fm where fm.child_id = p_child_id) then
    raise exception 'This child has already joined';
  end if;

  if exists (select 1 from public.family_memberships fm where fm.user_id = auth.uid()) then
    raise exception 'You already belong to a family';
  end if;

  perform public.reset_attempts('join_code', auth.uid()::text);

  insert into public.family_memberships (family_id, user_id, role, child_id)
  values (v_family_id, auth.uid(), 'child', p_child_id);

  return true;
end;
$$;

revoke execute on function public.join_family_as_child(text, uuid) from public;
grant execute on function public.join_family_as_child(text, uuid) to authenticated;
