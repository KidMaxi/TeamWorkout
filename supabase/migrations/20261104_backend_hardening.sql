-- Back-end hardening found by the 2026-11-03 role/RLS/RPC audit (all findings were reproduced against the live
-- schema inside rolled-back transactions). Idempotent: safe to run twice.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. save_workout: the library is for head + strength coach only (RLS on workouts/blocks/sets already says so,
--    but this SECURITY DEFINER RPC accepted ANY staff kind, so basketball / medical staff could write workouts).
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.save_workout(_id uuid, _club uuid, _name text, _description text, _blocks jsonb)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare _w uuid; b jsonb; s jsonb; _bid uuid; bi int := 0; si int; _type text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_club_sc(_club) then raise exception 'not allowed'; end if;
  if jsonb_typeof(_blocks) <> 'array' or jsonb_array_length(_blocks) = 0 then raise exception 'blocks_required'; end if;
  if jsonb_array_length(_blocks) > 20 then raise exception 'too_many_blocks'; end if;
  if _id is null then
    insert into public.workouts (club_id, name, description, created_by)
      values (_club, trim(_name), nullif(trim(coalesce(_description, '')), ''), auth.uid()) returning id into _w;
  else
    update public.workouts set name = trim(_name), description = nullif(trim(coalesce(_description, '')), '')
      where id = _id and club_id = _club and archived_at is null returning id into _w;
    if _w is null then raise exception 'not allowed'; end if;
    delete from public.workout_blocks where workout_id = _w;
  end if;
  for b in select * from jsonb_array_elements(_blocks) loop
    bi := bi + 1;
    if not exists (select 1 from public.exercises where id = (b->>'exercise_id')::uuid and club_id = _club and archived_at is null) then
      raise exception 'invalid_exercise';
    end if;
    if jsonb_typeof(b->'sets') <> 'array' or jsonb_array_length(b->'sets') = 0 or jsonb_array_length(b->'sets') > 30 then
      raise exception 'sets_required';
    end if;
    insert into public.workout_blocks (workout_id, position, exercise_id, notes)
      values (_w, bi, (b->>'exercise_id')::uuid, nullif(left(trim(coalesce(b->>'notes', '')), 500), '')) returning id into _bid;
    si := 0;
    for s in select * from jsonb_array_elements(b->'sets') loop
      si := si + 1;
      _type := coalesce(nullif(s->>'set_type', ''), 'normal');
      if _type not in ('warmup', 'normal', 'failure', 'drop') then raise exception 'invalid_set_type'; end if;
      insert into public.workout_sets (block_id, position, reps, target_rpe, fixed_weight_kg, rest_seconds, set_type)
        values (_bid, si, nullif(s->>'reps','')::smallint, nullif(s->>'target_rpe','')::numeric,
                nullif(s->>'fixed_weight_kg','')::numeric, coalesce(nullif(s->>'rest_seconds','')::smallint, 90), _type);
    end loop;
  end loop;
  return _w;
end;
$function$;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. create_team_in_club: any staff kind (even medical) could open a new team in the club, becoming its head and
--    thereby is_club_sc() of the whole club library. Only an existing head of a team in that club may do that.
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.create_team_in_club(_name text, _club uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare _id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists (
    select 1 from public.team_members m join public.teams t on t.id = m.team_id
    where t.club_id = _club and m.user_id = auth.uid() and m.role = 'staff' and m.staff_kind = 'head'
  ) then raise exception 'not allowed'; end if;
  insert into public.teams (name, created_by, club_id) values (_name, auth.uid(), _club) returning id into _id;
  insert into public.team_members (team_id, user_id, role, staff_kind, consent_given, consent_at)
    values (_id, auth.uid(), 'staff', 'head', true, now());
  return _id;
end;
$function$;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. PINs belong to athletes: head / strength coach may only manage the PIN of an ATHLETE they share a team with
--    (before, they could set or clear the PIN of a colleague).
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.sc_athlete_with(_user uuid) returns boolean
language sql stable security definer set search_path to 'public' as $function$
  select exists (
    select 1 from public.team_members me join public.team_members o on o.team_id = me.team_id
    where me.user_id = auth.uid() and me.role = 'staff' and me.staff_kind in ('head', 'sc')
      and o.user_id = _user and o.role = 'athlete');
$function$;
revoke execute on function public.sc_athlete_with(uuid) from public, anon;

create or replace function public.set_athlete_pin(_user uuid, _pin text) returns void
language plpgsql security definer set search_path to 'public', 'extensions' as $function$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not (_user = auth.uid() or public.sc_athlete_with(_user)) then raise exception 'not allowed'; end if;
  if _pin is null or _pin !~ '^[0-9]{4,6}$' then raise exception 'invalid_pin'; end if;
  insert into public.athlete_pins (user_id, pin_hash, failed_attempts, locked_until, updated_by, updated_at)
    values (_user, crypt(_pin, gen_salt('bf')), 0, null, auth.uid(), now())
    on conflict (user_id) do update
      set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null, updated_by = auth.uid(), updated_at = now();
end;
$function$;

create or replace function public.clear_athlete_pin(_user uuid) returns void
language plpgsql security definer set search_path to 'public' as $function$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not (_user = auth.uid() or public.sc_athlete_with(_user)) then raise exception 'not allowed'; end if;
  delete from public.athlete_pins where user_id = _user;
end;
$function$;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. session_logs: only athletes of the session's team may have a log (staff self-logs polluted the trend), and
--    an athlete cannot log (directly or by finishing a run) on a cancelled session or one they are excluded from.
--    Planners can still correct logs on behalf of an athlete.
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.guard_session_log() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare _team uuid; _status text;
begin
  select team_id, status into _team, _status from public.sessions where id = new.session_id;
  if _team is null then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.team_members where team_id = _team and user_id = new.user_id and role = 'athlete') then
    raise exception 'not_an_athlete';
  end if;
  if auth.uid() is not null and new.user_id = auth.uid() then
    if _status = 'cancelled' then raise exception 'session_cancelled'; end if;
    if exists (select 1 from public.session_exclusions where session_id = new.session_id and user_id = new.user_id) then
      raise exception 'excluded';
    end if;
  end if;
  return new;
