-- set_player_info test. ALWAYS ends in an exception "RESULT ..." (nothing persists).
-- Expected (2026-11-17):
--   H(head) sets A1 7/point_guard: ok | clear (null,null): ok | sets A1 jersey 100: DENIED:invalid_jersey | position 'wing': DENIED:invalid_position
--   SC(sc) sets A2 jersey 7 after A1 got 7: DENIED:jersey_taken | SC sets A2 jersey 8: ok
--   B(bball) sets A1 jersey 9: ok | M(medical): DENIED:not allowed | A1 (athlete, self): DENIED:not allowed
--   H on a staff user (B): DENIED:not allowed | O (outsider): DENIED:not allowed | unauthenticated: DENIED:not authenticated
create or replace function pg_temp.t(q text) returns text language plpgsql as $f$ begin execute q; return 'ok'; exception when others then return 'DENIED:'||left(sqlerrm,40); end $f$;
create or replace function pg_temp.q(q text) returns text language plpgsql as $f$ declare v text; begin execute q into v; return coalesce(v,'-'); exception when others then return 'ERR:'||left(sqlerrm,40); end $f$;
create or replace function pg_temp.as_(u uuid) returns void language plpgsql as $f$ begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true); execute 'set local role authenticated'; end $f$;
do $$
declare H uuid:=gen_random_uuid(); SC uuid:=gen_random_uuid(); B uuid:=gen_random_uuid(); M uuid:=gen_random_uuid(); O uuid:=gen_random_uuid();
  a1 uuid:=gen_random_uuid(); a2 uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); t uuid:=gen_random_uuid(); r text:=E'\n';
  f text:='select public.set_player_info(%L,%L,%s::smallint,%s)';
begin
  insert into auth.users(id,email) select x,x::text||'@t.local' from unnest(array[H,SC,B,M,O,a1,a2]) x;
  insert into public.clubs(id,name) values (c,'TestClub');
  insert into public.teams(id,name,club_id,created_by) values (t,'TestTeam',c,H);
  insert into public.team_members(team_id,user_id,role,staff_kind,consent_given) values (t,H,'staff','head',true),(t,SC,'staff','sc',true),(t,B,'staff','basketball',true),(t,M,'staff','medical',true);
  insert into public.team_members(team_id,user_id,role,consent_given) values (t,a1,'athlete',true),(t,a2,'athlete',true);
  perform pg_temp.as_(H);
  r := r || 'H set 7/pg: ' || pg_temp.t(format(f,t,a1,'7',quote_literal('point_guard')))
    || ' | clear: ' || pg_temp.t(format(f,t,a1,'null','null'))
    || ' | jersey 100: ' || pg_temp.t(format(f,t,a1,'100','null'))
    || ' | position wing: ' || pg_temp.t(format(f,t,a1,'1',quote_literal('wing')))
    || ' | on staff user: ' || pg_temp.t(format(f,t,B,'5','null')) || E'\n';
  perform pg_temp.t(format(f,t,a1,'7','null'));
  execute 'reset role'; perform pg_temp.as_(SC);
  r := r || 'SC duplicate 7: ' || pg_temp.t(format(f,t,a2,'7','null')) || ' | SC 8: ' || pg_temp.t(format(f,t,a2,'8','null')) || E'\n';
  execute 'reset role'; perform pg_temp.as_(B);
  r := r || 'B 9: ' || pg_temp.t(format(f,t,a1,'9','null')) || E'\n';
  execute 'reset role'; perform pg_temp.as_(M);
  r := r || 'M: ' || pg_temp.t(format(f,t,a1,'10','null')) || E'\n';
  execute 'reset role'; perform pg_temp.as_(a1);
  r := r || 'A1 self: ' || pg_temp.t(format(f,t,a1,'11','null')) || E'\n';
  execute 'reset role'; perform pg_temp.as_(O);
  r := r || 'O: ' || pg_temp.t(format(f,t,a1,'12','null')) || E'\n';
  execute 'reset role'; perform set_config('request.jwt.claims','',true);
  r := r || 'unauth: ' || pg_temp.t(format(f,t,a1,'13','null')) || E'\n';
  raise exception 'RESULT %', r;
end $$;
