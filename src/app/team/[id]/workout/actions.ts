"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MessageKey } from "@/lib/i18n";
import type { ExerciseKind } from "@/lib/exercises";

export type RunResult = { ok: boolean; error?: MessageKey };
export type StartResult = RunResult & { startedAt?: string };

export type RunSetPayload = {
  exerciseId: string;
  /** Planned set this row belongs to; null for an extra round. */
  setId: string | null;
  /** 1-based, counts per exercise over the whole workout. */
  setIndex: number;
  side: "left" | "right" | null;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  /** Only used for extra rounds; planned sets always take the type from the plan. */
  setType?: string;
};

type SetType = "warmup" | "normal" | "failure" | "drop";
const SET_TYPES: readonly string[] = ["warmup", "normal", "failure", "drop"];
const isSetType = (v: unknown): v is SetType => typeof v === "string" && SET_TYPES.includes(v);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_EXTRA_ROUNDS = 30;

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Ctx = { supabase: Supabase; userId: string; workoutId: string };
type Fail = { error: MessageKey };

/** Auth + membership + gym session with a workout + not excluded. Never trusts client ids. */
async function context(teamId: string, sessionId: string): Promise<Ctx | Fail> {
  if (!UUID.test(teamId) || !UUID.test(sessionId)) return { error: "run.error.notAllowed" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "run.error.auth" };

  const { data: member } = await supabase
    .from("team_members").select("user_id").eq("team_id", teamId).eq("user_id", user.id).maybeSingle();
  if (!member) return { error: "run.error.notAllowed" };

  const { data: session } = await supabase
    .from("sessions").select("id, type, workout_id").eq("id", sessionId).eq("team_id", teamId).maybeSingle();
  if (!session) return { error: "run.error.notAllowed" };
  if (session.type !== "gym" || !session.workout_id) return { error: "run.error.noWorkout" };

  const { data: excluded } = await supabase
    .from("session_exclusions").select("user_id").eq("session_id", sessionId).eq("user_id", user.id).maybeSingle();
  if (excluded) return { error: "run.error.excluded" };

  return { supabase, userId: user.id, workoutId: session.workout_id as string };
}

const failed = (c: Ctx | Fail): c is Fail => "error" in c;

async function findRun(c: Ctx, sessionId: string) {
  const { data } = await c.supabase
    .from("workout_runs").select("id, started_at, finished_at")
    .eq("session_id", sessionId).eq("user_id", c.userId).maybeSingle();
  return data;
}

function revalidate(teamId: string) {
  revalidatePath(`/team/${teamId}/sessions`);
  revalidatePath(`/team/${teamId}`);
}

export async function startRun(teamId: string, sessionId: string): Promise<StartResult> {
  const c = await context(teamId, sessionId);
  if (failed(c)) return { ok: false, error: c.error };

  let run = await findRun(c, sessionId);
  if (!run) {
    const { error } = await c.supabase.from("workout_runs").insert({ session_id: sessionId, user_id: c.userId });
    // 23505: a parallel call (double tap, second tab) created it first; that is fine.
    if (error && error.code !== "23505") return { ok: false, error: "run.error.save" };
    run = await findRun(c, sessionId);
  }
  if (!run) return { ok: false, error: "run.error.save" };
  if (run.finished_at) return { ok: false, error: "run.error.finished" };

  revalidate(teamId);
  return { ok: true, startedAt: run.started_at as string };
}

