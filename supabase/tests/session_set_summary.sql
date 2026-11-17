-- session_set_summary test. ALWAYS ends in an exception "RESULT ..." (nothing persists).
-- Fixture: gym session; A1 run (finished): warm-up 20x10, normal 60x5, normal 70x3 ; A2 run (unfinished): normal 50x8. P = parent of A1.
-- Expected (2026-11-17), row = athlete:sets/top_kg x top_reps/finished:
--   H (head), AD (club admin): both rows, A1:2/70x3/true and A2:1/50x8/false (row order is not guaranteed)  (warm-up not counted)
--   A1 (athlete): A1 only      A2 (athlete): A2 only      P (parent): A1 only      O (outsider): 0 rows (-)
--   unauthenticated: ERR:not allowed
create or replace function pg_temp.t(q text) returns text language plpgsql as $f$ begin execute q; return 'ok'; exception when others then return 'DENIED:'||left(sqlerrm,40); end $f$;
create or replace function pg_temp.q(q text) returns text language plpgsql as $f$ declare v text; begin execute q into v; return coalesce(v,'-'); exception when others then return 'ERR:'||left(sqlerrm,40); end $f$;
create or replace function pg_temp.as_(u uuid) returns void language plpgsql as $f$ begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true); execute 'set local role authenticated'; end $f$;
do $$
declare H uuid:=gen_random_uuid(); AD uuid:=gen_random_uuid(); O uuid:=gen_random_uuid(); P uuid:=gen_random_uuid(); a1 uuid:=gen_random_uuid(); a2 uuid:=gen_random_uuid();
  c uuid:=gen_random_uuid(); t uuid:=gen_random_uuid(); e uuid:=gen_random_uuid(); s uuid; r1 uuid:=gen_random_uuid(); r2 uuid:=gen_random_uuid(); w uuid:=gen_random_uuid();
  r text:=E'\n'; i int; ids uuid[]; nm text[]:=array['H','AD','A1','A2','P','O'];
  q text:='select string_agg((case user_id when %L then ''A1'' else ''A2'' end)||'':''||sets||''/''||top_weight_kg::int||''x''||top_reps||''/''||finished,'' ; '' order by jersey_number nulls last, full_name, user_id) from public.session_set_summary(%L)';
begin
  insert into auth.users(id,email) select x,x::text||'@t.local' from unnest(array[H,AD,O,P,a1,a2]) x;
  insert into public.clubs(id,name) values (c,'TestClub');
  insert into public.teams(id,name,club_id,created_by) values (t,'TestTeam',c,H);
  insert into public.team_members(team_id,user_id,role,staff_kind,consent_given) values (t,H,'staff','head',true);
  insert into public.team_members(team_id,user_id,role,consent_given) values (t,a1,'athlete',true),(t,a2,'athlete',true);
  insert into public.club_admins(club_id,user_id) values (c,AD);
  insert into public.parent_links(parent_user,child_user) values (P,a1);
  insert into public.exercises(id,club_id,name,instructions) values (e,c,'TestPress','x');
  insert into public.workouts(id,club_id,name) values (w,c,'TestWorkout');
  insert into public.workout_blocks(workout_id,position,exercise_id) values (w,0,e);
  insert into public.sessions(team_id,type,starts_at,planned_duration_min,workout_id) values (t,'gym',now()+interval '1 day',60,w) returning id into s;
  insert into public.workout_runs(id,session_id,user_id,finished_at) values (r1,s,a1,now()),(r2,s,a2,null);
  insert into public.run_sets(run_id,exercise_id,set_index,weight_kg,reps,set_type) values
    (r1,e,1,20,10,'warmup'),(r1,e,2,60,5,'normal'),(r1,e,3,70,3,'normal'),(r2,e,1,50,8,'normal');
  ids:=array[H,AD,a1,a2,P,O];
  for i in 1..6 loop
    perform pg_temp.as_(ids[i]);
    r := r || rpad(nm[i],3) || ': ' || pg_temp.q(format(q,a1,s)) || E'\n';
    execute 'reset role';
  end loop;
  perform set_config('request.jwt.claims','',true);
  r := r || 'unauth: ' || pg_temp.q(format(q,a1,s)) || E'\n';
  raise exception 'RESULT %', r;
end $$;
