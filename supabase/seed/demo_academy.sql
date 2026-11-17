-- Demo academy for screenshots and demos. NOT a migration: run it manually (Supabase SQL editor / MCP execute_sql).
-- Everything it creates is removed again by the cleanup block at the top (club 'Voorbeeldacademy', users @demo.courtload.test).
-- All demo accounts use the password  Demo!2345
--   hugo@ (head, all teams)   bas@ (basketball, U19)   gwen@ (strength coach, U19)   eva@ (basketball + S&C, U22 and U16-1)
--   anna@ (read-only club admin)   petra@ (parent of Noah)   noah.de.vries@ and the other players (athletes)
create or replace function pg_temp.mk_user(_email text, _name text, _birth date) returns uuid language plpgsql as $f$
declare _id uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', _id, 'authenticated', 'authenticated', _email,
          extensions.crypt('Demo!2345', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
          jsonb_build_object('full_name', _name, 'accepted_terms_version', '2026-10-30'), now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at, last_sign_in_at)
  values (gen_random_uuid(), _id, jsonb_build_object('sub', _id::text, 'email', _email, 'email_verified', true), 'email', _id::text, now(), now(), now());
  update public.profiles set birth_date = _birth, full_name = _name where id = _id;
  return _id;
end $f$;

do $seed$
declare
  mon date := date_trunc('week', (now() at time zone 'Europe/Amsterdam')::date)::date;
  today date := (now() at time zone 'Europe/Amsterdam')::date;
  club uuid := gen_random_uuid();
  hugo uuid; bas uuid; gwen uuid; eva uuid; anna uuid; petra uuid; noah uuid;
  t record; a record; s record; b record; w record; ex record; uid uuid; tid uuid; wid uuid; blk uuid; run uuid; h bigint; i int; k int; wk int; d int;
  team_ids jsonb := '{}'::jsonb; ex_ids jsonb := '{}'::jsonb; wo_ids jsonb := '{}'::jsonb; sid uuid; kg numeric; base numeric;
