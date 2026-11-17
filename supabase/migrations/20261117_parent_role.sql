-- Step 7 of docs/COURTLOAD-PLAN.md: read-only parent role. A parent sees ONLY their linked child (planning, load, profile,
-- strength tests, availability). Check-in details only when the child has consent AND is a minor (< 18).
-- A trainer (head / strength coach / basketball coach of the child's team) creates a single-use invite code per child.
create table if not exists public.parent_links (
  parent_user uuid not null references auth.users(id) on delete cascade,
  child_user uuid not null references auth.users(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (parent_user, child_user),
  check (parent_user <> child_user)
);
create index if not exists parent_links_child_idx on public.parent_links (child_user);
alter table public.parent_links enable row level security;
revoke all on public.parent_links from anon, authenticated;
grant select on public.parent_links to authenticated;
create policy parent_links_select on public.parent_links for select to authenticated
  using (parent_user = (select auth.uid()) or child_user = (select auth.uid()) or public.shares_team_staff_with(child_user));

create table if not exists public.parent_invites (
  code text primary key,
  child_user uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days'
);
create index if not exists parent_invites_child_idx on public.parent_invites (child_user);
alter table public.parent_invites enable row level security;
revoke all on public.parent_invites from anon, authenticated;
-- no policies: only the security-definer functions below touch it

create or replace function public.parent_of(_user uuid) returns boolean
language sql stable security definer set search_path to 'public' as $function$
  select exists (select 1 from public.parent_links where parent_user = auth.uid() and child_user = _user);
$function$;

create or replace function public.parent_sees_team(_team uuid) returns boolean
language sql stable security definer set search_path to 'public' as $function$
  select exists (
    select 1 from public.parent_links pl
    join public.team_members m on m.user_id = pl.child_user and m.team_id = _team and m.role = 'athlete'
    where pl.parent_user = auth.uid());
$function$;

-- Trainer: invite code for one athlete of the team.
create or replace function public.create_parent_invite(_team uuid, _child uuid) returns text
language plpgsql security definer set search_path to 'public', 'extensions' as $function$
declare _code text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_team_planner(_team) then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.team_members where team_id = _team and user_id = _child and role = 'athlete') then
    raise exception 'not allowed';
  end if;
  if (select count(*) from public.parent_invites where child_user = _child and expires_at > now()) >= 5 then
    raise exception 'too_many_invites';
  end if;
  _code := upper(substr(replace(encode(gen_random_bytes(9), 'base64'), '/', 'X'), 1, 10));
  _code := translate(_code, '+=O0I1', 'ABCDEF');
  insert into public.parent_invites (code, child_user, team_id, created_by) values (_code, _child, _team, auth.uid());
  return _code;
end;
$function$;

-- Parent: use a code. Returns the child's user id. Single use.
create or replace function public.join_as_parent(_code text) returns uuid
language plpgsql security definer set search_path to 'public' as $function$
declare _inv public.parent_invites;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into _inv from public.parent_invites where code = upper(trim(_code)) and expires_at > now() for update;
  if not found then raise exception 'invalid or expired invite'; end if;
  if _inv.child_user = auth.uid() then raise exception 'not allowed'; end if;
  insert into public.parent_links (parent_user, child_user, created_by) values (auth.uid(), _inv.child_user, _inv.created_by)
    on conflict do nothing;
  delete from public.parent_invites where code = _inv.code;
  return _inv.child_user;
end;
$function$;

-- Head of the child's team or the parent themselves may remove a link.
create or replace function public.remove_parent_link(_parent uuid, _child uuid) returns void
language plpgsql security definer set search_path to 'public' as $function$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not (_parent = auth.uid() or exists (
    select 1 from public.team_members me join public.team_members c on c.team_id = me.team_id
     where me.user_id = auth.uid() and me.role = 'staff' and me.staff_kind = 'head' and c.user_id = _child and c.role = 'athlete')) then
    raise exception 'not allowed';
  end if;
  delete from public.parent_links where parent_user = _parent and child_user = _child;
end;
$function$;

revoke execute on function public.parent_of(uuid), public.parent_sees_team(uuid), public.create_parent_invite(uuid, uuid),
  public.join_as_parent(text), public.remove_parent_link(uuid, uuid) from public, anon;
grant execute on function public.parent_of(uuid), public.parent_sees_team(uuid), public.create_parent_invite(uuid, uuid),
  public.join_as_parent(text), public.remove_parent_link(uuid, uuid) to authenticated;

-- Read-only access for parents: their child only.
create policy parent_read_profiles on public.profiles for select to authenticated using (public.parent_of(id));
create policy parent_read_team_members on public.team_members for select to authenticated using (public.parent_of(user_id));
create policy parent_read_teams on public.teams for select to authenticated using (public.parent_sees_team(id));
create policy parent_read_sessions on public.sessions for select to authenticated using (public.parent_sees_team(team_id));
create policy parent_read_session_logs on public.session_logs for select to authenticated using (public.parent_of(user_id));
create policy parent_read_session_exclusions on public.session_exclusions for select to authenticated using (public.parent_of(user_id));
create policy parent_read_workout_runs on public.workout_runs for select to authenticated using (public.parent_of(user_id));
create policy parent_read_run_sets on public.run_sets for select to authenticated using (public.parent_of(public.run_owner(run_id)));
create policy parent_read_availability on public.availability for select to authenticated using (public.parent_of(user_id));
create policy parent_read_strength_tests on public.strength_tests for select to authenticated using (public.parent_of(user_id));

-- Check-in details: staff with consent (as before), or a parent of a CONSENTING MINOR.
create or replace function public.can_view_wellness(_user uuid) returns boolean
language sql stable security definer set search_path to 'public' as $function$
  select exists (
    select 1
    from public.team_members me
    join public.team_members ath on ath.team_id = me.team_id
    where me.user_id = auth.uid() and me.role = 'staff'
      and ath.user_id = _user and ath.role = 'athlete' and ath.consent_given
  ) or exists (
    select 1
    from public.parent_links pl
    join public.team_members ath on ath.user_id = pl.child_user and ath.role = 'athlete' and ath.consent_given
    join public.profiles p on p.id = pl.child_user and p.birth_date is not null and public.age_years(p.birth_date) < 18
    where pl.parent_user = auth.uid() and pl.child_user = _user
  );
$function$;
