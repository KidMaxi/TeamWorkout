-- Shared-device (iPad) mode: PINs and staff logging on behalf of athletes.
-- Replaces 4 policies and finish_workout_run. Run after the set-types migration.

alter table public.teams add column if not exists kiosk_pin_required boolean not null default false;

create table if not exists public.athlete_pins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text not null,
  failed_attempts smallint not null default 0,
  locked_until timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.athlete_pins enable row level security;  -- no policies: only the functions below touch it

alter table public.workout_runs
  add column if not exists logged_via text not null default 'self' check (logged_via in ('self', 'kiosk', 'coach')),
  add column if not exists logged_by uuid references auth.users(id) on delete set null;

drop policy if exists runs_insert on public.workout_runs;
drop policy if exists runs_update on public.workout_runs;
drop policy if exists runs_delete on public.workout_runs;
create policy runs_insert on public.workout_runs for insert to authenticated
  with check ((user_id = auth.uid() or public.shares_team_staff_with(user_id)) and public.is_team_member(public.session_team(session_id)));
create policy runs_update on public.workout_runs for update to authenticated
  using (user_id = auth.uid() or public.shares_team_staff_with(user_id))
  with check (user_id = auth.uid() or public.shares_team_staff_with(user_id));
create policy runs_delete on public.workout_runs for delete to authenticated
  using (user_id = auth.uid() or public.shares_team_staff_with(user_id));
drop policy if exists run_sets_write on public.run_sets;
create policy run_sets_write on public.run_sets for all to authenticated
  using (public.run_owner(run_id) = auth.uid() or public.shares_team_staff_with(public.run_owner(run_id)))
  with check (public.run_owner(run_id) = auth.uid() or public.shares_team_staff_with(public.run_owner(run_id)));

create or replace function public.finish_workout_run(_run uuid, _duration_min int, _rpe int)
returns void language plpgsql security definer set search_path = public as $$
declare _session uuid; _owner uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if _duration_min is null or _duration_min < 1 or _duration_min > 600 then raise exception 'invalid_duration'; end if;
  if _rpe is null or _rpe < 1 or _rpe > 10 then raise exception 'invalid_rpe'; end if;
  select session_id, user_id into _session, _owner from public.workout_runs where id = _run;
  if _session is null or not (_owner = auth.uid() or public.shares_team_staff_with(_owner)) then raise exception 'not allowed'; end if;
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
  if not (_user = auth.uid() or public.shares_team_staff_with(_user)) then raise exception 'not allowed'; end if;
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
  if not (_user = auth.uid() or public.shares_team_staff_with(_user)) then raise exception 'not allowed'; end if;
  delete from public.athlete_pins where user_id = _user;
end;
$$;
create or replace function public.has_athlete_pin(_user uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if not (_user = auth.uid() or public.shares_team_staff_with(_user)) then return false; end if;
  return exists (select 1 from public.athlete_pins where user_id = _user);
end;
$$;
-- 5 wrong attempts lock the athlete for 5 minutes.
create or replace function public.kiosk_verify(_team uuid, _user uuid, _pin text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare _required boolean; _row public.athlete_pins;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_team_staff(_team) then raise exception 'not allowed'; end if;
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
revoke all on function public.set_athlete_pin(uuid, text), public.clear_athlete_pin(uuid), public.has_athlete_pin(uuid), public.kiosk_verify(uuid, uuid, text) from public, anon;
grant execute on function public.set_athlete_pin(uuid, text), public.clear_athlete_pin(uuid), public.has_athlete_pin(uuid), public.kiosk_verify(uuid, uuid, text) to authenticated;
