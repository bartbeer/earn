-- Phase 9, part 1: the secure child join-code flow. families.join_code_hash
-- / join_code_rotated_at / join_code_expires_at have existed unused since
-- Phase 2 (section 79: "join codes are never stored in plaintext"). A child
-- signs up for their own account the normal way (sign-up.tsx, unchanged),
-- then redeems the family's join code to link that account to one of the
-- family's existing `children` rows — the only path that's ever allowed to
-- create a child-role family_memberships row (see the Phase 2 migration's
-- comment on that table's INSERT policy: self-enrollment as a parent is a
-- direct insert, but "child memberships are created exclusively by the
-- trusted join-code RPC").
--
-- Codes are 6 digits, matched with crypt()/bcrypt (never stored or
-- transmitted back in plaintext after generation) and expire after 24
-- hours. Known, deliberate tradeoff for this MVP's scale (a single real
-- family, not a multi-tenant service): resolving a code does a full scan
-- of families with a live code rather than an indexed lookup, and there's
-- no attempt-rate-limiting beyond the code space (900,000 possibilities)
-- and the 24-hour expiry — both would be worth revisiting before any
-- larger deployment.

-- ---------------------------------------------------------------------------
-- rotate_family_join_code — generates a new code, replacing any existing
-- one. Returns the plaintext code exactly once, for the parent to hand to
-- their child; nothing else ever gets to see it again.
-- ---------------------------------------------------------------------------
create function public.rotate_family_join_code(p_family_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if not public.is_family_parent(p_family_id) then
    raise exception 'Not authorized';
  end if;

  v_code := lpad(floor(random() * 900000 + 100000)::text, 6, '0');

  update public.families
  set join_code_hash = extensions.crypt(v_code, extensions.gen_salt('bf')),
      join_code_rotated_at = now(),
      join_code_expires_at = now() + interval '24 hours'
  where id = p_family_id;

  return v_code;
end;
$$;

revoke execute on function public.rotate_family_join_code(uuid) from public;
grant execute on function public.rotate_family_join_code(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- resolve_family_join_code — read-only lookup for the join screen: which
-- family does this code belong to, and which of its children haven't been
-- claimed by a user account yet (so a child can't accidentally, or
-- someone else can't deliberately, claim an identity that's already in
-- use). Callable by anyone authenticated, regardless of whether they
-- already belong to a family — the family-membership check happens later,
-- in join_family_as_child, not here.
-- ---------------------------------------------------------------------------
create function public.resolve_family_join_code(p_join_code text)
returns table (family_id uuid, family_name text, child_id uuid, child_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_family_name text;
begin
  select f.id, f.name into v_family_id, v_family_name
  from public.families f
  where f.join_code_hash is not null
    and f.join_code_expires_at > now()
    and extensions.crypt(p_join_code, f.join_code_hash) = f.join_code_hash
  limit 1;

  if v_family_id is null then
    raise exception 'Invalid or expired join code';
  end if;

  return query
    select v_family_id, v_family_name, c.id, c.name
    from public.children c
    where c.family_id = v_family_id
      and c.active = true
      and not exists (select 1 from public.family_memberships fm where fm.child_id = c.id);
end;
$$;

revoke execute on function public.resolve_family_join_code(text) from public;
grant execute on function public.resolve_family_join_code(text) to authenticated;

-- ---------------------------------------------------------------------------
-- join_family_as_child — the actual write. Re-validates the code rather
-- than trusting an earlier resolve_family_join_code call is still good
-- (section 77: never trust the client's word that a check already
-- passed), confirms the chosen child is really this family's and still
-- unclaimed, and that the calling user doesn't already belong to some
-- family (MVP: one membership per user — see authState.ts).
-- ---------------------------------------------------------------------------
create function public.join_family_as_child(p_join_code text, p_child_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
begin
  select f.id into v_family_id
  from public.families f
  where f.join_code_hash is not null
    and f.join_code_expires_at > now()
    and extensions.crypt(p_join_code, f.join_code_hash) = f.join_code_hash
  limit 1;

  if v_family_id is null then
    raise exception 'Invalid or expired join code';
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

  insert into public.family_memberships (family_id, user_id, role, child_id)
  values (v_family_id, auth.uid(), 'child', p_child_id);
end;
$$;

revoke execute on function public.join_family_as_child(text, uuid) from public;
grant execute on function public.join_family_as_child(text, uuid) to authenticated;
