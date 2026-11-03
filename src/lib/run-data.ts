import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExerciseKind } from "@/lib/exercises";
import type { PrevSet, RunBlock, RunExercise, SavedSet, SetType } from "@/components/WorkoutRunner";

const PREV_RUNS = 30;
const asSetType = (v: unknown): SetType => (v === "warmup" || v === "failure" || v === "drop" ? v : "normal");
const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export type RunData = {
  workout: { name?: string | null; title?: string | null } | null;
  blocks: RunBlock[];
  saved: SavedSet[];
  prev: PrevSet[];
  run: { id: string; started_at: string | null; finished_at: string | null; active_seconds: number | null } | null;
  log: { duration_min: number | null; rpe: number | null } | null;
};

type SetRow = {
  id: string; position: number; reps: number | null; target_rpe: number | string | null;
  fixed_weight_kg: number | string | null; rest_seconds: number | null; set_type: string | null;
};
type ExRow = { id: string; name: string; kind: string; per_side: boolean | null; instructions: string | null };
type BlockRow = {
  id: string; position: number; exercise_id: string; notes: string | null;
  workout_sets: SetRow[] | null; exercises: ExRow | ExRow[] | null;
};

/**
 * Everything the workout runner (athlete page and iPad kiosk) needs for one athlete in one session.
 * Round trips: stage 1 = workout, blocks (with their sets and exercises embedded), the run, earlier runs, 5RM tests and
 * the log, all at once; stage 2 = saved sets and previous values. RLS-scoped client.
 */
export async function loadRunData(
  supabase: SupabaseClient,
  p: { sessionId: string; uid: string; workoutId: string },
): Promise<RunData> {
  const { sessionId, uid, workoutId } = p;
  const [workoutRes, blocksRes, runRes, prevRunsRes, testsRes, logRes] = await Promise.all([
    supabase.from("workouts").select("name").eq("id", workoutId).maybeSingle(),
    supabase
      .from("workout_blocks")
      .select("id, position, exercise_id, notes, workout_sets(id, position, reps, target_rpe, fixed_weight_kg, rest_seconds, set_type), exercises(id, name, kind, per_side, instructions)")
      .eq("workout_id", workoutId).order("position"),
    supabase.from("workout_runs").select("id, started_at, finished_at, active_seconds")
      .eq("session_id", sessionId).eq("user_id", uid).maybeSingle(),
    supabase.from("workout_runs").select("id, finished_at")
      .eq("user_id", uid).neq("session_id", sessionId).not("finished_at", "is", null)
      .order("finished_at", { ascending: false }).limit(PREV_RUNS),
    // The athlete's own tests, narrowed to this workout's exercises below (saves waiting for the block list).
    supabase.from("strength_tests").select("exercise_id, five_rm_kg")
      .eq("user_id", uid)
      .order("tested_at", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("session_logs").select("duration_min, rpe").eq("session_id", sessionId).eq("user_id", uid).maybeSingle(),
  ]);

  const workout = (workoutRes.data as RunData["workout"]) ?? null;
  const run = (runRes.data as RunData["run"]) ?? null;
  const blocksRaw = (blocksRes.data ?? []) as unknown as BlockRow[];
  const exerciseIds = [...new Set(blocksRaw.map((b) => b.exercise_id))];
  const prevRunIds = (prevRunsRes.data ?? []).map((r) => r.id as string);

  const [savedRes, prevSetsRes] = await Promise.all([
    run
      ? supabase.from("run_sets").select("exercise_id, set_index, side, set_id, weight_kg, reps, rpe, set_type").eq("run_id", run.id)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    prevRunIds.length && exerciseIds.length
      ? supabase.from("run_sets").select("run_id, exercise_id, set_index, side, weight_kg, reps, rpe, set_type")
          .in("run_id", prevRunIds).in("exercise_id", exerciseIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  // Current 5RM = first (latest) test per exercise.
  const wanted = new Set(exerciseIds);
  const fiveRm = new Map<string, number>();
  for (const r of testsRes.data ?? []) {
    const ex = r.exercise_id as string;
    if (wanted.has(ex) && !fiveRm.has(ex)) fiveRm.set(ex, Number(r.five_rm_kg));
  }

  const blocks: RunBlock[] = [];
  const planned = new Map<string, number>(); // exercise -> planned sets in earlier blocks (set_index offset)
  for (const b of [...blocksRaw].sort((x, y) => x.position - y.position)) {
    const e = Array.isArray(b.exercises) ? b.exercises[0] : b.exercises;
    if (!e) continue;
    const exercise: RunExercise = {
      id: e.id,
      name: e.name,
      kind: e.kind as ExerciseKind,
      perSide: !!e.per_side,
      instructions: (e.instructions ?? "").trim(),
      fiveRmKg: fiveRm.get(e.id) ?? null,
    };
    const sets = [...(b.workout_sets ?? [])]
      .sort((x, y) => x.position - y.position)
      .map((s) => ({
        id: s.id,
        setType: asSetType(s.set_type),
        reps: s.reps,
        targetRpe: num(s.target_rpe),
        fixedWeightKg: num(s.fixed_weight_kg),
        restSeconds: s.rest_seconds,
      }));
    const offset = planned.get(exercise.id) ?? 0;
    planned.set(exercise.id, offset + sets.length);
    const notes = (b.notes ?? "").trim();
    blocks.push({ id: b.id, exercise, sets, indexOffset: offset, notes: notes || null });
  }

  const saved: SavedSet[] = (savedRes.data ?? []).map((r) => ({
    exerciseId: r.exercise_id as string,
    setIndex: r.set_index as number,
    side: (r.side as "left" | "right" | null) ?? null,
    weightKg: r.weight_kg === null ? null : Number(r.weight_kg),
    reps: r.reps === null ? null : Number(r.reps),
    rpe: r.rpe === null ? null : Number(r.rpe),
    setType: asSetType(r.set_type),
  }));

  // Previous values: per exercise/set/side the value from the most recent earlier finished run that has it.
  const prev: PrevSet[] = [];
  if (prevRunIds.length) {
    const rank = new Map(prevRunIds.map((rid, i) => [rid, i]));
    const best = new Map<string, { rank: number; row: PrevSet }>();
    for (const r of prevSetsRes.data ?? []) {
      const key = `${r.exercise_id}:${r.set_index}:${r.side ?? ""}`;
      const rk = rank.get(r.run_id as string) ?? Infinity;
      const cur = best.get(key);
      if (cur && cur.rank <= rk) continue;
      best.set(key, {
        rank: rk,
        row: {
          exerciseId: r.exercise_id as string,
          setIndex: r.set_index as number,
          side: (r.side as "left" | "right" | null) ?? null,
          weightKg: r.weight_kg === null ? null : Number(r.weight_kg),
          reps: r.reps === null ? null : Number(r.reps),
          rpe: r.rpe === null ? null : Number(r.rpe),
          setType: asSetType(r.set_type),
        },
      });
    }
    for (const v of best.values()) prev.push(v.row);
  }

  return { workout, blocks, saved, prev, run, log: (logRes.data as RunData["log"]) ?? null };
}
