-- leaderboard_access / club_record_exercises / club_records test. ALWAYS ends in an exception "RESULT ..." (nothing persists).
-- Fixture: 4 athletes with a 5RM on one exercise: AD16 (16y, 100kg), AD20 (20y, 120kg), AD15 (15y, 150kg), ANB (no birth date, 200kg).
-- Expected (2026-11-17): only AD20 and AD16 are ranked (rank 1 = AD20 120, rank 2 = AD16 100); AD15 and ANB never appear.
--   H (head)      access:true  exercises:1 athletes=2 records: AD20,AD16
--   AD (admin)    access:true  same
--   AD20, AD16    access:true  same
--   AD15, ANB     access:false exercises: ERR:not allowed records: ERR:not allowed
--   O (outsider)  access:false ERR:not allowed
create or replace function pg_temp.t(q text) returns text language plpgsql as $f$ begin execute q; return 'ok'; exception when others then return 'DENIED:'||left(sqlerrm,40); end $f$;
create or replace function pg_temp.q(q text) returns text language plpgsql as $f$ declare v text; begin execute q into v; return coalesce(v,'-'); exception when others then return 'ERR:'||left(sqlerrm,40); end $f$;
create or replace function pg_temp.as_(u uuid) returns void language plpgsql as $f$ begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true); execute 'set local role authenticated'; end $f$;
do $$
declare H uuid:=gen_random_uuid(); AD uuid:=gen_random_uuid(); O uuid:=gen_random_uuid();
  a16 uuid:=gen_random_uuid(); a20 uuid:=gen_random_uuid(); a15 uuid:=gen_random_uuid(); anb uuid:=gen_random_uuid();
  c uuid:=gen_random_uuid(); t uuid:=gen_random_uuid(); e uuid:=gen_random_uuid(); r text:=E'\n'; who uuid; nm text;
  ids uuid[]; names text[]:=array['H','AD','O','A16','A20','A15','ANB'];
  i int;
begin
  insert into auth.users(id,email) select x,x::text||'@t.local' from unnest(array[H,AD,O,a16,a20,a15,anb]) x;
  update public.profiles set birth_date=current_date - interval '16 years 1 day' where id=a16;
  update public.profiles set birth_date=current_date - interval '20 years' where id=a20;
  update public.profiles set birth_date=current_date - interval '15 years 11 months' where id=a15;
  insert into public.clubs(id,name) values (c,'TestClub');
  insert into public.teams(id,name,club_id,created_by) values (t,'TestTeam',c,H);
  insert into public.team_members(team_id,user_id,role,staff_kind,consent_given) values (t,H,'staff','head',true);
  insert into public.team_members(team_id,user_id,role,consent_given) select t,x,'athlete',true from unnest(array[a16,a20,a15,anb]) x;
  insert into public.club_admins(club_id,user_id) values (c,AD);
  insert into public.exercises(id,club_id,name,instructions,track_5rm) values (e,c,'TestSquat','x',true);
  insert into public.strength_tests(user_id,exercise_id,weight_kg,reps,rpe,five_rm_kg,estimated) values (a16,e,100,5,8,100,false),(a20,e,120,5,8,120,false),(a15,e,150,5,8,150,false),(anb,e,200,5,8,200,false);
  ids:=array[H,AD,O,a16,a20,a15,anb];
  for i in 1..7 loop
    perform pg_temp.as_(ids[i]);
    r := r || rpad(names[i],4) || ' access:' || pg_temp.q(format('select public.leaderboard_access(%L)',c))
      || ' exercises:' || pg_temp.q(format('select string_agg(name||''=''||athletes,'','') from public.club_record_exercises(%L)',c))
      || ' records:' || pg_temp.q(format('select string_agg(rank||'':''||best_kg,'','' order by rank) from public.club_records(%L,%L)',c,e)) || E'\n';
    execute 'reset role';
  end loop;
  raise exception 'RESULT %', r;
end $$;
