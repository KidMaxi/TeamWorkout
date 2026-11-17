-- academy_fit_status test. ALWAYS ends in an exception "RESULT ..." (nothing persists).
-- Expected (2026-11-17):
--   H  (head)    : A1=not_fit/availability A2=fit/- A3=less_fit/pain A4=unknown/- A5=unknown/- A6=less_fit/availability A7=less_fit/sleep
--   AD (admin)   : same statuses, reason ALWAYS '-'  (A1=not_fit/- A2=fit/- A3=less_fit/- A4=unknown/- A5=unknown/- A6=less_fit/- A7=less_fit/-)
--   O  (outsider): 0 rows ; A (athlete): 0 rows ; unauthenticated: ERR not authenticated
--   A4 has NO consent: its bad check-in must not count (unknown). A7 has consent and a low sleep score (lowest=sleep).
create or replace function pg_temp.t(q text) returns text language plpgsql as $f$ begin execute q; return 'ok'; exception when others then return 'DENIED:'||left(sqlerrm,40); end $f$;
create or replace function pg_temp.q(q text) returns text language plpgsql as $f$ declare v text; begin execute q into v; return coalesce(v,'-'); exception when others then return 'ERR:'||left(sqlerrm,40); end $f$;
create or replace function pg_temp.as_(u uuid) returns void language plpgsql as $f$ begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true); execute 'set local role authenticated'; end $f$;
do $$
declare H uuid:=gen_random_uuid(); AD uuid:=gen_random_uuid(); O uuid:=gen_random_uuid();
  a uuid[]:=array(select gen_random_uuid() from generate_series(1,7)); c uuid:=gen_random_uuid(); t uuid:=gen_random_uuid(); r text:=E'\n'; i int; who uuid;
  qq text;
begin
  insert into auth.users(id,email) select x,x::text||'@t.local' from unnest(array[H,AD,O]||a) x;
  insert into public.clubs(id,name) values (c,'TestClub');
  insert into public.teams(id,name,club_id,created_by) values (t,'TestTeam',c,H);
  insert into public.team_members(team_id,user_id,role,staff_kind,consent_given) values (t,H,'staff','head',true);
  for i in 1..7 loop
    insert into public.team_members(team_id,user_id,role,consent_given,consent_at,consent_by) values (t,a[i],'athlete', i<>4, case when i<>4 then now() end, case when i<>4 then 'self' end);
  end loop;
  insert into public.club_admins(club_id,user_id) values (c,AD);
  insert into public.availability(team_id,user_id,status,note) values (t,a[1],'unavailable','enkel'),(t,a[6],'limited','kuit');
  insert into public.wellness_checks(user_id,day,sleep,soreness,fatigue,stress,mood) values (a[2],current_date,4,4,4,4,4),(a[4],current_date,1,1,1,1,1),(a[7],current_date,2,4,4,4,4);
  insert into public.wellness_checks(user_id,day,sleep,soreness,fatigue,stress,mood,pain,pain_location) values (a[3],current_date,4,4,4,4,4,true,'knie');
  qq := 'select string_agg(''A''||(array_position(%L::uuid[],user_id))||''=''||status||''/''||coalesce(reason_code,''-''),'' '' order by array_position(%L::uuid[],user_id)) from public.academy_fit_status(%L,current_date)';
  foreach who in array array[H,AD,O,a[1]] loop
    perform pg_temp.as_(who);
    r := r || rpad(case who when H then 'H' when AD then 'AD' when O then 'O' else 'A' end,3) || ': ' || pg_temp.q(format(qq,a,a,c)) || E'\n';
    execute 'reset role';
  end loop;
  execute 'reset role'; perform set_config('request.jwt.claims','',true);
  r := r || 'unauth: ' || pg_temp.q(format('select count(*) from public.academy_fit_status(%L)',c)) || E'\n';
  raise exception 'RESULT %', r;
end $$;