begin
  -- cleanup of an earlier run
  delete from public.teams where club_id in (select id from public.clubs where name = 'Voorbeeldacademy');
  delete from public.clubs where name = 'Voorbeeldacademy';
  delete from auth.users where email like '%@demo.courtload.test';

  hugo := pg_temp.mk_user('hugo@demo.courtload.test', 'Hugo Vermeer', date '1985-03-04');
  bas := pg_temp.mk_user('bas@demo.courtload.test', 'Bas Bakker', date '1988-06-01');
  gwen := pg_temp.mk_user('gwen@demo.courtload.test', 'Gwen Gym', date '1990-09-12');
  eva := pg_temp.mk_user('eva@demo.courtload.test', 'Eva Multi', date '1992-01-20');
  anna := pg_temp.mk_user('anna@demo.courtload.test', 'Anna Beheer', date '1980-11-30');
  petra := pg_temp.mk_user('petra@demo.courtload.test', 'Petra de Vries', date '1978-05-05');

  insert into public.clubs (id, name, created_by) values (club, 'Voorbeeldacademy', hugo);
  for t in select * from (values ('Jongens U19'), ('Jongens U22'), ('Vrouwen U21'), ('U16-1'), ('U16-2')) v(n) loop
    tid := gen_random_uuid();
    insert into public.teams (id, name, club_id, created_by) values (tid, t.n, club, hugo);
    team_ids := team_ids || jsonb_build_object(t.n, tid);
    insert into public.team_members (team_id, user_id, role, staff_kind, consent_given, consent_at) values (tid, hugo, 'staff', 'head', true, now());
  end loop;
  insert into public.team_members (team_id, user_id, role, staff_kind) values ((team_ids->>'Jongens U19')::uuid, bas, 'staff', 'basketball');
  insert into public.team_members (team_id, user_id, role, staff_kind) values ((team_ids->>'Jongens U19')::uuid, gwen, 'staff', 'sc');
  insert into public.team_members (team_id, user_id, role, staff_kind, extra_kinds) values
    ((team_ids->>'Jongens U22')::uuid, eva, 'staff', 'basketball', '{sc}'), ((team_ids->>'U16-1')::uuid, eva, 'staff', 'basketball', '{sc}');
  insert into public.club_admins (club_id, user_id, created_by) values (club, anna, hugo);

  -- athletes: name, team, number, position, age
  for a in select * from (values
    ('Jayden Bakker','Jongens U19',12,'shooting_guard',17,95), ('Noah de Vries','Jongens U19',7,'point_guard',18,100), ('Sem van Dijk','Jongens U19',4,'small_forward',17,90),
    ('Ruben Kok','Jongens U22',23,'power_forward',20,20), ('Daan Smit','Jongens U22',15,'center',21,70), ('Milan Vos','Jongens U22',10,'point_guard',20,25), ('Bram Jacobs','Jongens U22',1,'shooting_guard',21,15),
    ('Mila Jansen','Vrouwen U21',11,'power_forward',20,80), ('Emma de Boer','Vrouwen U21',4,'shooting_guard',19,40), ('Sara Dekker','Vrouwen U21',13,'center',20,35), ('Lieke Peters','Vrouwen U21',9,'small_forward',19,30), ('Zoë Visser','Vrouwen U21',6,'point_guard',20,75),
    ('Lucas Meijer','U16-1',9,'center',15,85), ('Tim Bos','U16-1',5,'point_guard',15,60), ('Jesse Mulder','U16-1',14,'power_forward',14,55),
    ('Finn Willems','U16-2',3,'shooting_guard',15,65), ('Luuk de Graaf','U16-2',8,'small_forward',14,50), ('Thijs Hendriks','U16-2',21,'center',15,45)
  ) v(name, team, num, pos, age, bench) loop
    uid := pg_temp.mk_user(lower(translate(replace(a.name, ' ', '.'), 'ë', 'e')) || '@demo.courtload.test', a.name,
                           (today - (a.age * 365 + 120))::date);
    insert into public.team_members (team_id, user_id, role, jersey_number, position, consent_given, consent_at, consent_by)
      values ((team_ids->>a.team)::uuid, uid, 'athlete', a.num, a.pos, true, now(), case when a.age < 16 then 'parent' else 'self' end);
    insert into public.availability (team_id, user_id) values ((team_ids->>a.team)::uuid, uid) on conflict do nothing;
    if a.name = 'Noah de Vries' then noah := uid; end if;
  end loop;
  insert into public.parent_links (parent_user, child_user, created_by) values (petra, noah, hugo);

  -- exercise library and the two gym workouts
  for ex in select * from (values ('Bench press','weight_reps',true), ('Back squat','weight_reps',true), ('Deadlift','weight_reps',true),
       ('Dumbbell row','weight_reps',false), ('Overhead press','weight_reps',false), ('Pull-up','bodyweight_reps',false), ('Walking lunge','weight_reps',false)) v(n, kind, trk) loop
    uid := gen_random_uuid();
    insert into public.exercises (id, club_id, name, instructions, kind, track_5rm, created_by) values (uid, club, ex.n, 'Demo-oefening: rustig en gecontroleerd uitvoeren.', ex.kind, ex.trk, hugo);
    ex_ids := ex_ids || jsonb_build_object(ex.n, uid);
  end loop;
  for w in select * from (values ('Upper body strength'), ('Lower body strength'), ('Full body strength')) v(n) loop
    wid := gen_random_uuid();
    insert into public.workouts (id, club_id, name, created_by) values (wid, club, w.n, hugo);
    wo_ids := wo_ids || jsonb_build_object(w.n, wid);
    i := 0;
    for b in select * from (values
        ('Upper body strength','Bench press',4,6,70::numeric), ('Upper body strength','Dumbbell row',3,10,24), ('Upper body strength','Overhead press',3,8,35), ('Upper body strength','Pull-up',3,8,null),
        ('Lower body strength','Back squat',4,5,90), ('Lower body strength','Deadlift',3,5,110), ('Lower body strength','Walking lunge',3,10,30),
        ('Full body strength','Back squat',3,6,80), ('Full body strength','Bench press',3,6,65), ('Full body strength','Dumbbell row',3,10,22)) v(wn, en, sets, reps, kg) where wn = w.n loop
      i := i + 1; blk := gen_random_uuid();
      insert into public.workout_blocks (id, workout_id, position, exercise_id) values (blk, wid, i, (ex_ids->>b.en)::uuid);
      for k in 1..b.sets loop
        insert into public.workout_sets (block_id, position, reps, target_rpe, fixed_weight_kg, rest_seconds, set_type) values (blk, k, b.reps, 8, b.kg, 90, 'normal');
      end loop;
    end loop;
  end loop;

  -- strength tests (5RM) for the three lifts
  for a in select m.user_id, m.jersey_number, p.full_name, tx.name tname from public.team_members m join public.profiles p on p.id = m.user_id join public.teams tx on tx.id = m.team_id where tx.club_id = club and m.role = 'athlete' loop
    base := 100 - (abs(hashtext(a.full_name)) % 80);
    insert into public.strength_tests (user_id, exercise_id, tested_at, weight_kg, reps, rpe, five_rm_kg, estimated, created_by) values
      (a.user_id, (ex_ids->>'Bench press')::uuid, today - 20, base, 5, 9, base, false, hugo),
      (a.user_id, (ex_ids->>'Back squat')::uuid, today - 20, round(base * 1.3 / 2.5) * 2.5, 5, 9, round(base * 1.3 / 2.5) * 2.5, false, hugo),
      (a.user_id, (ex_ids->>'Deadlift')::uuid, today - 20, round(base * 1.5 / 2.5) * 2.5, 5, 9, round(base * 1.5 / 2.5) * 2.5, false, hugo);
  end loop;

  -- sessions: this week and the three weeks before
  for wk in -3..0 loop
    for t in select * from (values
      ('Jongens U19', 0, '08:30', 'academy', 75, 6, 'Academy · skills', null),
      ('Jongens U19', 0, '15:30', 'gym', 60, 7, 'Lower body strength', 'Lower body strength'),
      ('Jongens U19', 1, '19:00', 'evening', 90, 6, 'Avondtraining', null),
      ('Jongens U19', 2, '08:30', 'academy', 60, 5, 'Academy · shooting', null),
      ('Jongens U19', 3, '15:30', 'gym', 60, 6, 'Upper body strength', 'Upper body strength'),
      ('Jongens U19', 3, '19:00', 'evening', 90, 6, 'Avondtraining', null),
      ('Jongens U19', 4, '08:30', 'academy', 75, 5, 'Academy · team play', null),
      ('Jongens U19', 5, '14:00', 'match', 90, 7, 'Wedstrijd · thuis', null),
      ('Jongens U22', 0, '09:00', 'academy', 90, 6, 'Academy · skills', null),
      ('Jongens U22', 1, '16:00', 'gym', 60, 7, 'Full body strength', 'Full body strength'),
      ('Jongens U22', 2, '19:30', 'evening', 90, 7, 'Avondtraining', null),
      ('Jongens U22', 3, '16:00', 'gym', 60, 6, 'Upper body strength', 'Upper body strength'),
      ('Vrouwen U21', 0, '09:00', 'academy', 90, 6, 'Academy · skills', null),
      ('Vrouwen U21', 1, '16:00', 'gym', 60, 6, 'Full body strength', 'Full body strength'),
      ('Vrouwen U21', 3, '19:00', 'evening', 90, 6, 'Avondtraining', null),
      ('U16-1', 0, '17:00', 'academy', 75, 6, 'Teamtraining', null),
      ('U16-1', 2, '17:00', 'academy', 75, 6, 'Teamtraining', null),
      ('U16-1', 3, '16:00', 'gym', 60, 5, 'Full body strength', 'Full body strength'),
      ('U16-2', 1, '17:00', 'academy', 75, 5, 'Teamtraining', null),
      ('U16-2', 3, '17:00', 'academy', 75, 5, 'Teamtraining', null),
      ('U16-2', 4, '16:00', 'gym', 60, 5, 'Full body strength', 'Full body strength')
    ) v(team, dow, tm, typ, dur, rpe, title, wo) loop
      insert into public.sessions (team_id, type, title, starts_at, planned_duration_min, planned_rpe, workout_id, created_by)
      values ((team_ids->>t.team)::uuid, t.typ::session_type, t.title,
              ((mon + wk * 7 + t.dow) + t.tm::time) at time zone 'Europe/Amsterdam', t.dur, t.rpe,
              case when t.wo is null then null else (wo_ids->>t.wo)::uuid end, hugo);
    end loop;
  end loop;

  -- logs for every session that already happened (some athletes absent)
  for s in select * from public.sessions where team_id in (select id from public.teams where club_id = club) and starts_at < now() loop
    for a in select user_id from public.team_members where team_id = s.team_id and role = 'athlete' loop
      h := abs(hashtext(s.id::text || a.user_id::text));
      if h % 10 = 0 then
        insert into public.session_logs (session_id, user_id, attended) values (s.id, a.user_id, false);
      else
        insert into public.session_logs (session_id, user_id, attended, duration_min, rpe)
        values (s.id, a.user_id, true, greatest(20, s.planned_duration_min + (h % 11) - 5), least(10, greatest(3, s.planned_rpe + ((h / 7) % 3) - 1)));
        if s.workout_id is not null and h % 5 <> 0 then
          run := gen_random_uuid();
          insert into public.workout_runs (id, session_id, user_id, started_at, finished_at, active_seconds)
            values (run, s.id, a.user_id, s.starts_at, s.starts_at + interval '55 minutes', 3300);
          for b in select wb.exercise_id, wb.position, ws.position spos, ws.reps, ws.fixed_weight_kg from public.workout_blocks wb join public.workout_sets ws on ws.block_id = wb.id where wb.workout_id = s.workout_id order by wb.position, ws.position loop
            insert into public.run_sets (run_id, exercise_id, set_index, weight_kg, reps, rpe, set_type)
            values (run, b.exercise_id, b.spos, case when b.fixed_weight_kg is null then 0 else round(b.fixed_weight_kg * (0.7 + (h % 5) * 0.08) / 2.5) * 2.5 end, b.reps, 7 + (h % 3) * 0.5, 'normal');
          end loop;
        end if;
      end if;
    end loop;
  end loop;

  -- today's check-ins and availability
  for a in select m.user_id, m.team_id, p.full_name from public.team_members m join public.profiles p on p.id = m.user_id where m.role = 'athlete' and m.team_id in (select id from public.teams where club_id = club) loop
    insert into public.wellness_checks (user_id, day, sleep, soreness, fatigue, stress, mood, pain, pain_location)
    values (a.user_id, today, case when a.full_name = 'Jesse Mulder' then 2 else 4 end, 4, 4, 4, 4,
            a.full_name in ('Jayden Bakker', 'Lieke Peters'), case a.full_name when 'Jayden Bakker' then 'linkerknie' when 'Lieke Peters' then 'enkel' end);
  end loop;
  update public.availability set status = 'unavailable', note = 'Ziek · verkouden' where user_id = (select id from public.profiles where full_name = 'Zoë Visser' and id in (select id from auth.users where email like '%@demo.courtload.test'));
  update public.availability set status = 'unavailable', note = 'Ziek · koorts' where user_id = (select id from public.profiles where full_name = 'Bram Jacobs' and id in (select id from auth.users where email like '%@demo.courtload.test'));
end
$seed$;