/** Workout structure the caller may save against: exercise kinds and planned set counts. */
async function loadPlan(c: Ctx) {
  const { data: blocks } = await c.supabase
    .from("workout_blocks").select("id, exercise_id").eq("workout_id", c.workoutId);
  const blockList = blocks ?? [];
  if (!blockList.length) return null;
  const [{ data: sets }, { data: exercises }] = await Promise.all([
    c.supabase.from("workout_sets").select("id, block_id, set_type").in("block_id", blockList.map((b) => b.id)),
    c.supabase.from("exercises").select("id, kind").in("id", [...new Set(blockList.map((b) => b.exercise_id as string))]),
  ]);
  const exerciseOfBlock = new Map(blockList.map((b) => [b.id as string, b.exercise_id as string]));
  const planned = new Map<string, number>();
  const setExercise = new Map<string, string>();
  const setTypes = new Map<string, SetType>();
  for (const s of sets ?? []) {
    const ex = exerciseOfBlock.get(s.block_id as string);
    if (!ex) continue;
    planned.set(ex, (planned.get(ex) ?? 0) + 1);
    setExercise.set(s.id as string, ex);
    setTypes.set(s.id as string, isSetType(s.set_type) ? s.set_type : "normal");
  }
  const kinds = new Map((exercises ?? []).map((e) => [e.id as string, e.kind as ExerciseKind]));
  return { exerciseIds: new Set(exerciseOfBlock.values()), planned, setExercise, setTypes, kinds };
}

const hasMax2Decimals = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

export async function saveRunSet(teamId: string, sessionId: string, payload: RunSetPayload): Promise<RunResult> {
  const c = await context(teamId, sessionId);
  if (failed(c)) return { ok: false, error: c.error };

  const run = await findRun(c, sessionId);
  if (!run) return { ok: false, error: "run.error.notStarted" };
  if (run.finished_at) return { ok: false, error: "run.error.finished" };

  const p = payload as Partial<RunSetPayload> | null;
  if (!p || typeof p.exerciseId !== "string" || !UUID.test(p.exerciseId)) return { ok: false, error: "run.error.exercise" };
  if (p.setId != null && (typeof p.setId !== "string" || !UUID.test(p.setId))) return { ok: false, error: "run.error.exercise" };
  if (p.side != null && p.side !== "left" && p.side !== "right") return { ok: false, error: "run.error.side" };
  const side = p.side ?? null;

  const plan = await loadPlan(c);
  if (!plan || !plan.exerciseIds.has(p.exerciseId)) return { ok: false, error: "run.error.exercise" };
  if (p.setId && plan.setExercise.get(p.setId) !== p.exerciseId) return { ok: false, error: "run.error.exercise" };
  const kind = plan.kinds.get(p.exerciseId);
  if (!kind) return { ok: false, error: "run.error.exercise" };

  // Planned sets: the plan decides. Extra rounds: the athlete may choose, but only a known type.
  let setType: SetType = "normal";
  if (p.setId) setType = plan.setTypes.get(p.setId) ?? "normal";
  else if (p.setType != null) {
    if (!isSetType(p.setType)) return { ok: false, error: "run.error.setType" };
    setType = p.setType;
  }

  const setIndex = p.setIndex;
  const maxIndex = (plan.planned.get(p.exerciseId) ?? 0) + MAX_EXTRA_ROUNDS;
  if (typeof setIndex !== "number" || !Number.isInteger(setIndex) || setIndex < 1 || setIndex > maxIndex) {
    return { ok: false, error: "run.error.setIndex" };
  }

  // Numbers: validated, then reduced to what the exercise kind records.
  const num = (v: unknown) => (v === null || v === undefined ? null : typeof v === "number" ? v : NaN);
  let weight = num(p.weight);
  const reps = num(p.reps);
  let rpe = num(p.rpe);
  if (weight !== null && (!Number.isFinite(weight) || weight < 0 || weight > 1000 || !hasMax2Decimals(weight))) {
    return { ok: false, error: "run.error.weight" };
  }
  if (reps !== null && (!Number.isInteger(reps) || reps < 0 || reps > 1000)) return { ok: false, error: "run.error.reps" };
  if (rpe !== null && (!Number.isFinite(rpe) || rpe < 5 || rpe > 10 || Math.abs(rpe * 2 - Math.round(rpe * 2)) > 1e-9)) {
    return { ok: false, error: "run.error.rpe" };
  }
  if (reps === null) return { ok: false, error: "run.error.reps" };

  if (kind === "weight_reps") {
    if (weight === null) return { ok: false, error: "run.error.weight" };
  } else if (kind === "weighted_bodyweight") {
    weight = weight ?? 0;
  } else {
    weight = null;
  }
  if (kind === "height_cm" || kind === "duration_s") rpe = null;
  else if (setType === "failure") rpe = 10;

  const values = { weight_kg: weight, reps, rpe, set_type: setType, set_id: p.setId ?? null, done_at: new Date().toISOString() };

  const find = async () => {
    let q = c.supabase.from("run_sets").select("id")
      .eq("run_id", run.id).eq("exercise_id", p.exerciseId!).eq("set_index", setIndex);
    q = side ? q.eq("side", side) : q.is("side", null);
    const { data } = await q.maybeSingle();
    return data?.id as string | undefined;
  };
  const update = async (id: string) => {
    const { data, error } = await c.supabase.from("run_sets").update(values).eq("id", id).select("id");
    return !error && !!data?.length;
  };

  const existing = await find();
  if (existing) {
    if (!(await update(existing))) return { ok: false, error: "run.error.save" };
    return { ok: true };
  }
  const { error } = await c.supabase.from("run_sets").insert({
    run_id: run.id, exercise_id: p.exerciseId, set_index: setIndex, side, ...values,
  });
  if (error) {
    // Unique violation: a parallel save won; update that row instead.
    if (error.code === "23505") {
      const id = await find();
      if (id && (await update(id))) return { ok: true };
    }
    return { ok: false, error: "run.error.save" };
  }
  return { ok: true };
}

