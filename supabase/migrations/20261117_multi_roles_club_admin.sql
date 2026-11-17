-- Step 1 of docs/COURTLOAD-PLAN.md: several roles per person per team, and a read-only club admin.
-- Decisions: trainers may be in several teams and hold several roles (E); planning stays per own team (D);
-- the admin sees everything EXCEPT health data (B): no wellness_checks, no athlete_pins, no push_subscriptions.

-- ------------------------------------------------------------------------------------------------------------
-- 1. Several roles per team member. staff_kind stays the primary role; extra_kinds holds the other ones.
-- ------------------------------------------------------------------------------------------------------------
alter table public.team_members add column if not exists extra_kinds text[] not null default '{}';
alter table public.team_members drop constraint if exists team_members_extra_kinds_valid;
alter table public.team_members add constraint team_members_extra_kinds_valid
  check (extra_kinds <@ array['sc', 'basketball', 'medical']::text[]);
alter table public.team_members drop constraint if exists team_members_extra_kinds_staff;
alter table public.team_members add constraint team_members_extra_kinds_staff
  check (role = 'staff' or extra_kinds = '{}'::text[]);

create or replace function public.has_staff_kind(_team uuid, _kind text) returns boolean
language sql stable security definer set search_path to 'public' as $function$
  select exists (
    select 1 from public.team_members
    where team_id = _team and user_id = auth.uid() and role = 'staff'
      and (staff_kind = _kind or _kind = any(extra_kinds)));
$function$;

create or replace function public.staff_kinds(_team uuid) returns text[]
language sql stable security definer set search_path to 'public' as $function$
  select coalesce((select array_remove(array[staff_kind] || extra_kinds, null)
                     from public.team_members
                    where team_id = _team and user_id = auth.uid() and role = 'staff'), '{}'::text[]);
$function$;

create or replace function public.can_plan_court(_team uuid) returns boolean
language sql stable security definer set search_path to 'public' as $function$
  select public.has_staff_kind(_team, 'head') or public.has_staff_kind(_team, 'basketball');
$function$;

create or replace function public.can_plan_gym(_team uuid) returns boolean
language sql stable security definer set search_path to 'public' as $function$
  select public.has_staff_kind(_team, 'head') or public.has_staff_kind(_team, 'sc');
$function$;

create or replace function public.is_team_planner(_team uuid) returns boolean
language sql stable security definer set search_path to 'public' as $function$
  select public.has_staff_kind(_team, 'head') or public.has_staff_kind(_team, 'sc') or public.has_staff_kind(_team, 'basketball');
$function$;

create or replace function public.is_club_sc(_club uuid) returns boolean
language sql stable security definer set search_path to 'public' as $function$
  select exists (
    select 1 from public.team_members m join public.teams t on t.id = m.team_id
    where t.club_id = _club and m.user_id = auth.uid() and m.role = 'staff'
      and (m.staff_kind in ('head', 'sc') or 'sc' = any(m.extra_kinds)));
$function$;

create or replace function public.sc_staff_with(_user uuid) returns boolean
language sql stable security definer set search_path to 'public' as $function$
  select exists (
    select 1 from public.team_members me join public.team_members o on o.team_id = me.team_id
    where me.user_id = auth.uid() and me.role = 'staff'
      and (me.staff_kind in ('head', 'sc') or 'sc' = any(me.extra_kinds)) and o.user_id = _user);
$function$;

create or replace function public.sc_athlete_with(_user uuid) returns boolean
language sql stable security definer set search_path to 'public' as $function$
  select exists (
    select 1 from public.team_members me join public.team_members o on o.team_id = me.team_id
    where me.user_id = auth.uid() and me.role = 'staff'
      and (me.staff_kind in ('head', 'sc') or 'sc' = any(me.extra_kinds))
      and o.user_id = _user and o.role = 'athlete');
$function$;

