"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MessageKey } from "@/lib/i18n";
import type { ExerciseKind } from "@/lib/exercises";

export type ReviewResult = { ok: boolean; error?: MessageKey };
export type CreateRunResult = ReviewResult & { runId?: string };

/** Values a coach can enter for one set. `setType` is only honoured for extra rounds. */
export type SetValues = {
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  setType?: string;
};
export type NewSetInput = SetValues & {
  exerciseId: string;
  /** 1-based, counts per exercise over the whole workout (same as the runner). */
  setIndex: number;
  side: "left" | "right" | null;
};

type SetType = "warmup" | "normal" | "failure" | "drop";
const SET_TYPES: readonly string[] = ["warmup", "normal", "failure", "drop"];
const isSetType = (v: unknown): v is SetType => typeof v === "string" && SET_TYPES.includes(v);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_EXTRA_ROUNDS = 30;

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Staff = { supabase: Supabase; staffId: string };
type Fail = { error: MessageKey };
const failed = <T,>(v: T | Fail): v is Fail => typeof v === "object" && v !== null && "error" in v;

/** Auth + the caller must be staff of this team. Never trusts client ids beyond the team id, which is re-checked. */
async function staffContext(teamId: string): Promise<Staff | Fail> {
  if (typeof teamId !== "string" || !UUID.test(teamId)) return { error: "review.error.notAllowed" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "run.error.auth" };
  const { data: me } = await supabase
    .from("team_members").select("role").eq("team_id", teamId).eq("user_id", user.id).maybeSingle();
  if (!me || me.role !== "staff") return { error: "review.error.notAllowed" };
  return { supabase, staffId: user.id };
}

async function isTeamAthlete(c: Staff, teamId: string, userId: string) {
  const { data } = await c.supabase
    .from("team_members").select("user_id").eq("team_id", teamId).eq("user_id", userId).eq("role", "athlete").maybeSingle();
  return !!data;
}

type RunCtx = { runId: string; sessionId: string; athleteId: string; workoutId: string };

/** The run must belong to a gym session of this team and to an athlete of this team. */
async function loadRun(c: Staff, teamId: string, runId: string): Promise<RunCtx | Fail> {
  if (typeof runId !== "string" || !UUID.test(runId)) return { error: "review.error.notFound" };
  const { data: run } = await c.supabase
    .from("workout_runs").select("id, session_id, user_id").eq("id", runId).maybeSingle();
  if (!run) return { error: "review.error.notFound" };
  const { data: session } = await c.supabase
    .from("sessions").select("id, type, workout_id").eq("id", run.session_id).eq("team_id", teamId).maybeSingle();
  if (!session || session.type !== "gym" || !session.workout_id) return { error: "review.error.notFound" };
  if (!(await isTeamAthlete(c, teamId, run.user_id as string))) return { error: "review.error.notAthlete" };
  return {
    runId: run.id as string,
    sessionId: session.id as string,
    athleteId: run.user_id as string,
    workoutId: session.workout_id as string,
  };
}

type Plan = {
  /** Planned sets per exercise in run order (block position, then set position); index i is set_index i + 1. */
  sets: Map<string, { id: string; type: SetType }[]>;
  kinds: Map<string, ExerciseKind>;
  perSide: Map<string, boolean>;
};

async function loadPlan(c: Staff, workoutId: string): Promise<Plan | null> {
  const { data: blocks } = await c.supabase
    .from("workout_blocks").select("id, position, exercise_id").eq("workout_id", workoutId).order("position");
  const blockList = blocks ?? [];
  if (!blockList.length) return null;
  const exerciseIds = [...new Set(blockList.map((b) => b.exercise_id as string))];
  const [{ data: sets }, { data: exercises }] = await Promise.all([
    c.supabase.from("workout_sets").select("id, block_id, position, set_type")
      .in("block_id", blockList.map((b) => b.id)).order("position"),
    c.supabase.from("exercises").select("id, kind, per_side").in("id", exerciseIds),
  ]);
  const plan: Plan = {
    sets: new Map(exerciseIds.map((id) => [id, []])),
    kinds: new Map((exercises ?? []).map((e) => [e.id as string, e.kind as ExerciseKind])),
    perSide: new Map((exercises ?? []).map((e) => [e.id as string, !!e.per_side])),
  };
  for (const b of blockList) {
    for (const s of (sets ?? []).filter((x) => x.block_id === b.id)) {
      plan.sets.get(b.exercise_id as string)?.push({ id: s.id as string, type: isSetType(s.set_type) ? s.set_type : "normal" });
    }
  }
  return plan;
}

const hasMax2Decimals = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
const num = (v: unknown) => (v === null || v === undefined ? null : typeof v === "number" ? v : NaN);

