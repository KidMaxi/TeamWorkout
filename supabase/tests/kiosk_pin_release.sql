-- kiosk_locked_users / kiosk_release_pin test. ALWAYS ends in an exception "RESULT ..." (nothing persists).
-- Fixture: A1 has a locked PIN (5 failed attempts, locked 1h). Capability: can_plan_gym = head or sc.
-- Expected (2026-11-17):
--   locked list size: H=1 SC=1 B(bball)=ERR:not allowed M=ERR:not allowed A1=ERR:not allowed O=ERR:not allowed unauth=ERR:not authenticated
--   release as B: DENIED:not allowed | as M: DENIED:not allowed | as H on staff user: DENIED:not allowed | as H on A1: ok
--   after release: H sees 0 locked, failed_attempts=0 and locked_until null; athlete_pins hash is not readable by authenticated (0 rows for H)
create or replace function pg_temp.t(q text) returns text language plpgsql as $f$ begin execute q; return 'ok'; exception when others then return 'DENIED:'||left(sqlerrm,40); end $f$;
create or replace function pg_temp.q(q text) returns text language plpgsql as $f$ declare v text; begin execute q into v; return coalesce(v,'-'); exception when others then return 'ERR:'||left(sqlerrm,40); end $f$;
create or replace function pg_temp.as_(u uuid) returns void language plpgsql as $f$ begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true); execute 'set local role authenticated'; end $f$;
do $$
declare H uuid:=gen_random_uuid(); SC uuid:=gen_random_uuid(); B uuid:=gen_random_uuid(); M uuid:=gen_random_uuid(); O uuid:=gen_random_uuid();
  a1 uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); t uuid:=gen_random_uuid(); r text:=E'\n'; ids uuid[]; nm text[]:=array['H','SC','B','M','A1','O']; i int;
begin
  insert into auth.users(id,email) select x,x::text||'@t.local' from unnest(array[H,SC,B,M,O,a1]) x;
  insert into public.clubs(id,name) values (c,'TestClub');
  insert into public.teams(id,name,club_id,created_by) values (t,'TestTeam',c,H);
  insert into public.team_members(team_id,user_id,role,staff_kind,consent_given) values (t,H,'staff','head',true),(t,SC,'staff','sc',true),(t,B,'staff','basketball',true),(t,M,'staff','medical',true);
  insert into public.team_members(team_id,user_id,role,consent_given) values (t,a1,'athlete',true);
  insert into public.athlete_pins(user_id,pin_hash,failed_attempts,locked_until) values (a1,'not-a-real-hash',5,now()+interval '1 hour');
  ids:=array[H,SC,B,M,a1,O];
  r := r || 'locked list size:';
  for i in 1..6 loop
    perform pg_temp.as_(ids[i]);
    r := r || ' ' || nm[i] || '=' || pg_temp.q(format('select count(*) from public.kiosk_locked_users(%L)',t));
    execute 'reset role';
  end loop;
  execute 'reset role'; perform set_config('request.jwt.claims','',true);
  r := r || ' unauth=' || pg_temp.q(format('select count(*) from public.kiosk_locked_users(%L)',t)) || E'\n';
  perform pg_temp.as_(B); r := r || 'release as B: ' || pg_temp.t(format('select public.kiosk_release_pin(%L,%L)',t,a1));
  execute 'reset role'; perform pg_temp.as_(M); r := r || ' | as M: ' || pg_temp.t(format('select public.kiosk_release_pin(%L,%L)',t,a1));
  execute 'reset role'; perform pg_temp.as_(H);
  r := r || ' | as H on staff user: ' || pg_temp.t(format('select public.kiosk_release_pin(%L,%L)',t,B))
        || ' | as H on A1: ' || pg_temp.t(format('select public.kiosk_release_pin(%L,%L)',t,a1)) || E'\n'
        || 'after: H locked=' || pg_temp.q(format('select count(*) from public.kiosk_locked_users(%L)',t))
        || ' pin rows visible to H=' || pg_temp.q('select count(*) from public.athlete_pins');
  execute 'reset role';
  r := r || ' failed_attempts=' || (select failed_attempts from public.athlete_pins where user_id=a1) || ' locked_until=' || coalesce((select locked_until::text from public.athlete_pins where user_id=a1),'null') || E'\n';
  raise exception 'RESULT %', r;
end $$;