end;
$function$;
revoke execute on function public.guard_session_log() from public, anon, authenticated;
drop trigger if exists session_logs_guard on public.session_logs;
create trigger session_logs_guard before insert or update on public.session_logs
  for each row execute function public.guard_session_log();

-- ---------------------------------------------------------------------------------------------------------------
-- 5. workout_runs: same rules for starting a run, and the audit columns can no longer be forged:
--    own runs are always 'self' / no logged_by; runs created by someone else record that someone (auth.uid()).
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.guard_workout_run() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare _team uuid; _status text;
begin
  if tg_op = 'INSERT' then
    select team_id, status into _team, _status from public.sessions where id = new.session_id;
    if _team is null then raise exception 'not allowed'; end if;
    if not exists (select 1 from public.team_members where team_id = _team and user_id = new.user_id and role = 'athlete') then
      raise exception 'not_an_athlete';
    end if;
    if _status = 'cancelled' then raise exception 'session_cancelled'; end if;
    if exists (select 1 from public.session_exclusions where session_id = new.session_id and user_id = new.user_id) then
      raise exception 'excluded';
    end if;
    if auth.uid() is not null then
      if new.user_id = auth.uid() then
        new.logged_via := 'self'; new.logged_by := null;
      else
        new.logged_by := auth.uid();
        if new.logged_via not in ('kiosk', 'coach') then new.logged_via := 'coach'; end if;
      end if;
    end if;
  else
    if new.session_id <> old.session_id or new.user_id <> old.user_id then raise exception 'not allowed'; end if;
    if (new.logged_via is distinct from old.logged_via or new.logged_by is distinct from old.logged_by) and auth.uid() is not null then
      if auth.uid() = old.user_id then
        new.logged_via := old.logged_via; new.logged_by := old.logged_by;      -- athletes cannot rewrite the audit trail
      else
        new.logged_by := auth.uid();                                            -- staff can only stamp themselves
        if new.logged_via not in ('kiosk', 'coach') then new.logged_via := 'coach'; end if;
      end if;
    end if;
  end if;
  return new;
end;
$function$;
revoke execute on function public.guard_workout_run() from public, anon, authenticated;
drop trigger if exists workout_runs_guard on public.workout_runs;
create trigger workout_runs_guard before insert or update on public.workout_runs
  for each row execute function public.guard_workout_run();

-- ---------------------------------------------------------------------------------------------------------------
-- 6. run_sets: an exercise (and planned set) must belong to the workout of the run's session; sane upper bounds.
--    (Only on insert / when exercise_id changes, so editing a workout never blocks on old rows.)
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.guard_run_set() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare _workout uuid;
begin
  select s.workout_id into _workout
    from public.workout_runs r join public.sessions s on s.id = r.session_id where r.id = new.run_id;
  if _workout is null or not exists (
    select 1 from public.workout_blocks where workout_id = _workout and exercise_id = new.exercise_id
  ) then raise exception 'invalid_exercise'; end if;
  if new.set_id is not null and not exists (
    select 1 from public.workout_sets ws join public.workout_blocks b on b.id = ws.block_id
    where ws.id = new.set_id and b.workout_id = _workout and b.exercise_id = new.exercise_id
  ) then raise exception 'invalid_exercise'; end if;
  return new;
