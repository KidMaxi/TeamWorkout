-- B-03a: advisor "multiple_permissive_policies" (19 tables, role authenticated, action SELECT).
-- Behaviour-neutral rewrite: permissive policies are OR-ed by Postgres, so
--   * all permissive SELECT policies (and the SELECT part of FOR ALL policies) of a table become ONE SELECT policy
--     whose USING is the OR of the old ones, and
--   * every FOR ALL policy is replaced by separate INSERT / UPDATE / DELETE policies with the same expressions.
-- Expressions are copied from pg_policies (already deparsed), so nothing is re-typed by hand.
-- Proof: supabase/tests/*.sql give the same results before and after (see the B-03 READY_FOR_REVIEW message).
do $mig$
declare
  tbl text; p record; sel_parts text[]; all_pols record;
  tables text[] := array['athlete_limits','availability','clubs','exercises','profiles','run_sets','session_exclusions','session_logs',
    'sessions','strength_tests','team_members','team_workload_settings','teams','week_rules','workload_notes','workout_blocks',
    'workout_runs','workout_sets','workouts'];
  sel_name text;
begin
  foreach tbl in array tables loop
    sel_parts := '{}';
    for p in select * from pg_policies
              where schemaname = 'public' and tablename = tbl and permissive = 'PERMISSIVE'
                and cmd in ('SELECT','ALL') and roles = '{authenticated}'
              order by policyname loop
      sel_parts := sel_parts || ('(' || p.qual || ')');
    end loop;
    if cardinality(sel_parts) < 2 then continue; end if;
    -- the surviving SELECT policy keeps the name of the table's original "<x>_select" policy when there is one
    select policyname into sel_name from pg_policies
     where schemaname = 'public' and tablename = tbl and cmd = 'SELECT' and policyname !~ '^(admin|parent)_read_'
     order by policyname limit 1;
    sel_name := coalesce(sel_name, tbl || '_select');
    -- FOR ALL policies -> split write policies first (needs the expressions before they are dropped)
    for all_pols in select * from pg_policies
                     where schemaname = 'public' and tablename = tbl and cmd = 'ALL' and permissive = 'PERMISSIVE' and roles = '{authenticated}' loop
      execute format('create policy %I on public.%I for insert to authenticated with check (%s)', all_pols.policyname || '_ins', tbl, all_pols.with_check);
      execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', all_pols.policyname || '_upd', tbl, all_pols.qual, all_pols.with_check);
      execute format('create policy %I on public.%I for delete to authenticated using (%s)', all_pols.policyname || '_del', tbl, all_pols.qual);
    end loop;
    -- drop all old SELECT/ALL policies, then create the single merged SELECT policy
    for p in select policyname from pg_policies
              where schemaname = 'public' and tablename = tbl and permissive = 'PERMISSIVE'
                and cmd in ('SELECT','ALL') and roles = '{authenticated}' loop
      execute format('drop policy %I on public.%I', p.policyname, tbl);
    end loop;
    execute format('create policy %I on public.%I for select to authenticated using (%s)', sel_name, tbl, array_to_string(sel_parts, ' or '));
  end loop;
end
$mig$;
