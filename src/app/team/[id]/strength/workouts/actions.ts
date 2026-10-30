"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MessageKey } from "@/lib/i18n";

export type WorkoutSetPayload = {
  reps: number | null;
  target_rpe: number | null;
  fixed_weight_kg: number | null;
  rest_seconds: number;
};
export type WorkoutPayload = {
  name: string;
  description: string;
  blocks: { exercise_id: string; sets: WorkoutSetPayload[] }[];
};
export type WorkoutResult = { ok: boolean; id?: string; error?: MessageKey };

const NOT_ALLOWED: MessageKey = "workouts.error.notAllowed";
const GENERIC: MessageKey = "workouts.error.generic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Kinds where a set is prescribed in repetitions. */
const REP_KINDS = ["weight_reps", "bodyweight_reps", "weighted_bodyweight"];

/** Re-derive club and role from the team; never trust anything the client sends. */
async function staffContext(teamId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !UUID.test(teamId)) return null;
  const [{ data: team }, { data: me }] = await Promise.all([
    supabase.from("teams").select("club_id").eq("id", teamId).single(),
    supabase.from("team_members").select("role").eq("team_id", teamId).eq("user_id", user.id).single(),
  ]);
  if (!team?.club_id || me?.role !== "staff") return null;
  return { supabase, clubId: team.club_id as string };
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

type Parsed = { ok: true; value: WorkoutPayload } | { ok: false; error: MessageKey };

/** Strict range checks; anything unexpected is rejected, nothing is coerced. */
function parse(raw: string, kinds: Map<string, string>): Parsed {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: "workouts.error.payload" };
  }
  if (!data || typeof data !== "object") return { ok: false, error: "workouts.error.payload" };
  const d = data as Record<string, unknown>;

  const name = typeof d.name === "string" ? d.name.trim() : "";
  if (name.length < 1 || name.length > 80) return { ok: false, error: "workouts.error.name" };
  const description = typeof d.description === "string" ? d.description.trim() : "";
  if (description.length > 1000) return { ok: false, error: "workouts.error.description" };

  if (!Array.isArray(d.blocks) || d.blocks.length < 1) return { ok: false, error: "workouts.error.blocksRequired" };
  if (d.blocks.length > 20) return { ok: false, error: "workouts.error.tooManyBlocks" };

  const blocks: WorkoutPayload["blocks"] = [];
  for (const b of d.blocks as Record<string, unknown>[]) {
    if (!b || typeof b !== "object") return { ok: false, error: "workouts.error.payload" };
    if (typeof b.exercise_id !== "string" || !UUID.test(b.exercise_id)) return { ok: false, error: "workouts.error.exercise" };
    if (!Array.isArray(b.sets) || b.sets.length < 1) return { ok: false, error: "workouts.error.setsRequired" };
    if (b.sets.length > 30) return { ok: false, error: "workouts.error.tooManySets" };
    const kind = kinds.get(b.exercise_id);
    const sets: WorkoutSetPayload[] = [];
    for (const s of b.sets as Record<string, unknown>[]) {
      if (!s || typeof s !== "object") return { ok: false, error: "workouts.error.payload" };
      const reps = s.reps ?? null;
      if (reps === null) {
        if (kind && REP_KINDS.includes(kind)) return { ok: false, error: "workouts.error.reps" };
      } else if (!isNum(reps) || !Number.isInteger(reps) || reps < 1 || reps > 100) {
        return { ok: false, error: "workouts.error.reps" };
      }
      const rpe = s.target_rpe ?? null;
      if (rpe !== null && (!isNum(rpe) || rpe < 5 || rpe > 10 || (rpe * 2) % 1 !== 0)) {
        return { ok: false, error: "workouts.error.rpe" };
      }
      const weight = s.fixed_weight_kg ?? null;
      if (weight !== null && (!isNum(weight) || weight <= 0 || weight > 1000)) {
        return { ok: false, error: "workouts.error.weight" };
      }
      const rest = s.rest_seconds;
      if (!isNum(rest) || !Number.isInteger(rest) || rest < 0 || rest > 600) {
        return { ok: false, error: "workouts.error.rest" };
      }
      sets.push({ reps, target_rpe: rpe, fixed_weight_kg: weight, rest_seconds: rest });
    }
    blocks.push({ exercise_id: b.exercise_id, sets });
  }
  return { ok: true, value: { name, description, blocks } };
}

/** Maps a save_workout failure to a message; 23505 is the unique name per club. */
function failure(error: { code?: string; message?: string } | null): WorkoutResult {
  if (error?.code === "23505") return { ok: false, error: "workouts.error.nameTaken" };
  const m = error?.message ?? "";
  if (m.includes("not allowed")) return { ok: false, error: NOT_ALLOWED };
  if (m.includes("too_many_blocks")) return { ok: false, error: "workouts.error.tooManyBlocks" };
  if (m.includes("blocks_required")) return { ok: false, error: "workouts.error.blocksRequired" };
  if (m.includes("sets_required")) return { ok: false, error: "workouts.error.setsRequired" };
  if (m.includes("invalid_exercise")) return { ok: false, error: "workouts.error.exercise" };
  return { ok: false, error: GENERIC };
}