/** Validates and reduces the numbers to what the exercise kind records (same rules as the runner). */
function normalize(
  kind: ExerciseKind, setType: SetType, input: SetValues,
): { weight: number | null; reps: number; rpe: number | null } | Fail {
  let weight = num(input?.weight);
  const reps = num(input?.reps);
  let rpe = num(input?.rpe);
  if (weight !== null && (!Number.isFinite(weight) || weight < 0 || weight > 1000 || !hasMax2Decimals(weight))) {
    return { error: "run.error.weight" };
  }
  if (reps === null || !Number.isInteger(reps) || reps < 0 || reps > 1000) return { error: "run.error.reps" };
  if (rpe !== null && (!Number.isFinite(rpe) || rpe < 5 || rpe > 10 || Math.abs(rpe * 2 - Math.round(rpe * 2)) > 1e-9)) {
    return { error: "run.error.rpe" };
  }
  if (kind === "weight_reps") {
    if (weight === null) return { error: "run.error.weight" };
  } else if (kind === "weighted_bodyweight") {
    weight = weight ?? 0;
  } else {
    weight = null;
  }
  if (kind === "height_cm" || kind === "duration_s") rpe = null;
  else if (setType === "failure") rpe = 10;
  return { weight, reps, rpe };
}

function revalidate(teamId: string, sessionId: string) {
  revalidatePath(`/team/${teamId}/review/${sessionId}`);
  revalidatePath(`/team/${teamId}/sessions`);
}

/** Every coach write marks the run as coach-logged. */
async function markCoach(c: Staff, runId: string): Promise<boolean> {
  const { error } = await c.supabase
    .from("workout_runs").update({ logged_via: "coach", logged_by: c.staffId }).eq("id", runId);
  return !error;
}

export async function updateRunSet(
  teamId: string, runId: string, runSetId: string, input: SetValues,
): Promise<ReviewResult> {
  const c = await staffContext(teamId);
  if (failed(c)) return { ok: false, error: c.error };
  const r = await loadRun(c, teamId, runId);
  if (failed(r)) return { ok: false, error: r.error };
  if (typeof runSetId !== "string" || !UUID.test(runSetId)) return { ok: false, error: "review.error.notFound" };

  const { data: row } = await c.supabase
    .from("run_sets").select("id, exercise_id, set_id, set_type").eq("id", runSetId).eq("run_id", r.runId).maybeSingle();
  if (!row) return { ok: false, error: "review.error.notFound" };

  const plan = await loadPlan(c, r.workoutId);
  const kind = plan?.kinds.get(row.exercise_id as string);
  if (!plan || !kind) return { ok: false, error: "review.error.notFound" };

  // Planned sets keep the planned type; extra rounds may change it to a known type.
  let setType: SetType = isSetType(row.set_type) ? row.set_type : "normal";
  if (row.set_id) {
    setType = plan.sets.get(row.exercise_id as string)?.find((s) => s.id === row.set_id)?.type ?? setType;
  } else if (input?.setType != null) {
    if (!isSetType(input.setType)) return { ok: false, error: "run.error.setType" };
    setType = input.setType;
  }

  const v = normalize(kind, setType, input);
  if (failed(v)) return { ok: false, error: v.error };

  const { data, error } = await c.supabase
    .from("run_sets").update({ weight_kg: v.weight, reps: v.reps, rpe: v.rpe, set_type: setType })
    .eq("id", row.id).eq("run_id", r.runId).select("id");
  if (error || !data?.length) return { ok: false, error: "run.error.save" };
  if (!(await markCoach(c, r.runId))) return { ok: false, error: "run.error.save" };

  revalidate(teamId, r.sessionId);
  return { ok: true };
}

