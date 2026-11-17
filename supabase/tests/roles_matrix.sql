-- Role / RLS matrix test. Run with the Supabase SQL editor or MCP execute_sql; it ALWAYS ends in an exception
-- ("RESULT ...") so nothing is persisted. Compare the output with the expectations below.
--
-- Expected (2026-11-17, after 20261117_multi_roles_club_admin.sql):
--   H(head)        gym:ok court:ok        ... WELLNESS:1 isAdmin:0 kinds:1
--   MC(bball+sc)   gym:ok court:ok        ... WELLNESS:1 isAdmin:0 kinds:2   (union of roles)
--   B(bball)       gym:DENIED court:ok    ... WELLNESS:1
--   M(medical)     gym:DENIED court:DENIED
--   A(athlete)     gym:DENIED court:DENIED  members:1 profiles:1 (own data only)
--   AD(admin)      gym:DENIED court:DENIED  sees sessions/members/profiles, WELLNESS:0 pins:0 isAdmin:1
--   O(outsider)    everything DENIED / 0 rows
--   ADMIN write tests: update session=0 delete log=0 insert log=DENIED
--   set_staff_kinds: ok | extra head DENIED:invalid_kind | last head DENIED:last_head | non-head DENIED:not allowed
--   join staff w/o kind DENIED:staff_kind_required | join as admin ok | admin sees sessions but 0 wellness, not a team member
--
-- Fixture note: auth.users rows are inserted with id + email only; handle_new_user creates the profiles.

create or replace function pg_temp.t(q text) returns text language plpgsql as $f$ begin execute q; return 'ok'; exception when others then return 'DENIED:'||left(sqlerrm,40); end $f$;
create or replace function pg_temp.n(q text) returns text language plpgsql as $f$ declare v bigint; begin execute q into v; return v::text; exception when others then return 'ERR:'||left(sqlerrm,40); end $f$;
do $$
declare
  H uuid := gen_random_uuid(); MC uuid := gen_random_uuid(); B uuid := gen_random_uuid(); M uuid := gen_random_uuid();
  A uuid := gen_random_uuid(); AD uuid := gen_random_uuid(); O uuid := gen_random_uuid();
  c uuid := gen_random_uuid(); t uuid := gen_random_uuid(); s uuid; r text := E'\n'; who uuid; nm text;
  actors uuid[]; names text[] := array['H(head)','MC(bball+sc)','B(bball)','M(medical)','A(athlete)','AD(admin)','O(outsider)'];
  i int;
begin
  insert into auth.users(id, email) select x, x::text||'@t.local' from unnest(array[H,MC,B,M,A,AD,O]) x;
  insert into public.clubs(id, name) values (c, 'TestClub');
  insert into public.teams(id, name, club_id, created_by) values (t, 'TestTeam', c, H);
  insert into public.team_members(team_id, user_id, role, staff_kind, extra_kinds, consent_given) values
    (t, H, 'staff', 'head', '{}', true), (t, MC, 'staff', 'basketball', '{sc}', true),
    (t, B, 'staff', 'basketball', '{}', true), (t, M, 'staff', 'medical', '{}', true);
  insert into public.team_members(team_id, user_id, role, consent_given, consent_at, consent_by) values (t, A, 'athlete', true, now(), 'self');
  insert into public.club_admins(club_id, user_id) values (c, AD);
  insert into public.sessions(team_id, type, starts_at, planned_duration_min) values (t, 'academy', now() + interval '1 day', 60) returning id into s;
  insert into public.session_logs(session_id, user_id, attended, duration_min, rpe) values (s, A, true, 60, 6);
  insert into public.wellness_checks(user_id, day, sleep, soreness, fatigue, stress, mood) values (A, current_date, 3, 3, 3, 3, 3);
  actors := array[H, MC, B, M, A, AD, O];
  for i in 1..7 loop
    who := actors[i]; nm := names[i];
    perform set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    r := r || rpad(nm, 14)
      || ' gym:' || pg_temp.t(format('insert into public.sessions(team_id,type,starts_at,planned_duration_min) values (%L,''gym'',now()+interval ''2 day'',60)', t))
      || ' court:' || pg_temp.t(format('insert into public.sessions(team_id,type,starts_at,planned_duration_min) values (%L,''academy'',now()+interval ''3 day'',60)', t))
      || ' | sees sessions:' || pg_temp.n(format('select count(*) from public.sessions where team_id=%L', t))
      || ' logs:' || pg_temp.n('select count(*) from public.session_logs')
      || ' members:' || pg_temp.n(format('select count(*) from public.team_members where team_id=%L', t))
      || ' profiles:' || pg_temp.n('select count(*) from public.profiles')
      || ' WELLNESS:' || pg_temp.n('select count(*) from public.wellness_checks')
      || ' pins:' || pg_temp.n('select count(*) from public.athlete_pins')
      || ' isAdmin:' || pg_temp.n(format('select case when public.is_club_admin(%L) then 1 else 0 end', c))
      || ' kinds:' || pg_temp.n(format('select cardinality(public.staff_kinds(%L))', t))
      || E'\n';
    execute 'reset role';
  end loop;
  perform set_config('request.jwt.claims', json_build_object('sub', AD, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  r := r || 'ADMIN write tests: update session=' || pg_temp.n(format('with u as (update public.sessions set title=''x'' where team_id=%L returning 1) select count(*) from u', t))
        || ' delete log=' || pg_temp.n('with d as (delete from public.session_logs returning 1) select count(*) from d')
        || ' insert log=' || pg_temp.t(format('insert into public.session_logs(session_id,user_id,attended,duration_min,rpe) values (%L,%L,true,30,5)', s, A)) || E'\n';
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', H, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  r := r || 'head sets B -> bball+medical: ' || pg_temp.t(format('select public.set_staff_kinds(%L,%L,''basketball'',''{medical}'')', t, B))
        || ' | extra head: ' || pg_temp.t(format('select public.set_staff_kinds(%L,%L,''basketball'',''{head}'')', t, B))
        || ' | self -> sc (last head): ' || pg_temp.t(format('select public.set_staff_kinds(%L,%L,''sc'',''{}'')', t, H)) || E'\n';
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', MC, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  r := r || 'non-head set_staff_kinds: ' || pg_temp.t(format('select public.set_staff_kinds(%L,%L,''head'',''{}'')', t, MC)) || E'\n';
  execute 'reset role';
  insert into public.team_invites(code, team_id, role, staff_kind, created_by, expires_at) values ('ADMINCODE1', t, 'staff', 'admin', H, now() + interval '1 day');
  insert into public.team_invites(code, team_id, role, created_by, expires_at) values ('NOKIND0001', t, 'staff', H, now() + interval '1 day');
  perform set_config('request.jwt.claims', json_build_object('sub', O, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  r := r || 'join staff w/o kind: ' || pg_temp.t('select public.join_team(''NOKIND0001'')')
        || ' | join as admin: ' || pg_temp.t('select public.join_team(''ADMINCODE1'')')
        || ' | O isAdmin now: ' || pg_temp.n(format('select case when public.is_club_admin(%L) then 1 else 0 end', c))
        || ' | O sees sessions: ' || pg_temp.n(format('select count(*) from public.sessions where team_id=%L', t))
        || ' | O sees wellness: ' || pg_temp.n('select count(*) from public.wellness_checks')
        || ' | O member of team: ' || pg_temp.n(format('select count(*) from public.team_members where team_id=%L and user_id=%L', t, O)) || E'\n';
  execute 'reset role';
  raise exception 'RESULT %', r;
end $$;
