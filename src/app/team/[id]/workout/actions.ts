"use server";

import { createClient } from "@/lib/supabase/server";
import type { MessageKey } from "@/lib/i18n";
import {
  UUID, runDeleteSet, runFinish, runSaveSet, runStart,
  type Ctx, type RunResult, type RunSetPayload, type StartResult,
} from "@/lib/run-writes";

export type { RunResult, StartResult, RunSetPayload };

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

export async function startRun(teamId: string, sessionId: string): Promise<StartResult> {
  const c = await context(teamId, sessionId);
  if (failed(c)) return { ok: false, error: c.error };
  return runStart(c, teamId, sessionId);
}

export async function saveRunSet(teamId: string, sessionId: string, payload: RunSetPayload): Promise<RunResult> {
  const c = await context(teamId, sessionId);
  if (failed(c)) return { ok: false, error: c.error };
  return runSaveSet(c, sessionId, payload);
}

export async function deleteRunSet(
  teamId: string, sessionId: string, exerciseId: string, setIndex: number, side: "left" | "right" | null,
): Promise<RunResult> {
  const c = await context(teamId, sessionId);
  if (failed(c)) return { ok: false, error: c.error };
  return runDeleteSet(c, sessionId, exerciseId, setIndex, side);
}

/** Finishes the run; the database creates today's training log (duration x RPE) in the same call. */
export async function finishRun(teamId: string, sessionId: string, durationMin: number, rpe: number): Promise<RunResult> {
  // Input checks first, as before: bad numbers never reach the database.
  if (!Number.isInteger(durationMin) || durationMin < 1 || durationMin > 600) return { ok: false, error: "run.error.duration" };
  if (!Number.isInteger(rpe) || rpe < 1 || rpe > 10) return { ok: false, error: "run.error.rpeLog" };
  const c = await context(teamId, sessionId);
  if (failed(c)) return { ok: false, error: c.error };
  return runFinish(c, teamId, sessionId, durationMin, rpe);
}
