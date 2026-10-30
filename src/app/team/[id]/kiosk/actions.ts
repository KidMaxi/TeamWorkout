"use server";

import { createClient } from "@/lib/supabase/server";
import type { MessageKey } from "@/lib/i18n";
import {
  UUID, runDeleteSet, runFinish, runSaveSet, runStart,
  type Ctx, type RunSetPayload, type StartResult,
} from "@/lib/run-writes";

/** iPad mode: a signed-in coach acts for the athlete who just entered their PIN. */
export type KioskResult = { ok: boolean; error?: MessageKey };

type Fail = { error: MessageKey };
const failed = (c: Ctx | Fail): c is Fail => "error" in c;

/**
 * Everything is re-derived from the database; no client id is trusted:
 * signed in, STAFF of the team, gym session of this team with a workout,
 * target is an athlete of the team and not excluded, PIN accepted by kiosk_verify.
 * The PIN only travels in this call's body; it is never stored or logged.
 */
async function context(teamId: string, sessionId: string, userId: string, pin: string | null): Promise<Ctx | Fail> {
  if (![teamId, sessionId, userId].every((v) => typeof v === "string" && UUID.test(v))) {
    return { error: "kiosk.error.notAllowed" };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "run.error.auth" };

  const { data: me } = await supabase
    .from("team_members").select("role").eq("team_id", teamId).eq("user_id", user.id).maybeSingle();
  if (me?.role !== "staff") return { error: "kiosk.error.notAllowed" };

  const { data: session } = await supabase
    .from("sessions").select("id, type, workout_id").eq("id", sessionId).eq("team_id", teamId).maybeSingle();
  if (!session) return { error: "kiosk.error.notAllowed" };
  if (session.type !== "gym" || !session.workout_id) return { error: "run.error.noWorkout" };

  const { data: athlete } = await supabase
    .from("team_members").select("role").eq("team_id", teamId).eq("user_id", userId).maybeSingle();
  if (athlete?.role !== "athlete") return { error: "kiosk.error.notAllowed" };

  const { data: excluded } = await supabase
    .from("session_exclusions").select("user_id").eq("session_id", sessionId).eq("user_id", userId).maybeSingle();
  if (excluded) return { error: "run.error.excluded" };

  const cleanPin = typeof pin === "string" && /^\d{4,6}$/.test(pin) ? pin : null;
  const { data: ok, error } = await supabase.rpc("kiosk_verify", { _team: teamId, _user: userId, _pin: cleanPin });
  if (error) {
    const m = error.message ?? "";
    if (m.includes("pin_locked")) return { error: "kiosk.pin.locked" };
    if (m.includes("pin_not_set")) return { error: "kiosk.pin.notSet" };
    if (m.includes("not allowed")) return { error: "kiosk.error.notAllowed" };
    return { error: "kiosk.pin.error" };
  }
  if (ok !== true) return { error: "kiosk.pin.wrong" };

  return { supabase, userId, workoutId: session.workout_id as string, via: { loggedVia: "kiosk", loggedBy: user.id } };
}

export async function verifyAthletePin(
  teamId: string, sessionId: string, userId: string, pin: string | null,
): Promise<KioskResult> {
  const c = await context(teamId, sessionId, userId, pin);
  return failed(c) ? { ok: false, error: c.error } : { ok: true };
}

export async function kioskStartRun(
  teamId: string, sessionId: string, userId: string, pin: string | null,
): Promise<StartResult> {
  const c = await context(teamId, sessionId, userId, pin);
  if (failed(c)) return { ok: false, error: c.error };
  return runStart(c, teamId, sessionId);
}

export async function kioskSaveRunSet(
  teamId: string, sessionId: string, userId: string, pin: string | null, payload: RunSetPayload,
): Promise<KioskResult> {
  const c = await context(teamId, sessionId, userId, pin);
  if (failed(c)) return { ok: false, error: c.error };
  return runSaveSet(c, sessionId, payload);
}

export async function kioskDeleteRunSet(
  teamId: string, sessionId: string, userId: string, pin: string | null,
  exerciseId: string, setIndex: number, side: "left" | "right" | null,
): Promise<KioskResult> {
  const c = await context(teamId, sessionId, userId, pin);
  if (failed(c)) return { ok: false, error: c.error };
  return runDeleteSet(c, sessionId, exerciseId, setIndex, side);
}

export async function kioskFinishRun(
  teamId: string, sessionId: string, userId: string, pin: string | null,
  durationMin: number, rpe: number,
): Promise<KioskResult> {
  if (!Number.isInteger(durationMin) || durationMin < 1 || durationMin > 600) return { ok: false, error: "run.error.duration" };
  if (!Number.isInteger(rpe) || rpe < 1 || rpe > 10) return { ok: false, error: "run.error.rpeLog" };
  const c = await context(teamId, sessionId, userId, pin);
  if (failed(c)) return { ok: false, error: c.error };
  return runFinish(c, teamId, sessionId, durationMin, rpe);
}
