-- Set types, coach notes per exercise, remembered tips.
-- Additive: adds columns and replaces save_workout (same signature). Safe to run once.

alter table public.workout_sets
  add column if not exists set_type text not null default 'normal' check (set_type in ('warmup', 'normal', 'failure', 'drop'));
alter table public.run_sets
  add column if not exists set_type text not null default 'normal' check (set_type in ('warmup', 'normal', 'failure', 'drop'));

alter table public.workout_blocks
  add column if not exists notes text check (notes is null or char_length(notes) <= 500);

alter table public.profiles
  add column if not exists dismissed_hints text[] not null default '{}';

-- _blocks = [{exercise_id, notes, sets:[{reps, target_rpe, fixed_weight_kg, rest_seconds, set_type}]}]
create or replace function public.save_workout(_id uuid, _club uuid, _name text, _description text, _blocks jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare _w uuid; b jsonb; s jsonb; _bid uuid; bi int := 0; si int; _type text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_club_staff(_club) then raise exception 'not allowed'; end if;
  if jsonb_typeof(_blocks) <> 'array' or jsonb_array_length(_blocks) = 0 then raise exception 'blocks_required'; end if;
  if jsonb_array_length(_blocks) > 20 then raise exception 'too_many_blocks'; end if;
  if _id is null then
    insert into public.workouts (club_id, name, description, created_by)
      values (_club, trim(_name), nullif(trim(coalesce(_description, '')), ''), auth.uid()) returning id into _w;
  else
    update public.workouts set name = trim(_name), description = nullif(trim(coalesce(_description, '')), '')
      where id = _id and club_id = _club and archived_at is null returning id into _w;
    if _w is null then raise exception 'not allowed'; end if;
    delete from public.workout_blocks where workout_id = _w;
  end if;
  for b in select * from jsonb_array_elements(_blocks) loop
    bi := bi + 1;
    if not exists (select 1 from public.exercises where id = (b->>'exercise_id')::uuid and club_id = _club and archived_at is null) then
      raise exception 'invalid_exercise';
    end if;
    if jsonb_typeof(b->'sets') <> 'array' or jsonb_array_length(b->'sets') = 0 or jsonb_array_length(b->'sets') > 30 then
      raise exception 'sets_required';
    end if;
    insert into public.workout_blocks (workout_id, position, exercise_id, notes)
      values (_w, bi, (b->>'exercise_id')::uuid, nullif(left(trim(coalesce(b->>'notes', '')), 500), '')) returning id into _bid;
    si := 0;
    for s in select * from jsonb_array_elements(b->'sets') loop
      si := si + 1;
      _type := coalesce(nullif(s->>'set_type', ''), 'normal');
      if _type not in ('warmup', 'normal', 'failure', 'drop') then raise exception 'invalid_set_type'; end if;
      insert into public.workout_sets (block_id, position, reps, target_rpe, fixed_weight_kg, rest_seconds, set_type)
        values (_bid, si, nullif(s->>'reps','')::smallint, nullif(s->>'target_rpe','')::numeric,
                nullif(s->>'fixed_weight_kg','')::numeric, coalesce(nullif(s->>'rest_seconds','')::smallint, 90), _type);
    end loop;
  end loop;
  return _w;
end;
$$;
