-- Step 6 of docs/COURTLOAD-PLAN.md: club leaderboard ("Club records"). Decision C: on, but athletes under 16 are
-- neither ranked nor allowed to view it. An athlete without a birth date counts as under 16 (conservative).
-- Ranking = best five_rm_kg per athlete per exercise that has track_5rm. Viewers: staff and admins of the club,
-- and athletes of the club aged 16 or older.
create or replace function public.leaderboard_access(_club uuid) returns boolean
language sql stable security definer set search_path to 'public' as $function$
  select public.is_club_staff(_club) or public.is_club_admin(_club) or exists (
    select 1 from public.team_members m
      join public.teams t on t.id = m.team_id and t.club_id = _club
      join public.profiles p on p.id = m.user_id
     where m.user_id = auth.uid() and m.role = 'athlete'
       and p.birth_date is not null and public.age_years(p.birth_date) >= 16);
$function$;

create or replace function public.club_record_exercises(_club uuid)
returns table(exercise_id uuid, name text, athletes integer)
language plpgsql stable security definer set search_path to 'public' as $function$
begin
  if auth.uid() is null or not public.leaderboard_access(_club) then raise exception 'not allowed'; end if;
  return query
  select e.id, e.name, count(distinct st.user_id)::int
    from public.exercises e
    join public.strength_tests st on st.exercise_id = e.id
    join public.profiles p on p.id = st.user_id and p.birth_date is not null and public.age_years(p.birth_date) >= 16
   where e.club_id = _club and e.track_5rm and e.archived_at is null and st.five_rm_kg is not null
     and exists (select 1 from public.team_members m join public.teams t on t.id = m.team_id
                  where m.user_id = st.user_id and m.role = 'athlete' and t.club_id = _club)
   group by e.id, e.name
   order by count(distinct st.user_id) desc, e.name;
end;
$function$;

create or replace function public.club_records(_club uuid, _exercise uuid)
returns table(rank integer, user_id uuid, full_name text, team_name text, jersey_number smallint, best_kg numeric, tested_at date)
language plpgsql stable security definer set search_path to 'public' as $function$
begin
  if auth.uid() is null or not public.leaderboard_access(_club) then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.exercises where id = _exercise and club_id = _club and track_5rm) then
    raise exception 'not allowed';
  end if;
  return query
  with best as (
    select distinct on (st.user_id) st.user_id as uid, st.five_rm_kg as kg, st.tested_at as dt
      from public.strength_tests st
      join public.profiles p on p.id = st.user_id and p.birth_date is not null and public.age_years(p.birth_date) >= 16
     where st.exercise_id = _exercise and st.five_rm_kg is not null
     order by st.user_id, st.five_rm_kg desc, st.tested_at asc
  ), home as (
    select distinct on (m.user_id) m.user_id as uid, t.name as tname, m.jersey_number as jn
      from public.team_members m join public.teams t on t.id = m.team_id
     where m.role = 'athlete' and t.club_id = _club
     order by m.user_id, t.name
  )
  select (rank() over (order by b.kg desc, b.dt asc))::int, b.uid, p.full_name, h.tname, h.jn, b.kg, b.dt
    from best b join home h on h.uid = b.uid join public.profiles p on p.id = b.uid
   order by 1, p.full_name;
end;
$function$;

revoke execute on function public.leaderboard_access(uuid), public.club_record_exercises(uuid), public.club_records(uuid, uuid) from public, anon;
grant execute on function public.leaderboard_access(uuid), public.club_record_exercises(uuid), public.club_records(uuid, uuid) to authenticated;
