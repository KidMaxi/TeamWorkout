-- Roles within a team, richer sessions (status/series/focus), workload settings and notes.
-- Existing staff become 'head' so nothing they could do before is lost.

-- ===== 1. Staff kinds =====
alter table public.team_members
  add column if not exists staff_kind text check (staff_kind in ('head', 'sc', 'basketball', 'medical'));
update public.team_members set staff_kind = 'head' where role = 'staff' and staff_kind is null;
alter table public.team_members add constraint team_members_staff_kind_chk check ((role = 'staff') = (staff_kind is not null));
alter table public.team_invites
  add column if not exists staff_kind text check (staff_kind in ('head', 'sc', 'basketball', 'medical'));
revoke update (role) on public.team_members from authenticated;

create or replace function public.staff_kind(_team uuid)
returns text language sql stable security definer set search_path = public as $$
  select staff_kind from public.team_members where team_id = _team and user_id = auth.uid() and role = 'staff';
$$;
create or replace function public.is_team_head(_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.staff_kind(_team) = 'head', false);
$$;
create or replace function public.can_plan_gym(_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.staff_kind(_team) in ('head', 'sc'), false);
$$;
create or replace function public.can_plan_court(_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.staff_kind(_team) in ('head', 'basketball'), false);
$$;
create or replace function public.is_team_planner(_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.staff_kind(_team) in ('head', 'sc', 'basketball'), false);
$$;
create or replace function public.is_club_sc(_club uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members m join public.teams t on t.id = m.team_id
    where t.club_id = _club and m.user_id = auth.uid() and m.role = 'staff' and m.staff_kind in ('head', 'sc'));
$$;
-- Strength/gym staff of a team the athlete belongs to.
create or replace function public.sc_staff_with(_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members me join public.team_members o on o.team_id = me.team_id
    where me.user_id = auth.uid() and me.role = 'staff' and me.staff_kind in ('head', 'sc') and o.user_id = _user);
$$;
revoke all on function public.staff_kind(uuid), public.is_team_head(uuid), public.can_plan_gym(uuid), public.can_plan_court(uuid),
  public.is_team_planner(uuid), public.is_club_sc(uuid), public.sc_staff_with(uuid) from public, anon;
grant execute on function public.staff_kind(uuid), public.is_team_head(uuid), public.can_plan_gym(uuid), public.can_plan_court(uuid),
  public.is_team_planner(uuid), public.is_club_sc(uuid), public.sc_staff_with(uuid) to authenticated;

-- A team always keeps a head.
create or replace function public.guard_last_staff()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'staff' and old.staff_kind = 'head'
     and exists (select 1 from public.teams where id = old.team_id)
     and not exists (select 1 from public.team_members
                     where team_id = old.team_id and staff_kind = 'head' and user_id <> old.user_id) then
    raise exception 'last_staff';
  end if;
  return old;
end;
$$;