-- Head only: set the primary role and the extra roles of a staff member in one go.
create or replace function public.set_staff_kinds(_team uuid, _user uuid, _primary text, _extra text[])
returns void language plpgsql security definer set search_path to 'public' as $function$
declare _clean text[];
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_team_head(_team) then raise exception 'not allowed'; end if;
  if _primary is null or _primary not in ('head', 'sc', 'basketball', 'medical') then raise exception 'invalid_kind'; end if;
  _clean := coalesce((select array_agg(distinct k order by k) from unnest(coalesce(_extra, '{}'::text[])) k
                       where k <> _primary), '{}'::text[]);
  if not (_clean <@ array['sc', 'basketball', 'medical']::text[]) then raise exception 'invalid_kind'; end if;
  if not exists (select 1 from public.team_members where team_id = _team and user_id = _user and role = 'staff') then
    raise exception 'not allowed';
  end if;
  if _primary <> 'head' and not exists (
    select 1 from public.team_members where team_id = _team and staff_kind = 'head' and user_id <> _user
  ) then raise exception 'last_head'; end if;
  update public.team_members set staff_kind = _primary, extra_kinds = _clean where team_id = _team and user_id = _user;
end;
$function$;

-- Old single-role call keeps working: it changes the primary role and drops it from the extras.
create or replace function public.set_staff_kind(_team uuid, _user uuid, _kind text) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare _extra text[];
begin
  select extra_kinds into _extra from public.team_members where team_id = _team and user_id = _user and role = 'staff';
  perform public.set_staff_kinds(_team, _user, _kind, coalesce(_extra, '{}'::text[]));
end;
$function$;

revoke execute on function public.has_staff_kind(uuid, text), public.staff_kinds(uuid),
  public.set_staff_kinds(uuid, uuid, text, text[]) from public, anon;
grant execute on function public.has_staff_kind(uuid, text), public.staff_kinds(uuid),
  public.set_staff_kinds(uuid, uuid, text, text[]) to authenticated;

