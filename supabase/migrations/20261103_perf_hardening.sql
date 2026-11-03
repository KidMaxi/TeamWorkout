-- Applied via the Supabase MCP as "perf_hardening_rls_initplan_indexes_search_path".
-- 1. RLS: evaluate auth.uid() once per statement instead of once per row (same semantics).
do $$
declare r record; q text; w text; stmt text; n int := 0;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check from pg_policies
     where schemaname = 'public'
       and (coalesce(qual,'') ~ '(?<!SELECT )auth\.uid\(\)' or coalesce(with_check,'') ~ '(?<!SELECT )auth\.uid\(\)')
  loop
    q := case when r.qual is null then null else regexp_replace(r.qual, '(?<!SELECT )auth\.uid\(\)', '(select auth.uid())', 'g') end;
    w := case when r.with_check is null then null else regexp_replace(r.with_check, '(?<!SELECT )auth\.uid\(\)', '(select auth.uid())', 'g') end;
    stmt := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename)
         || case when q is not null then ' using (' || q || ')' else '' end
         || case when w is not null then ' with check (' || w || ')' else '' end;
    execute stmt;
    n := n + 1;
  end loop;
  raise notice 'policies rewritten: %', n;
end $$;

-- 2. Mutable search_path on two helper functions.
alter function public.age_years(date) set search_path = public;
alter function public.touch_session() set search_path = public;

-- 3. Indexes on foreign keys that are actually joined or filtered on.
create index if not exists run_sets_exercise_id_idx on public.run_sets (exercise_id);
create index if not exists run_sets_set_id_idx on public.run_sets (set_id);
create index if not exists sessions_workout_id_idx on public.sessions (workout_id);
create index if not exists strength_tests_exercise_id_idx on public.strength_tests (exercise_id);
create index if not exists week_rules_user_id_idx on public.week_rules (user_id);
create index if not exists workload_notes_session_id_idx on public.workload_notes (session_id);
