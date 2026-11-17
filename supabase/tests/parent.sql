-- Parent role test (invite flow, read-only access, consent + minor rule). ALWAYS ends in an exception "RESULT ..." (nothing persists).
-- Fixture: A1 = minor (15y, consent), A2 = teammate. H head, MED medical, P parent, O outsider.
-- Expected (2026-11-17):
--   invite: MED create: DENIED:not allowed | H create for A1: ok(code) | H for staff user MED: DENIED:not allowed
--   P join: ok (returns A1) | second join same code: DENIED:invalid or expired invite | O join with used code: DENIED:invalid or expired invite
--   P sees (A1 minor, consent): profiles of A1/A2 = 1/0 | team_members of team = 1 | logs = 1 | sessions = 1 | wellness = 1
--   P write attempts: insert log DENIED | update profile = 0 rows
--   A1 turns 19: P wellness = 0 (adult) while logs stay 1
--   O remove_parent_link(P,A1): DENIED:not allowed | P remove own link: ok | afterwards P sees A1 profile = 0, logs = 0
create or replace function pg_temp.t(q text) returns text language plpgsql as $f$ begin execute q; return 'ok'; exception when others then return 'DENIED:'||left(sqlerrm,40); end $f$;
create or replace function pg_temp.q(q text) returns text language plpgsql as $f$ declare v text; begin execute q into v; return coalesce(v,'-'); exception when others then return 'ERR:'||left(sqlerrm,40); end $f$;
create or replace function pg_temp.as_(u uuid) returns void language plpgsql as $f$ begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true); execute 'set local role authenticated'; end $f$;
do $$
declare H uuid:=gen_random_uuid(); MED uuid:=gen_random_uuid(); P uuid:=gen_random_uuid(); O uuid:=gen_random_uuid(); a1 uuid:=gen_random_uuid(); a2 uuid:=gen_random_uuid();
  c uuid:=gen_random_uuid(); t uuid:=gen_random_uuid(); s uuid; code text; r text:=E'\n';
begin
  insert into auth.users(id,email) select x,x::text||'@t.local' from unnest(array[H,MED,P,O,a1,a2]) x;
  update public.profiles set birth_date=current_date - interval '15 years' where id=a1;
  insert into public.clubs(id,name) values (c,'TestClub');
  insert into public.teams(id,name,club_id,created_by) values (t,'TestTeam',c,H);
  insert into public.team_members(team_id,user_id,role,staff_kind,consent_given) values (t,H,'staff','head',true),(t,MED,'staff','medical',true);
  insert into public.team_members(team_id,user_id,role,consent_given) values (t,a1,'athlete',true),(t,a2,'athlete',true);
  insert into public.sessions(team_id,type,starts_at,planned_duration_min) values (t,'academy',now()+interval '1 day',60) returning id into s;
  insert into public.session_logs(session_id,user_id,attended,duration_min,rpe) values (s,a1,true,60,6),(s,a2,true,60,6);
  insert into public.wellness_checks(user_id,day,sleep,soreness,fatigue,stress,mood) values (a1,current_date,3,3,3,3,3),(a2,current_date,3,3,3,3,3);
  perform pg_temp.as_(MED); r := r || 'invite MED: ' || pg_temp.t(format('select public.create_parent_invite(%L,%L)',t,a1));
  execute 'reset role'; perform pg_temp.as_(H);
  r := r || ' | H for A1: ' || pg_temp.t(format('select public.create_parent_invite(%L,%L)',t,a1))
        || ' | H for staff: ' || pg_temp.t(format('select public.create_parent_invite(%L,%L)',t,MED)) || E'\n';
  code := public.create_parent_invite(t,a1);
  execute 'reset role'; perform pg_temp.as_(P);
  r := r || 'P join: ' || pg_temp.q(format('select (public.join_as_parent(%L) = %L)::text',code,a1));
  r := r || ' | second join: ' || pg_temp.t(format('select public.join_as_parent(%L)',code));
  execute 'reset role'; perform pg_temp.as_(O);
  r := r || ' | O join used code: ' || pg_temp.t(format('select public.join_as_parent(%L)',code)) || E'\n';
  execute 'reset role'; perform pg_temp.as_(P);
  r := r || 'P sees profiles A1/A2=' || pg_temp.q(format('select count(*) from public.profiles where id=%L',a1)) || '/' || pg_temp.q(format('select count(*) from public.profiles where id=%L',a2))
    || ' members=' || pg_temp.q(format('select count(*) from public.team_members where team_id=%L',t))
    || ' logs=' || pg_temp.q('select count(*) from public.session_logs')
    || ' sessions=' || pg_temp.q(format('select count(*) from public.sessions where team_id=%L',t))
    || ' wellness=' || pg_temp.q('select count(*) from public.wellness_checks') || E'\n';
  r := r || 'P insert log: ' || pg_temp.t(format('insert into public.session_logs(session_id,user_id,attended,duration_min,rpe) values (%L,%L,true,10,5)',s,a1))
    || ' | update profile rows=' || pg_temp.q(format('with u as (update public.profiles set full_name=''x'' where id=%L returning 1) select count(*) from u',a1)) || E'\n';
  execute 'reset role';
  update public.profiles set birth_date=current_date - interval '19 years' where id=a1;
  perform pg_temp.as_(P);
  r := r || 'A1 now 19: P wellness=' || pg_temp.q('select count(*) from public.wellness_checks') || ' logs=' || pg_temp.q('select count(*) from public.session_logs') || E'\n';
  execute 'reset role'; perform pg_temp.as_(O);
  r := r || 'O remove link: ' || pg_temp.t(format('select public.remove_parent_link(%L,%L)',P,a1));
  execute 'reset role'; perform pg_temp.as_(P);
  r := r || ' | P remove own: ' || pg_temp.t(format('select public.remove_parent_link(%L,%L)',P,a1))
    || ' | after: profile A1=' || pg_temp.q(format('select count(*) from public.profiles where id=%L',a1)) || ' logs=' || pg_temp.q('select count(*) from public.session_logs') || E'\n';
  raise exception 'RESULT %', r;
end $$;