create or replace function public.set_staff_kind(_team uuid, _user uuid, _kind text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_team_head(_team) then raise exception 'not allowed'; end if;
  if _kind not in ('head', 'sc', 'basketball', 'medical') then raise exception 'invalid_kind'; end if;
  if not exists (select 1 from public.team_members where team_id = _team and user_id = _user and role = 'staff') then
    raise exception 'not allowed';
  end if;
  if _kind <> 'head' and not exists (select 1 from public.team_members where team_id = _team and staff_kind = 'head' and user_id <> _user) then
    raise exception 'last_head';
  end if;
  update public.team_members set staff_kind = _kind where team_id = _team and user_id = _user;
end;
$$;
revoke all on function public.set_staff_kind(uuid, uuid, text) from public, anon;
grant execute on function public.set_staff_kind(uuid, uuid, text) to authenticated;

create or replace function public.create_team(_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _id uuid; _club uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.clubs (name, created_by) values (_name, auth.uid()) returning id into _club;
  insert into public.teams (name, created_by, club_id) values (_name, auth.uid(), _club) returning id into _id;
  insert into public.team_members (team_id, user_id, role, staff_kind, consent_given, consent_at)
    values (_id, auth.uid(), 'staff', 'head', true, now());
  return _id;
end;
$$;
create or replace function public.create_team_in_club(_name text, _club uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare _id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_club_staff(_club) then raise exception 'not allowed'; end if;
  insert into public.teams (name, created_by, club_id) values (_name, auth.uid(), _club) returning id into _id;
  insert into public.team_members (team_id, user_id, role, staff_kind, consent_given, consent_at)
    values (_id, auth.uid(), 'staff', 'head', true, now());
  return _id;
end;
$$;
create or replace function public.join_team(_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _inv public.team_invites;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into _inv from public.team_invites where code = _code and expires_at > now();
  if not found then raise exception 'invalid or expired invite'; end if;
  insert into public.team_members (team_id, user_id, role, staff_kind)
    values (_inv.team_id, auth.uid(), _inv.role, case when _inv.role = 'staff' then coalesce(_inv.staff_kind, 'head') end)
    on conflict (team_id, user_id) do nothing;
  insert into public.availability (team_id, user_id) values (_inv.team_id, auth.uid()) on conflict do nothing;
  return _inv.team_id;
end;
$$;
create or replace function public.remove_member(_team uuid, _user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if _user <> auth.uid() and not public.is_team_head(_team) then raise exception 'not allowed'; end if;
  delete from public.session_logs l using public.sessions s
    where l.session_id = s.id and s.team_id = _team and l.user_id = _user;
  delete from public.team_members where team_id = _team and user_id = _user;
end;
$$;
create or replace function public.record_parent_consent(_team uuid, _user uuid, _given boolean, _note text)
returns void language plpgsql security definer set search_path = public as $$
declare _birth date;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_team_head(_team) then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.team_members where team_id = _team and user_id = _user and role = 'athlete') then
    raise exception 'not allowed';
  end if;
  select birth_date into _birth from public.profiles where id = _user;
  if _birth is null then raise exception 'birth_date_required'; end if;
  if public.age_years(_birth) >= 16 then raise exception 'athlete_must_consent_themselves'; end if;
  if _given and (_note is null or char_length(trim(_note)) = 0) then raise exception 'note_required'; end if;
  update public.team_members
     set consent_given = _given, consent_at = case when _given then now() end,
         consent_by = case when _given then 'parent' end,
         consent_note = case when _given then left(trim(_note), 200) end
   where team_id = _team and user_id = _user;
end;
$$;

-- ===== 2. Policies by role =====
drop policy if exists sessions_write on public.sessions;
create policy sessions_insert on public.sessions for insert to authenticated
  with check ((type = 'gym' and public.can_plan_gym(team_id)) or (type <> 'gym' and public.can_plan_court(team_id)));
create policy sessions_update on public.sessions for update to authenticated
  using ((type = 'gym' and public.can_plan_gym(team_id)) or (type <> 'gym' and public.can_plan_court(team_id)))
  with check ((type = 'gym' and public.can_plan_gym(team_id)) or (type <> 'gym' and public.can_plan_court(team_id)));
create policy sessions_delete on public.sessions for delete to authenticated
  using ((type = 'gym' and public.can_plan_gym(team_id)) or (type <> 'gym' and public.can_plan_court(team_id)));

drop policy if exists exclusions_insert on public.session_exclusions;
drop policy if exists exclusions_delete on public.session_exclusions;
create policy exclusions_insert on public.session_exclusions for insert to authenticated
  with check (public.is_team_planner(public.session_team(session_id)) and created_by = auth.uid());
create policy exclusions_delete on public.session_exclusions for delete to authenticated
  using (public.is_team_planner(public.session_team(session_id)));

drop policy if exists week_rules_write on public.week_rules;
create policy week_rules_write on public.week_rules for all to authenticated
  using (public.is_team_planner(team_id)) with check (public.is_team_planner(team_id));
drop policy if exists limits_write on public.athlete_limits;
create policy limits_write on public.athlete_limits for all to authenticated
  using (public.is_team_planner(team_id)) with check (public.is_team_planner(team_id));

drop policy if exists invites_staff on public.team_invites;
create policy invites_staff on public.team_invites for all to authenticated
  using (public.is_team_head(team_id)) with check (public.is_team_head(team_id));
drop policy if exists teams_update on public.teams;
create policy teams_update on public.teams for update to authenticated
  using (public.is_team_head(id)) with check (public.is_team_head(id));
drop policy if exists teams_delete on public.teams;
create policy teams_delete on public.teams for delete to authenticated
  using (public.is_team_head(id) and (created_by = auth.uid() or created_by is null));
drop policy if exists members_delete on public.team_members;
create policy members_delete on public.team_members for delete to authenticated
  using (public.is_team_head(team_id) or user_id = auth.uid());

drop policy if exists exercises_insert on public.exercises;
drop policy if exists exercises_update on public.exercises;
drop policy if exists exercises_delete on public.exercises;
create policy exercises_insert on public.exercises for insert to authenticated with check (public.is_club_sc(club_id));
create policy exercises_update on public.exercises for update to authenticated
  using (public.is_club_sc(club_id)) with check (public.is_club_sc(club_id));
create policy exercises_delete on public.exercises for delete to authenticated using (public.is_club_sc(club_id));
drop policy if exists workouts_write on public.workouts;
create policy workouts_write on public.workouts for all to authenticated
  using (public.is_club_sc(club_id)) with check (public.is_club_sc(club_id));
drop policy if exists blocks_write on public.workout_blocks;
create policy blocks_write on public.workout_blocks for all to authenticated
  using (public.is_club_sc(public.workout_club(workout_id))) with check (public.is_club_sc(public.workout_club(workout_id)));
drop policy if exists sets_write on public.workout_sets;
create policy sets_write on public.workout_sets for all to authenticated
  using (public.is_club_sc(public.block_club(block_id))) with check (public.is_club_sc(public.block_club(block_id)));

drop policy if exists runs_insert on public.workout_runs;
drop policy if exists runs_update on public.workout_runs;
drop policy if exists runs_delete on public.workout_runs;
create policy runs_insert on public.workout_runs for insert to authenticated
  with check ((user_id = auth.uid() or public.sc_staff_with(user_id)) and public.is_team_member(public.session_team(session_id)));
create policy runs_update on public.workout_runs for update to authenticated
  using (user_id = auth.uid() or public.sc_staff_with(user_id)) with check (user_id = auth.uid() or public.sc_staff_with(user_id));
create policy runs_delete on public.workout_runs for delete to authenticated
  using (user_id = auth.uid() or public.sc_staff_with(user_id));
drop policy if exists run_sets_write on public.run_sets;
create policy run_sets_write on public.run_sets for all to authenticated
  using (public.run_owner(run_id) = auth.uid() or public.sc_staff_with(public.run_owner(run_id)))
  with check (public.run_owner(run_id) = auth.uid() or public.sc_staff_with(public.run_owner(run_id)));

drop policy if exists tests_insert on public.strength_tests;
drop policy if exists tests_update on public.strength_tests;
drop policy if exists tests_delete on public.strength_tests;
create policy tests_insert on public.strength_tests for insert to authenticated
  with check (created_by = auth.uid() and (user_id = auth.uid() or public.sc_staff_with(user_id))
    and public.is_club_member((select e.club_id from public.exercises e where e.id = exercise_id)));
create policy tests_update on public.strength_tests for update to authenticated
  using (user_id = auth.uid() or public.sc_staff_with(user_id)) with check (user_id = auth.uid() or public.sc_staff_with(user_id));
create policy tests_delete on public.strength_tests for delete to authenticated
  using (user_id = auth.uid() or public.sc_staff_with(user_id));

drop policy if exists logs_insert on public.session_logs;
drop policy if exists logs_update on public.session_logs;
drop policy if exists logs_delete on public.session_logs;
create policy logs_insert on public.session_logs for insert to authenticated
  with check (public.is_team_planner(public.session_team(session_id))
    or (user_id = auth.uid() and public.is_team_member(public.session_team(session_id))));
create policy logs_update on public.session_logs for update to authenticated
  using (user_id = auth.uid() or public.is_team_planner(public.session_team(session_id)))
  with check (user_id = auth.uid() or public.is_team_planner(public.session_team(session_id)));
create policy logs_delete on public.session_logs for delete to authenticated
  using (user_id = auth.uid() or public.is_team_planner(public.session_team(session_id)));

create or replace function public.finish_workout_run(_run uuid, _duration_min int, _rpe int)
returns void language plpgsql security definer set search_path = public as $$
declare _session uuid; _owner uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if _duration_min is null or _duration_min < 1 or _duration_min > 600 then raise exception 'invalid_duration'; end if;
  if _rpe is null or _rpe < 1 or _rpe > 10 then raise exception 'invalid_rpe'; end if;
  select session_id, user_id into _session, _owner from public.workout_runs where id = _run;
  if _session is null or not (_owner = auth.uid() or public.sc_staff_with(_owner)) then raise exception 'not allowed'; end if;
  update public.workout_runs set finished_at = now(), active_seconds = _duration_min * 60 where id = _run;
  insert into public.session_logs (session_id, user_id, attended, duration_min, rpe)
    values (_session, _owner, true, _duration_min, _rpe)
    on conflict (session_id, user_id) do update
      set attended = true, duration_min = excluded.duration_min, rpe = excluded.rpe, logged_at = now();
end;
$$;
create or replace function public.set_athlete_pin(_user uuid, _pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not (_user = auth.uid() or public.sc_staff_with(_user)) then raise exception 'not allowed'; end if;
  if _pin is null or _pin !~ '^[0-9]{4,6}$' then raise exception 'invalid_pin'; end if;
  insert into public.athlete_pins (user_id, pin_hash, failed_attempts, locked_until, updated_by, updated_at)
    values (_user, crypt(_pin, gen_salt('bf')), 0, null, auth.uid(), now())
    on conflict (user_id) do update
      set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null, updated_by = auth.uid(), updated_at = now();
end;
$$;
create or replace function public.clear_athlete_pin(_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not (_user = auth.uid() or public.sc_staff_with(_user)) then raise exception 'not allowed'; end if;
  delete from public.athlete_pins where user_id = _user;
end;
$$;
create or replace function public.has_athlete_pin(_user uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if not (_user = auth.uid() or public.sc_staff_with(_user)) then return false; end if;
  return exists (select 1 from public.athlete_pins where user_id = _user);
end;
$$;
create or replace function public.kiosk_verify(_team uuid, _user uuid, _pin text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare _required boolean; _row public.athlete_pins;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.can_plan_gym(_team) then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.team_members where team_id = _team and user_id = _user and role = 'athlete') then
    raise exception 'not allowed';
  end if;
  select kiosk_pin_required into _required from public.teams where id = _team;
  if not _required then return true; end if;
  select * into _row from public.athlete_pins where user_id = _user;
  if not found then raise exception 'pin_not_set'; end if;
  if _row.locked_until is not null and _row.locked_until > now() then raise exception 'pin_locked'; end if;
  if _pin is not null and _row.pin_hash = crypt(_pin, _row.pin_hash) then
    update public.athlete_pins set failed_attempts = 0, locked_until = null where user_id = _user;
    return true;
  end if;
  update public.athlete_pins
     set locked_until = case when failed_attempts + 1 >= 5 then now() + interval '5 minutes' end,
         failed_attempts = case when failed_attempts + 1 >= 5 then 0 else failed_attempts + 1 end
   where user_id = _user;
  return false;
end;
$$;

-- ===== 3. Sessions: status, focus, location, note, series, audit =====
alter table public.sessions
  add column if not exists status text not null default 'planned' check (status in ('planned', 'completed', 'adjusted', 'cancelled')),
  add column if not exists location text check (location is null or char_length(location) <= 80),
  add column if not exists focus text[] not null default '{}',
  add column if not exists coach_note text check (coach_note is null or char_length(coach_note) <= 500),
  add column if not exists series_id uuid,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();
alter table public.sessions add constraint sessions_focus_chk check (
  focus <@ array['1v1','2v2','3v3','5v5','tactics','shooting','transition','conditioning','sprint','skills','recovery','strength','power','mobility']::text[]);
create index if not exists sessions_series_idx on public.sessions (series_id) where series_id is not null;
create or replace function public.touch_session()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
create trigger sessions_touch before update on public.sessions for each row execute function public.touch_session();

create or replace function public.team_missing_logs(_team uuid)
returns table (user_id uuid, missing int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_team_staff(_team) then raise exception 'not allowed'; end if;
  return query
  select m.user_id, count(s.id)::int
  from public.team_members m
  join public.sessions s on s.team_id = _team and s.status <> 'cancelled'
    and s.starts_at >= now() - interval '14 days'
    and s.starts_at + make_interval(mins => s.planned_duration_min) < now()
  left join public.session_logs l on l.session_id = s.id and l.user_id = m.user_id
  left join public.session_exclusions x on x.session_id = s.id and x.user_id = m.user_id
  where m.team_id = _team and m.role = 'athlete' and l.session_id is null and x.session_id is null
  group by m.user_id;
end;
$$;

-- ===== 4. Workload settings and notes =====
create table public.team_workload_settings (
  team_id uuid primary key references public.teams(id) on delete cascade,
  heavy_rpe numeric(3,1) not null default 7 check (heavy_rpe between 1 and 10),
  heavy_per_day smallint not null default 2 check (heavy_per_day between 1 and 6),
  consecutive_heavy_days smallint not null default 3 check (consecutive_heavy_days between 2 and 7),
  baseline_weeks smallint not null default 4 check (baseline_weeks between 2 and 12),
  deviation_pct smallint not null default 30 check (deviation_pct between 10 and 100),
  show_ratio boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.team_workload_settings enable row level security;
create policy wls_select on public.team_workload_settings for select to authenticated using (public.is_team_staff(team_id));
create policy wls_write on public.team_workload_settings for all to authenticated
  using (public.is_team_head(team_id)) with check (public.is_team_head(team_id));

create table public.workload_notes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  day date not null,
  reason text not null default 'other' check (reason in ('load', 'pain', 'illness', 'schedule', 'tactics', 'other')),
  note text not null check (char_length(note) between 1 and 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.workload_notes (team_id, day);
create index on public.workload_notes (user_id);
alter table public.workload_notes enable row level security;
create policy wn_select on public.workload_notes for select to authenticated using (public.is_team_staff(team_id));
create policy wn_insert on public.workload_notes for insert to authenticated
  with check (public.is_team_staff(team_id) and created_by = auth.uid());
create policy wn_delete on public.workload_notes for delete to authenticated
  using (public.is_team_head(team_id) or created_by = auth.uid());