end;
$function$;
revoke execute on function public.guard_run_set() from public, anon, authenticated;
drop trigger if exists run_sets_guard on public.run_sets;
create trigger run_sets_guard before insert or update of exercise_id on public.run_sets
  for each row execute function public.guard_run_set();

alter table public.run_sets drop constraint if exists run_sets_set_index_max;
alter table public.run_sets add constraint run_sets_set_index_max check (set_index <= 1000) not valid;
alter table public.run_sets drop constraint if exists run_sets_weight_max;
alter table public.run_sets add constraint run_sets_weight_max check (weight_kg <= 1000) not valid;

-- ---------------------------------------------------------------------------------------------------------------
-- 7. finish_workout_run: a second finish silently overwrote the log (45 min x 6 became 10 x 3); finishing a run of a
--    cancelled session created a log for it. Now refused ('already_finished', 'session_cancelled', 'excluded').
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.finish_workout_run(_run uuid, _duration_min integer, _rpe integer)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare _session uuid; _owner uuid; _finished timestamptz; _status text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if _duration_min is null or _duration_min < 1 or _duration_min > 600 then raise exception 'invalid_duration'; end if;
  if _rpe is null or _rpe < 1 or _rpe > 10 then raise exception 'invalid_rpe'; end if;
  select session_id, user_id, finished_at into _session, _owner, _finished from public.workout_runs where id = _run for update;
  if _session is null or not (_owner = auth.uid() or public.sc_staff_with(_owner)) then raise exception 'not allowed'; end if;
  if _finished is not null then raise exception 'already_finished'; end if;
  select status into _status from public.sessions where id = _session;
  if _status = 'cancelled' then raise exception 'session_cancelled'; end if;
  if exists (select 1 from public.session_exclusions where session_id = _session and user_id = _owner) then raise exception 'excluded'; end if;
  update public.workout_runs set finished_at = now(), active_seconds = _duration_min * 60 where id = _run;
  insert into public.session_logs (session_id, user_id, attended, duration_min, rpe)
    values (_session, _owner, true, _duration_min, _rpe)
    on conflict (session_id, user_id) do update
      set attended = true, duration_min = excluded.duration_min, rpe = excluded.rpe, logged_at = now();
end;
$function$;

-- ---------------------------------------------------------------------------------------------------------------
-- 8. remove_member: also remove the athlete's team-bound personal data (runs + sets, exclusions, staff notes about
--    them, personal week rules). Availability / limits already cascade from team_members.
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.remove_member(_team uuid, _user uuid) returns void
language plpgsql security definer set search_path to 'public' as $function$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if _user <> auth.uid() and not public.is_team_head(_team) then raise exception 'not allowed'; end if;
  delete from public.session_logs l using public.sessions s
    where l.session_id = s.id and s.team_id = _team and l.user_id = _user;
  delete from public.workout_runs r using public.sessions s
    where r.session_id = s.id and s.team_id = _team and r.user_id = _user;          -- run_sets cascade
  delete from public.session_exclusions x using public.sessions s
    where x.session_id = s.id and s.team_id = _team and x.user_id = _user;
  delete from public.workload_notes where team_id = _team and user_id = _user;
  delete from public.week_rules where team_id = _team and user_id = _user;
  delete from public.team_members where team_id = _team and user_id = _user;
end;
$function$;

-- Members can only be removed through remove_member (direct deletes skipped all of the above); hard-deleting
-- exercises / workouts cascaded into run_sets and strength_tests (data loss) - the app archives instead.
revoke delete on public.team_members from authenticated;
revoke delete on public.exercises, public.workouts from authenticated;
-- The app never talks to tables as the anon role; RLS already denies, this removes the grants as well.
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------------------------------------------
-- 9. A club (and its library) without any team is unreachable; drop it with its last team. (Deleting a team or an
--    account left the club, exercises and workouts behind.)
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.drop_empty_club() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
begin
  delete from public.clubs c where c.id = old.club_id and not exists (select 1 from public.teams t where t.club_id = c.id);
  return null;
end;
$function$;
revoke execute on function public.drop_empty_club() from public, anon, authenticated;
drop trigger if exists teams_drop_empty_club on public.teams;
create trigger teams_drop_empty_club after delete on public.teams
  for each row execute function public.drop_empty_club();

-- ---------------------------------------------------------------------------------------------------------------
-- 10. Workload RPCs: athletes only (a staff self-log inflated the trend), logs of sessions an athlete is excluded
--     from are ignored, weeks follow Europe/Amsterdam like the app, and _weeks is clamped (100000 weeks returned
--     100000 rows).
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.team_load_overview(_team uuid)
returns table(user_id uuid, full_name text, availability availability_status, availability_note text, acute_load integer,
              chronic_weekly_avg numeric, acwr numeric, max_weekly_load integer, over_limit boolean, has_baseline boolean)