function refresh(teamId: string) {
  revalidatePath(`/team/${teamId}/strength/workouts`);
  revalidatePath(`/team/${teamId}/sessions`);
}

export async function saveWorkout(teamId: string, workoutId: string | null, payload: string): Promise<WorkoutResult> {
  const ctx = await staffContext(teamId);
  if (!ctx) return { ok: false, error: NOT_ALLOWED };
  if (workoutId !== null && !UUID.test(workoutId)) return { ok: false, error: "workouts.error.notFound" };
  if (typeof payload !== "string" || payload.length > 200_000) return { ok: false, error: "workouts.error.payload" };

  // Exercise kinds decide whether reps are required; only exercises of this club count.
  let ids: string[] = [];
  try {
    const raw = JSON.parse(payload) as { blocks?: { exercise_id?: unknown }[] };
    ids = [...new Set((raw.blocks ?? []).map((b) => b?.exercise_id).filter((v): v is string => typeof v === "string" && UUID.test(v)))];
  } catch {
    return { ok: false, error: "workouts.error.payload" };
  }
  const { data: ex, error: exError } = ids.length
    ? await ctx.supabase.from("exercises").select("id, kind").eq("club_id", ctx.clubId).in("id", ids)
    : { data: [], error: null };
  if (exError) return { ok: false, error: GENERIC };
  const kinds = new Map((ex ?? []).map((e) => [e.id as string, e.kind as string]));
  if (ids.some((i) => !kinds.has(i))) return { ok: false, error: "workouts.error.exercise" };

  const parsed = parse(payload, kinds);
  if (!parsed.ok) return parsed;

  if (workoutId) {
    const { data: own } = await ctx.supabase
      .from("workouts").select("id").eq("id", workoutId).eq("club_id", ctx.clubId).is("archived_at", null).maybeSingle();
    if (!own) return { ok: false, error: "workouts.error.notFound" };
  }

  const { data, error } = await ctx.supabase.rpc("save_workout", {
    _id: workoutId,
    _club: ctx.clubId,
    _name: parsed.value.name,
    _description: parsed.value.description,
    _blocks: parsed.value.blocks,
  });
  if (error) return failure(error);
  refresh(teamId);
  return { ok: true, id: data as string };
}

export async function archiveWorkout(teamId: string, workoutId: string): Promise<{ error?: MessageKey }> {
  const ctx = await staffContext(teamId);
  if (!ctx || !UUID.test(workoutId)) return { error: NOT_ALLOWED };
  const { data, error } = await ctx.supabase
    .from("workouts").update({ archived_at: new Date().toISOString() })
    .eq("id", workoutId).eq("club_id", ctx.clubId).is("archived_at", null).select("id");
  if (error) return { error: GENERIC };
  if (!data?.length) return { error: NOT_ALLOWED };
  refresh(teamId);
  return {};
}

export async function duplicateWorkout(teamId: string, workoutId: string): Promise<WorkoutResult> {
  const ctx = await staffContext(teamId);
  if (!ctx || !UUID.test(workoutId)) return { ok: false, error: NOT_ALLOWED };

  const { data: src, error: readError } = await ctx.supabase
    .from("workouts")
    .select("name, description, workout_blocks(position, exercise_id, workout_sets(position, reps, target_rpe, fixed_weight_kg, rest_seconds))")
    .eq("id", workoutId).eq("club_id", ctx.clubId).is("archived_at", null).maybeSingle();
  if (readError) return { ok: false, error: GENERIC };
  if (!src) return { ok: false, error: "workouts.error.notFound" };

  type SrcSet = { position: number; reps: number | null; target_rpe: number | null; fixed_weight_kg: number | null; rest_seconds: number };
  type SrcBlock = { position: number; exercise_id: string; workout_sets: SrcSet[] };
  const blocks = [...((src.workout_blocks ?? []) as unknown as SrcBlock[])]
    .sort((a, b) => a.position - b.position)
    .map((b) => ({
      exercise_id: b.exercise_id,
      sets: [...b.workout_sets].sort((x, y) => x.position - y.position).map((s) => ({
        reps: s.reps,
        target_rpe: s.target_rpe === null ? null : Number(s.target_rpe),
        fixed_weight_kg: s.fixed_weight_kg === null ? null : Number(s.fixed_weight_kg),
        rest_seconds: s.rest_seconds,
      })),
    }));

  const base = String(src.name);
  for (let n = 1; n <= 20; n++) {
    const suffix = n === 1 ? " (copy)" : ` (copy ${n})`;
    const name = base.slice(0, 80 - suffix.length).trimEnd() + suffix;
    const { data, error } = await ctx.supabase.rpc("save_workout", {
      _id: null,
      _club: ctx.clubId,
      _name: name,
      _description: src.description ?? "",
      _blocks: blocks,
    });
    if (!error) {
      refresh(teamId);
      return { ok: true, id: data as string };
    }
    if (error.code !== "23505") return failure(error);
  }
  return { ok: false, error: "workouts.error.nameTaken" };
}
