-- Write policies that were FOR ALL and are split into _ins/_upd/_del by 20261117_merge_permissive_select_policies.sql.
-- ALWAYS ends in an exception "RESULT ..." (nothing persists). Semantics come from the old policies:
--   availability: is_team_staff ; team_workload_settings: is_team_head ; workouts: is_club_sc.
-- Expected (2026-11-17), per actor: ins / upd rows / del rows  (rows = affected rows, DENIED = RLS violation)
--   availability:  H ok/1/1  SC ok/1/1  B ok/1/1  M ok/1/1  A DENIED/0/0  O DENIED/0/0
--   team_workload_settings (update/delete only): H 1/1  SC 0/0  B 0/0  M 0/0  A 0/0
--   workouts: H ok/1/ERR  SC ok/1/ERR  B DENIED/0/ERR  M DENIED/0/ERR  A DENIED/0/ERR
--     (delete ERR = "permission denied for table workouts": authenticated has no DELETE grant, workouts are archived, unchanged by B-03)
-- Note: the setting/workout rows are re-created as superuser before each actor so every actor sees the same start state.
create or replace function pg_temp.t(q text) returns text language plpgsql as $f$ begin execute q; return 'ok'; exception when others then return 'DENIED:'||left(sqlerrm,40); end $f$;
create or replace function pg_temp.q(q text) returns text language plpgsql as $f$ declare v text; begin execute q into v; return coalesce(v,'-'); exception when others then return 'ERR:'||left(sqlerrm,40); end $f$;
create or replace function pg_temp.as_(u uuid) returns void language plpgsql as $f$ begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true); execute 'set local role authenticated'; end $f$;
do $$
declare H uuid:=gen_random_uuid(); SC uuid:=gen_random_uuid(); B uuid:=gen_random_uuid(); M uuid:=gen_random_uuid(); A uuid:=gen_random_uuid(); O uuid:=gen_random_uuid();
  c uuid:=gen_random_uuid(); t uuid:=gen_random_uuid(); r text:=E'\n'; i int; ids uuid[]:=array[H,SC,B,M,A,O]; nm text[]:=array['H','SC','B','M','A','O']; w uuid;
begin
  insert into auth.users(id,email) select x,x::text||'@t.local' from unnest(ids) x;
  insert into public.clubs(id,name) values (c,'TestClub');
  insert into public.teams(id,name,club_id,created_by) values (t,'TestTeam',c,H);
  insert into public.team_members(team_id,user_id,role,staff_kind,consent_given) values (t,H,'staff','head',true),(t,SC,'staff','sc',true),(t,B,'staff','basketball',true),(t,M,'staff','medical',true);
  insert into public.team_members(team_id,user_id,role,consent_given) values (t,A,'athlete',true);
  r := r || 'availability:';
  for i in 1..6 loop
    delete from public.availability where team_id=t; insert into public.availability(team_id,user_id,status) values (t,A,'limited');
    perform pg_temp.as_(ids[i]);
    r := r || ' ' || nm[i] || ' ' || pg_temp.t(format('insert into public.availability(team_id,user_id,status) values (%L,%L,''available'') on conflict do nothing',t,B))
      || '/' || pg_temp.q(format('with u as (update public.availability set note=''x'' where team_id=%L and user_id=%L returning 1) select count(*) from u',t,A))
      || '/' || pg_temp.q(format('with d as (delete from public.availability where team_id=%L and user_id=%L returning 1) select count(*) from d',t,A)) || ' ;';
    execute 'reset role';
  end loop;
  r := r || E'\nworkload_settings (insert uses defaults):';
  for i in 1..5 loop
    delete from public.team_workload_settings where team_id=t; insert into public.team_workload_settings(team_id) values (t);
    perform pg_temp.as_(ids[i]);
    r := r || ' ' || nm[i] || ' ' || pg_temp.q(format('with u as (update public.team_workload_settings set show_ratio=true where team_id=%L returning 1) select count(*) from u',t))
      || '/' || pg_temp.q(format('with d as (delete from public.team_workload_settings where team_id=%L returning 1) select count(*) from d',t)) || ' ;';
    execute 'reset role';
  end loop;
  r := r || E'\nworkouts:';
  for i in 1..5 loop
    delete from public.workouts where club_id=c; insert into public.workouts(id,club_id,name) values (gen_random_uuid(),c,'W') returning id into w;
    perform pg_temp.as_(ids[i]);
    r := r || ' ' || nm[i] || ' ' || pg_temp.t(format('insert into public.workouts(club_id,name) values (%L,''N'')',c))
      || '/' || pg_temp.q(format('with u as (update public.workouts set description=''x'' where id=%L returning 1) select count(*) from u',w))
      || '/' || pg_temp.q(format('with d as (delete from public.workouts where id=%L returning 1) select count(*) from d',w)) || ' ;';
    execute 'reset role';
  end loop;
  raise exception 'RESULT %', r;
end $$;