language plpgsql stable security definer set search_path to 'public' as $function$
begin
  if not public.is_team_staff(_team) then raise exception 'not allowed'; end if;
  return query
  with agg as (
    select m.user_id,
      coalesce(sum(x.load) filter (where x.starts_at >= now() - interval '7 days'), 0)::int as acute,
      coalesce(sum(x.load) filter (where x.starts_at >= now() - interval '28 days'), 0)::numeric / 4 as chronic,
      min(x.starts_at) filter (where x.attended) as first_log
    from public.team_members m
    left join lateral (
      select l.load, l.attended, s.starts_at
      from public.session_logs l
      join public.sessions s on s.id = l.session_id and s.team_id = _team and s.status <> 'cancelled'
      where l.user_id = m.user_id
        and not exists (select 1 from public.session_exclusions e where e.session_id = s.id and e.user_id = m.user_id)
    ) x on true
    where m.team_id = _team and m.role = 'athlete'
    group by m.user_id
  )
  select a.user_id, p.full_name, av.status, av.note, a.acute,
    round(a.chronic, 1),
    case when a.chronic > 0 and a.first_log <= now() - interval '28 days'
         then round(a.acute / a.chronic, 2) end,
    lim.max_weekly_load,
    coalesce(a.acute > lim.max_weekly_load, false),
    coalesce(a.first_log <= now() - interval '28 days', false)
  from agg a
  join public.profiles p on p.id = a.user_id
  left join public.availability av on av.team_id = _team and av.user_id = a.user_id
  left join public.athlete_limits lim on lim.team_id = _team and lim.user_id = a.user_id
  order by p.full_name;
end;
$function$;

create or replace function public.team_week_trend(_team uuid, _weeks integer default 8)
returns table(week_start date, total_load integer, athletes_logged integer)
language plpgsql stable security definer set search_path to 'public' as $function$
begin
  if not public.is_team_staff(_team) then raise exception 'not allowed'; end if;
  return query
  with weeks as (
    select (date_trunc('week', now() at time zone 'Europe/Amsterdam')::date - (g * 7)) as ws
    from generate_series(0, least(greatest(coalesce(_weeks, 8), 1), 52) - 1) g
  )
  select w.ws,
    coalesce(sum(x.load), 0)::int,
    (count(distinct x.user_id) filter (where x.attended))::int
  from weeks w
  left join lateral (
    select l.load, l.attended, l.user_id
    from public.sessions s
    join public.session_logs l on l.session_id = s.id
    join public.team_members m on m.team_id = s.team_id and m.user_id = l.user_id and m.role = 'athlete'
    where s.team_id = _team and s.status <> 'cancelled'
      and (s.starts_at at time zone 'Europe/Amsterdam')::date >= w.ws
      and (s.starts_at at time zone 'Europe/Amsterdam')::date < w.ws + 7
      and not exists (select 1 from public.session_exclusions e where e.session_id = s.id and e.user_id = l.user_id)
  ) x on true
  group by w.ws
  order by w.ws;
end;
$function$;

-- ---------------------------------------------------------------------------------------------------------------
-- 11. Length / range constraints the UI already assumes (NOT VALID: enforced for new writes, existing rows untouched).
-- ---------------------------------------------------------------------------------------------------------------
alter table public.session_logs drop constraint if exists session_logs_attended_min;
alter table public.session_logs add constraint session_logs_attended_min check (not attended or duration_min >= 1) not valid;
alter table public.sessions drop constraint if exists sessions_title_len;
alter table public.sessions add constraint sessions_title_len check (char_length(title) <= 120) not valid;
alter table public.availability drop constraint if exists availability_note_len;
alter table public.availability add constraint availability_note_len check (note is null or char_length(note) <= 500) not valid;
alter table public.athlete_limits drop constraint if exists athlete_limits_note_len;
alter table public.athlete_limits add constraint athlete_limits_note_len check (note is null or char_length(note) <= 500) not valid;
alter table public.profiles drop constraint if exists profiles_full_name_len;
alter table public.profiles add constraint profiles_full_name_len check (char_length(full_name) <= 80) not valid;
alter table public.profiles drop constraint if exists profiles_birth_date_range;
alter table public.profiles add constraint profiles_birth_date_range check (birth_date is null or (birth_date >= date '1900-01-01' and birth_date <= current_date)) not valid;

-- Sign-up must never fail on a long name from user metadata.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into public.profiles (id, full_name, terms_accepted_at, terms_version)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'full_name', ''), 80),
    case when new.raw_user_meta_data ? 'accepted_terms_version' then now() end,
    nullif(new.raw_user_meta_data->>'accepted_terms_version', '')
  );
  return new;
end;
$function$;
