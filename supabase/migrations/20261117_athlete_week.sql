-- Week numbers of ONE athlete (same columns as academy_week_matrix): for the athlete, their parent, staff of their team, or a club admin.
create or replace function public.athlete_week(_user uuid, _week_start date default null)
returns table(team_id uuid, team_name text, user_id uuid, full_name text, jersey_number smallint, "position" text,
              day_au integer[], week_au integer, sessions integer, gym_sessions integer, avg_28d integer)
language plpgsql stable security definer set search_path to 'public' as $function$
declare _ws date := date_trunc('week', coalesce(_week_start, (now() at time zone 'Europe/Amsterdam')::date))::date;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not (_user = auth.uid() or public.parent_of(_user) or public.shares_team_staff_with(_user) or public.admin_sees_user(_user)) then
    raise exception 'not allowed';
  end if;
  return query
  with ath as (
    select m.team_id as tid, t.name as tname, m.user_id as uid, p.full_name as fname, m.jersey_number as jn, m.position as pos
      from public.team_members m
      join public.teams t on t.id = m.team_id
      join public.profiles p on p.id = m.user_id
     where m.user_id = _user and m.role = 'athlete'
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
  order by a.tname;
end;
$function$;
revoke execute on function public.athlete_week(uuid, date) from public, anon;
grant execute on function public.athlete_week(uuid, date) to authenticated;
