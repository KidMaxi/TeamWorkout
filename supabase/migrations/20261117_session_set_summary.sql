-- "Gelogde sets" overview of a gym session (Gym tab of the Courtload demo): per athlete and exercise the number of working sets
-- (warm-ups excluded), the top set, and whether the workout was finished. Staff and club admins see all athletes of the session's
-- team; an athlete sees only themselves; a parent only their child; everyone else nothing.
create or replace function public.session_set_summary(_session uuid)
returns table(user_id uuid, full_name text, jersey_number smallint, exercise_id uuid, exercise_name text, sets integer, top_weight_kg numeric, top_reps integer, finished boolean)
language plpgsql stable security definer set search_path to 'public' as $function$
declare _team uuid := public.session_team(_session);
begin
  if auth.uid() is null or _team is null then raise exception 'not allowed'; end if;
  return query
  with allowed as (
    select m.user_id as uid, m.jersey_number as jn
      from public.team_members m
     where m.team_id = _team and m.role = 'athlete'
       and (public.is_team_staff(_team) or public.admin_sees_team(_team) or m.user_id = auth.uid() or public.parent_of(m.user_id))
  ), r as (
    select a.uid, a.jn, wr.id as run_id, wr.finished_at
      from allowed a join public.workout_runs wr on wr.session_id = _session and wr.user_id = a.uid
  ), top as (
    select distinct on (rs.run_id, rs.exercise_id) rs.run_id, rs.exercise_id, rs.weight_kg, rs.reps
      from public.run_sets rs join r on r.run_id = rs.run_id
     where rs.set_type <> 'warmup'
     order by rs.run_id, rs.exercise_id, rs.weight_kg desc nulls last, rs.reps desc nulls last
  )
  select r.uid, p.full_name, r.jn, e.id, e.name,
         (select count(*) from public.run_sets x where x.run_id = r.run_id and x.exercise_id = e.id and x.set_type <> 'warmup')::int,
         t.weight_kg, t.reps::int, (r.finished_at is not null)
    from r
    join public.profiles p on p.id = r.uid
    join (select distinct rs.run_id, rs.exercise_id from public.run_sets rs join r r2 on r2.run_id = rs.run_id) x on x.run_id = r.run_id
    join public.exercises e on e.id = x.exercise_id
    left join top t on t.run_id = r.run_id and t.exercise_id = e.id
   order by r.jn nulls last, p.full_name, e.name;
end;
$function$;
revoke execute on function public.session_set_summary(uuid) from public, anon;
grant execute on function public.session_set_summary(uuid) to authenticated;
