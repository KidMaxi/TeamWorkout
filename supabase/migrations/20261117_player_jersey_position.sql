-- Step 2 of docs/COURTLOAD-PLAN.md: shirt number and position, filled in by the trainers (decision G).
alter table public.team_members add column if not exists jersey_number smallint;
alter table public.team_members add column if not exists position text;
alter table public.team_members drop constraint if exists team_members_jersey_range;
alter table public.team_members add constraint team_members_jersey_range check (jersey_number is null or (jersey_number between 0 and 99));
alter table public.team_members drop constraint if exists team_members_position_valid;
alter table public.team_members add constraint team_members_position_valid
  check (position is null or position in ('point_guard', 'shooting_guard', 'small_forward', 'power_forward', 'center'));
alter table public.team_members drop constraint if exists team_members_player_info_athletes;
alter table public.team_members add constraint team_members_player_info_athletes
  check (role = 'athlete' or (jersey_number is null and position is null));
-- One shirt number per team.
create unique index if not exists team_members_jersey_uq on public.team_members (team_id, jersey_number) where jersey_number is not null;

-- Trainers (head, strength coach, basketball coach) fill in number and position. Medical staff and athletes cannot.
create or replace function public.set_player_info(_team uuid, _user uuid, _jersey smallint, _position text)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_team_planner(_team) then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.team_members where team_id = _team and user_id = _user and role = 'athlete') then
    raise exception 'not allowed';
  end if;
  if _jersey is not null and (_jersey < 0 or _jersey > 99) then raise exception 'invalid_jersey'; end if;
  if _position is not null and _position not in ('point_guard', 'shooting_guard', 'small_forward', 'power_forward', 'center') then
    raise exception 'invalid_position';
  end if;
  begin
    update public.team_members set jersey_number = _jersey, position = _position where team_id = _team and user_id = _user;
  exception when unique_violation then
    raise exception 'jersey_taken';
  end;
end;
$function$;
revoke execute on function public.set_player_info(uuid, uuid, smallint, text) from public, anon;
grant execute on function public.set_player_info(uuid, uuid, smallint, text) to authenticated;
