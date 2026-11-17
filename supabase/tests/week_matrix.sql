-- academy_week_matrix + athlete_week test. ALWAYS ends in an exception "RESULT ..." (nothing persists).
-- Fixture (athlete A1, this Amsterdam week Mon..Sun): Mon academy 5x60=300, Tue cancelled (log 999), Wed gym 6x30=180,
--   Thu excluded (log 999), Fri attended=false, previous week Mon 400.
-- Expected (2026-11-17), row = day_au | week_au sessions gym avg_28d:
--   H  matrix : A1 row {300,0,180,0,0,0,0} | 480 2 1 220; then A2 row {0,0,0,0,0,0,0} | 0 0 0 0  (teammate without logs)
--   A1 matrix : 0 rows (athletes see nothing)         O matrix: 0 rows
--   athlete_week(A1) as A1, H, AD: identical row to the matrix; as A2 (teammate) and O: DENIED:not allowed
--   unauthenticated: ERR:not authenticated
create or replace function pg_temp.t(q text) returns text language plpgsql as $f$ begin execute q; return 'ok'; exception when others then return 'DENIED:'||left(sqlerrm,40); end $f$;
create or replace function pg_temp.q(q text) returns text language plpgsql as $f$ declare v text; begin execute q into v; return coalesce(v,'-'); exception when others then return 'ERR:'||left(sqlerrm,40); end $f$;
create or replace function pg_temp.as_(u uuid) returns void language plpgsql as $f$ begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true); execute 'set local role authenticated'; end $f$;
do $$
declare H uuid:=gen_random_uuid(); AD uuid:=gen_random_uuid(); O uuid:=gen_random_uuid(); a1 uuid:=gen_random_uuid(); a2 uuid:=gen_random_uuid();
  c uuid:=gen_random_uuid(); t uuid:=gen_random_uuid(); ws date:=date_trunc('week',(now() at time zone 'Europe/Amsterdam')::date)::date;
  s uuid; r text:=E'\n'; i int; ids uuid[]; names text[]:=array['H','AD','A1','O'];
  m text:='select string_agg(day_au::text||'' | ''||week_au||'' ''||sessions||'' ''||gym_sessions||'' ''||avg_28d,''; '') from public.academy_week_matrix(%L,%L)';
  w text:='select string_agg(day_au::text||'' | ''||week_au||'' ''||sessions||'' ''||gym_sessions||'' ''||avg_28d,''; '') from public.athlete_week(%L,%L)';
begin
  insert into auth.users(id,email) select x,x::text||'@t.local' from unnest(array[H,AD,O,a1,a2]) x;
  insert into public.clubs(id,name) values (c,'TestClub');
  insert into public.teams(id,name,club_id,created_by) values (t,'TestTeam',c,H);
  insert into public.team_members(team_id,user_id,role,staff_kind,consent_given) values (t,H,'staff','head',true);
  insert into public.team_members(team_id,user_id,role,consent_given) values (t,a1,'athlete',true),(t,a2,'athlete',true);
  insert into public.club_admins(club_id,user_id) values (c,AD);
  insert into public.sessions(team_id,type,starts_at,planned_duration_min) values (t,'academy',(ws::timestamp+interval '12 hours') at time zone 'UTC',60) returning id into s;
  insert into public.session_logs(session_id,user_id,attended,duration_min,rpe) values (s,a1,true,60,5);
  insert into public.sessions(team_id,type,starts_at,planned_duration_min) values (t,'academy',(ws::timestamp+interval '1 day 12 hours') at time zone 'UTC',60) returning id into s;
  insert into public.session_logs(session_id,user_id,attended,duration_min,rpe) values (s,a1,true,111,9);
  update public.sessions set status='cancelled' where id=s;
  insert into public.sessions(team_id,type,starts_at,planned_duration_min) values (t,'gym',(ws::timestamp+interval '2 days 12 hours') at time zone 'UTC',60) returning id into s;
  insert into public.session_logs(session_id,user_id,attended,duration_min,rpe) values (s,a1,true,30,6);
  insert into public.sessions(team_id,type,starts_at,planned_duration_min) values (t,'academy',(ws::timestamp+interval '3 days 12 hours') at time zone 'UTC',60) returning id into s;
  insert into public.session_logs(session_id,user_id,attended,duration_min,rpe) values (s,a1,true,111,9);
  insert into public.session_exclusions(session_id,user_id) values (s,a1);
  insert into public.sessions(team_id,type,starts_at,planned_duration_min) values (t,'academy',(ws::timestamp+interval '4 days 12 hours') at time zone 'UTC',60) returning id into s;
  insert into public.session_logs(session_id,user_id,attended) values (s,a1,false);
  insert into public.sessions(team_id,type,starts_at,planned_duration_min) values (t,'academy',((ws-7)::timestamp+interval '12 hours') at time zone 'UTC',60) returning id into s;
  insert into public.session_logs(session_id,user_id,attended,duration_min,rpe) values (s,a1,true,80,5);
  ids:=array[H,AD,a1,O];
  for i in 1..4 loop
    perform pg_temp.as_(ids[i]);
    r := r || rpad(names[i],3) || ' matrix: ' || pg_temp.q(format(m,c,ws)) || ' | athlete_week(A1): ' || pg_temp.q(format(w,a1,ws)) || E'\n';
    execute 'reset role';
  end loop;
  perform pg_temp.as_(a2);
  r := r || 'A2 athlete_week(A1): ' || pg_temp.q(format(w,a1,ws)) || E'\n';
  execute 'reset role'; perform set_config('request.jwt.claims','',true);
  r := r || 'unauth: ' || pg_temp.q(format(m,c,ws)) || E'\n';
  raise exception 'RESULT %', r;
end $$;