-- ------------------------------------------------------------------------------------------------------------
-- 2. Club admin: read-only, whole academy, no health data.
-- ------------------------------------------------------------------------------------------------------------
create table if not exists public.club_admins (
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
create index if not exists club_admins_user_id_idx on public.club_admins (user_id);
alter table public.club_admins enable row level security;
drop policy if exists club_admins_select on public.club_admins;
create policy club_admins_select on public.club_admins for select to authenticated
  using (user_id = (select auth.uid()) or public.is_club_sc(club_id));
revoke all on public.club_admins from anon, authenticated;
grant select on public.club_admins to authenticated;

create or replace function public.team_club(_team uuid) returns uuid
language sql stable security definer set search_path to 'public' as $function$
  select club_id from public.teams where id = _team;
$function$;

create or replace function public.is_club_admin(_club uuid) returns boolean
language sql stable security definer set search_path to 'public' as $function$
  select exists (select 1 from public.club_admins where club_id = _club and user_id = auth.uid());
$function$;

create or replace function public.admin_sees_team(_team uuid) returns boolean
language sql stable security definer set search_path to 'public' as $function$
  select public.is_club_admin(public.team_club(_team));
$function$;

create or replace function public.admin_sees_user(_user uuid) returns boolean
language sql stable security definer set search_path to 'public' as $function$
  select exists (
    select 1 from public.club_admins ca
    join public.teams t on t.club_id = ca.club_id
    join public.team_members m on m.team_id = t.id
    where ca.user_id = auth.uid() and m.user_id = _user);
$function$;

revoke execute on function public.team_club(uuid), public.is_club_admin(uuid), public.admin_sees_team(uuid),
  public.admin_sees_user(uuid) from public, anon;
grant execute on function public.team_club(uuid), public.is_club_admin(uuid), public.admin_sees_team(uuid),
  public.admin_sees_user(uuid) to authenticated;

-- Head of a team in the club adds or removes an admin (by user id; the invite code below is the normal route).
create or replace function public.set_club_admin(_club uuid, _user uuid, _on boolean) returns void
language plpgsql security definer set search_path to 'public' as $function$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists (
    select 1 from public.team_members m join public.teams t on t.id = m.team_id
    where t.club_id = _club and m.user_id = auth.uid() and m.role = 'staff' and m.staff_kind = 'head'
  ) then raise exception 'not allowed'; end if;
  if _on then
    insert into public.club_admins (club_id, user_id, created_by) values (_club, _user, auth.uid()) on conflict do nothing;
  else
    delete from public.club_admins where club_id = _club and user_id = _user;
  end if;
end;
$function$;
revoke execute on function public.set_club_admin(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_club_admin(uuid, uuid, boolean) to authenticated;

-- Read-only policies for the admin. wellness_checks, athlete_pins, push_subscriptions, team_invites are left out on purpose.
create policy admin_read_clubs on public.clubs for select to authenticated using (public.is_club_admin(id));
create policy admin_read_teams on public.teams for select to authenticated using (public.admin_sees_team(id));
create policy admin_read_team_members on public.team_members for select to authenticated using (public.admin_sees_team(team_id));
create policy admin_read_sessions on public.sessions for select to authenticated using (public.admin_sees_team(team_id));
create policy admin_read_availability on public.availability for select to authenticated using (public.admin_sees_team(team_id));
create policy admin_read_athlete_limits on public.athlete_limits for select to authenticated using (public.admin_sees_team(team_id));
create policy admin_read_week_rules on public.week_rules for select to authenticated using (public.admin_sees_team(team_id));
create policy admin_read_workload_notes on public.workload_notes for select to authenticated using (public.admin_sees_team(team_id));
create policy admin_read_team_workload_settings on public.team_workload_settings for select to authenticated using (public.admin_sees_team(team_id));
create policy admin_read_session_logs on public.session_logs for select to authenticated using (public.admin_sees_team(public.session_team(session_id)));
create policy admin_read_session_exclusions on public.session_exclusions for select to authenticated using (public.admin_sees_team(public.session_team(session_id)));
create policy admin_read_workout_runs on public.workout_runs for select to authenticated using (public.admin_sees_team(public.session_team(session_id)));
create policy admin_read_run_sets on public.run_sets for select to authenticated using (public.admin_sees_user(public.run_owner(run_id)));
create policy admin_read_strength_tests on public.strength_tests for select to authenticated using (public.admin_sees_user(user_id));
create policy admin_read_profiles on public.profiles for select to authenticated using (public.admin_sees_user(id));
create policy admin_read_exercises on public.exercises for select to authenticated using (public.is_club_admin(club_id));
create policy admin_read_workouts on public.workouts for select to authenticated using (public.is_club_admin(club_id));
create policy admin_read_workout_blocks on public.workout_blocks for select to authenticated using (public.is_club_admin(public.workout_club(workout_id)));
create policy admin_read_workout_sets on public.workout_sets for select to authenticated
  using (exists (select 1 from public.workout_blocks b where b.id = block_id));

-- ------------------------------------------------------------------------------------------------------------
-- 3. Invites: an invite with staff_kind 'admin' makes the person club admin (no team membership).
--    A staff invite without a kind is refused (it used to silently make the person head of the team).
-- ------------------------------------------------------------------------------------------------------------
alter table public.team_invites drop constraint if exists team_invites_staff_kind_check;
alter table public.team_invites add constraint team_invites_staff_kind_check
  check (staff_kind = any (array['head', 'sc', 'basketball', 'medical', 'admin']::text[]));

create or replace function public.join_team(_code text) returns uuid
language plpgsql security definer set search_path to 'public' as $function$
declare _inv public.team_invites;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into _inv from public.team_invites where code = _code and expires_at > now();
  if not found then raise exception 'invalid or expired invite'; end if;
  if _inv.role = 'staff' and _inv.staff_kind is null then raise exception 'staff_kind_required'; end if;
  if _inv.staff_kind = 'admin' then
    insert into public.club_admins (club_id, user_id, created_by)
      values (public.team_club(_inv.team_id), auth.uid(), _inv.created_by) on conflict do nothing;
    return _inv.team_id;
  end if;
  insert into public.team_members (team_id, user_id, role, staff_kind)
    values (_inv.team_id, auth.uid(), _inv.role, case when _inv.role = 'staff' then _inv.staff_kind end)
    on conflict (team_id, user_id) do nothing;
  insert into public.availability (team_id, user_id) values (_inv.team_id, auth.uid()) on conflict do nothing;
  return _inv.team_id;
end;
$function$;