export async function deleteRunSet(
  teamId: string, sessionId: string, exerciseId: string, setIndex: number, side: "left" | "right" | null,
): Promise<RunResult> {
  const c = await context(teamId, sessionId);
  if (failed(c)) return { ok: false, error: c.error };
  if (!UUID.test(exerciseId)) return { ok: false, error: "run.error.exercise" };
  if (!Number.isInteger(setIndex) || setIndex < 1) return { ok: false, error: "run.error.setIndex" };
  if (side !== null && side !== "left" && side !== "right") return { ok: false, error: "run.error.side" };

  const run = await findRun(c, sessionId);
  if (!run) return { ok: false, error: "run.error.notStarted" };
  if (run.finished_at) return { ok: false, error: "run.error.finished" };

  let q = c.supabase.from("run_sets").delete().eq("run_id", run.id).eq("exercise_id", exerciseId).eq("set_index", setIndex);
  q = side ? q.eq("side", side) : q.is("side", null);
  const { error } = await q;
  return error ? { ok: false, error: "run.error.save" } : { ok: true };
}

/** Finishes the run; the database creates today's training log (duration x RPE) in the same call. */
export async function finishRun(teamId: string, sessionId: string, durationMin: number, rpe: number): Promise<RunResult> {
  if (!Number.isInteger(durationMin) || durationMin < 1 || durationMin > 600) return { ok: false, error: "run.error.duration" };
  if (!Number.isInteger(rpe) || rpe < 1 || rpe > 10) return { ok: false, error: "run.error.rpeLog" };

  const c = await context(teamId, sessionId);
  if (failed(c)) return { ok: false, error: c.error };
  const run = await findRun(c, sessionId);
  if (!run) return { ok: false, error: "run.error.notStarted" };
  if (run.finished_at) return { ok: false, error: "run.error.finished" };

  const { error } = await c.supabase.rpc("finish_workout_run", { _run: run.id, _duration_min: durationMin, _rpe: rpe });
  if (error) {
    const m = error.message ?? "";
    if (m.includes("invalid_duration")) return { ok: false, error: "run.error.duration" };
    if (m.includes("invalid_rpe")) return { ok: false, error: "run.error.rpeLog" };
    if (m.includes("not allowed")) return { ok: false, error: "run.error.notAllowed" };
    return { ok: false, error: "run.error.save" };
  }
  revalidate(teamId);
  return { ok: true };
}