export async function addRunSet(teamId: string, runId: string, input: NewSetInput): Promise<ReviewResult> {
  const c = await staffContext(teamId);
  if (failed(c)) return { ok: false, error: c.error };
  const r = await loadRun(c, teamId, runId);
  if (failed(r)) return { ok: false, error: r.error };

  const p = input as Partial<NewSetInput> | null;
  if (!p || typeof p.exerciseId !== "string" || !UUID.test(p.exerciseId)) return { ok: false, error: "run.error.exercise" };
  const plan = await loadPlan(c, r.workoutId);
  const kind = plan?.kinds.get(p.exerciseId);
  const planned = plan?.sets.get(p.exerciseId);
  if (!plan || !kind || !planned) return { ok: false, error: "run.error.exercise" };

  const setIndex = p.setIndex;
  if (typeof setIndex !== "number" || !Number.isInteger(setIndex) || setIndex < 1 || setIndex > planned.length + MAX_EXTRA_ROUNDS) {
    return { ok: false, error: "run.error.setIndex" };
  }
  const perSide = plan.perSide.get(p.exerciseId) ?? false;
  if (perSide ? p.side !== "left" && p.side !== "right" : p.side != null) return { ok: false, error: "run.error.side" };
  const side = p.side ?? null;

  const plannedSet = planned[setIndex - 1];
  let setType: SetType = "normal";
  if (plannedSet) setType = plannedSet.type;
  else if (p.setType != null) {
    if (!isSetType(p.setType)) return { ok: false, error: "run.error.setType" };
    setType = p.setType;
  }

  const v = normalize(kind, setType, p as SetValues);
  if (failed(v)) return { ok: false, error: v.error };

  let q = c.supabase.from("run_sets").select("id")
    .eq("run_id", r.runId).eq("exercise_id", p.exerciseId).eq("set_index", setIndex);
  q = side ? q.eq("side", side) : q.is("side", null);
  const { data: existing } = await q.maybeSingle();
  if (existing) return { ok: false, error: "review.error.exists" };

  const { error } = await c.supabase.from("run_sets").insert({
    run_id: r.runId, exercise_id: p.exerciseId, set_id: plannedSet?.id ?? null, set_index: setIndex, side,
    weight_kg: v.weight, reps: v.reps, rpe: v.rpe, set_type: setType, done_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.code === "23505" ? "review.error.exists" : "run.error.save" };
  if (!(await markCoach(c, r.runId))) return { ok: false, error: "run.error.save" };

  revalidate(teamId, r.sessionId);
  return { ok: true };
}

/** Bound to a ConfirmButton: the dialog's FormData is ignored. */
export async function deleteRunSet(teamId: string, runId: string, runSetId: string): Promise<ReviewResult> {
  const c = await staffContext(teamId);
  if (failed(c)) return { ok: false, error: c.error };
  const r = await loadRun(c, teamId, runId);
  if (failed(r)) return { ok: false, error: r.error };
  if (typeof runSetId !== "string" || !UUID.test(runSetId)) return { ok: false, error: "review.error.notFound" };

  const { data, error } = await c.supabase
    .from("run_sets").delete().eq("id", runSetId).eq("run_id", r.runId).select("id");
  if (error) return { ok: false, error: "run.error.save" };
  if (!data?.length) return { ok: false, error: "review.error.notFound" };
  if (!(await markCoach(c, r.runId))) return { ok: false, error: "run.error.save" };

  revalidate(teamId, r.sessionId);
  return { ok: true };
}

/** Creates a run for an athlete who has none yet; the coach then enters the sets. */
export async function createRunForAthlete(teamId: string, sessionId: string, athleteId: string): Promise<CreateRunResult> {
  const c = await staffContext(teamId);
  if (failed(c)) return { ok: false, error: c.error };
  if (typeof sessionId !== "string" || !UUID.test(sessionId) || typeof athleteId !== "string" || !UUID.test(athleteId)) {
    return { ok: false, error: "review.error.notFound" };
  }

  const { data: session } = await c.supabase
    .from("sessions").select("id, type, workout_id").eq("id", sessionId).eq("team_id", teamId).maybeSingle();
  if (!session || session.type !== "gym" || !session.workout_id) return { ok: false, error: "review.error.notFound" };
  if (!(await isTeamAthlete(c, teamId, athleteId))) return { ok: false, error: "review.error.notAthlete" };

  const { data: excluded } = await c.supabase
    .from("session_exclusions").select("user_id").eq("session_id", sessionId).eq("user_id", athleteId).maybeSingle();
  if (excluded) return { ok: false, error: "review.error.excluded" };

  const find = async () => {
    const { data } = await c.supabase
      .from("workout_runs").select("id").eq("session_id", sessionId).eq("user_id", athleteId).maybeSingle();
    return data?.id as string | undefined;
  };

  let runId = await find();
  if (!runId) {
    const { error } = await c.supabase.from("workout_runs").insert({
      session_id: sessionId, user_id: athleteId, logged_via: "coach", logged_by: c.staffId,
    });
    // 23505: a parallel call (double tap) created it first; that is fine.
    if (error && error.code !== "23505") return { ok: false, error: "run.error.save" };
    runId = await find();
  }
  if (!runId) return { ok: false, error: "run.error.save" };

  revalidate(teamId, sessionId);
  return { ok: true, runId };
}

/** Sets the session totals; the database recreates the athlete's training log. */
export async function correctLog(teamId: string, runId: string, durationMin: number, rpe: number): Promise<ReviewResult> {
  if (typeof durationMin !== "number" || !Number.isInteger(durationMin) || durationMin < 1 || durationMin > 600) {
    return { ok: false, error: "run.error.duration" };
  }
  if (typeof rpe !== "number" || !Number.isInteger(rpe) || rpe < 1 || rpe > 10) return { ok: false, error: "run.error.rpeLog" };

  const c = await staffContext(teamId);
  if (failed(c)) return { ok: false, error: c.error };
  const r = await loadRun(c, teamId, runId);
  if (failed(r)) return { ok: false, error: r.error };

  const { error } = await c.supabase.rpc("finish_workout_run", { _run: r.runId, _duration_min: durationMin, _rpe: rpe });
  if (error) {
    const m = error.message ?? "";
    if (m.includes("invalid_duration")) return { ok: false, error: "run.error.duration" };
    if (m.includes("invalid_rpe")) return { ok: false, error: "run.error.rpeLog" };
    if (m.includes("not allowed")) return { ok: false, error: "review.error.notAllowed" };
    return { ok: false, error: "run.error.save" };
  }
  if (!(await markCoach(c, r.runId))) return { ok: false, error: "run.error.save" };

  revalidate(teamId, r.sessionId);
  return { ok: true };
}
