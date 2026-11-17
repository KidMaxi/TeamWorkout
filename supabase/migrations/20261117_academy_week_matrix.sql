-- Step 3 of docs/COURTLOAD-PLAN.md: academy week overview (the "Workload" screen of the Courtload demo).
-- One row per athlete of every team the caller may see: staff of that team (decision D: own team) or club admin.
-- Load = attended session_logs.load (RPE x minutes) of non-cancelled sessions the athlete is not excluded from;
-- days follow Europe/Amsterdam. avg_28d = (load of the 28 days ending with the selected week) / 4.
create or replace function public.academy_week_matrix(_club uuid, _week_start date default null)
returns table(team_id uuid, team_name text, user_id uuid, full_name text, jersey_number smallint, "position" text,
              day_au integer[], week_au integer, sessions integer, gym_sessions integer, avg_28d integer)
language plpgsql stable security definer set search_path to 'public' as $function$
declare _ws date := date_trunc('week', coalesce(_week_start, (now() at time zone 'Europe/Amsterdam')::date))::date;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return query
  with vis as (
    select t.id, t.name from public.teams t
     where t.club_id = _club
       and (public.is_club_admin(_club)
            or exists (select 1 from public.team_members m where m.team_id = t.id and m.user_id = auth.uid() and m.role = 'staff'))
  ), ath as (
    select v.id as tid, v.name as tname, m.user_id as uid, p.full_name as fname, m.jersey_number as jn, m.position as pos
      from vis v
      join public.team_members m on m.team_id = v.id and m.role = 'athlete'
      join public.profiles p on p.id = m.user_id
  ), lg as (
    select a.tid, a.uid, (s.starts_at at time zone 'Europe/Amsterdam')::date as d, l.load as ld, s.type::text as stype
      from ath a
      join public.sessions s on s.team_id = a.tid and s.status <> 'cancelled'
       and (s.starts_at at time zone 'Europe/Amsterdam')::date >= _ws - 21
       and (s.starts_at at time zone 'Europe/Amsterdam')::date < _ws + 7
      join public.session_logs l on l.session_id = s.id and l.user_id = a.uid and l.attended
     where not exists (select 1 from public.session_exclusions e where e.session_id = s.id and e.user_id = a.uid)
  )
  select a.tid, a.tname, a.uid, a.fname, a.jn, a.pos,
    (select array_agg(coalesce((select sum(x.ld) from lg x where x.tid = a.tid and x.uid = a.uid and x.d = _ws + k), 0)::int order by k)
       from generate_series(0, 6) k),
    coalesce((select sum(x.ld) from lg x where x.tid = a.tid and x.uid = a.uid and x.d >= _ws), 0)::int,
    (select count(*) from lg x where x.tid = a.tid and x.uid = a.uid and x.d >= _ws)::int,
    (select count(*) from lg x where x.tid = a.tid and x.uid = a.uid and x.d >= _ws and x.stype = 'gym')::int,
    round(coalesce((select sum(x.ld) from lg x where x.tid = a.tid and x.uid = a.uid), 0) / 4.0)::int
  from ath a
  order by a.tname, a.jn nulls last, a.fname;
end;
$function$;
revoke execute on function public.academy_week_matrix(uuid, date) from public, anon;
grant execute on function public.academy_week_matrix(uuid, date) to authenticated;
