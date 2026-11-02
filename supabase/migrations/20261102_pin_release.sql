-- Let a coach see which athletes are PIN-locked on the iPad and release the lock early.
-- Authorisation mirrors kiosk_verify (public.can_plan_gym = head or strength coach, i.e. the
-- 'manageLibrary' capability in src/lib/roles.ts, which also covers iPad mode and PIN management).

create or replace function public.kiosk_locked_users(_team uuid)
returns table(user_id uuid, locked_until timestamptz)
language plpgsql stable security definer set search_path = public, extensions as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.can_plan_gym(_team) then raise exception 'not allowed'; end if;
  return query
    select p.user_id, p.locked_until
      from public.athlete_pins p
      join public.team_members m on m.user_id = p.user_id and m.team_id = _team and m.role = 'athlete'
     where p.locked_until is not null and p.locked_until > now();
end;
$$;

create or replace function public.kiosk_release_pin(_team uuid, _user uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.can_plan_gym(_team) then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.team_members where team_id = _team and user_id = _user and role = 'athlete') then
    raise exception 'not allowed';
  end if;
  update public.athlete_pins set failed_attempts = 0, locked_until = null where user_id = _user;
end;
$$;

revoke all on function public.kiosk_locked_users(uuid), public.kiosk_release_pin(uuid, uuid) from public, anon;
grant execute on function public.kiosk_locked_users(uuid), public.kiosk_release_pin(uuid, uuid) to authenticated;
