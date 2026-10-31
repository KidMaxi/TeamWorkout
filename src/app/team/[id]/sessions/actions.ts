"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canPlanType, getStaffKind, type StaffKind } from "@/lib/roles";
import { SESSION_TYPE_LIST, type SessionType } from "@/lib/load";
import type { MessageKey } from "@/lib/i18n";
import {
  FOCUS_LIST, MAX_LOCATION, MAX_NOTE, MAX_OCCURRENCES, addDays, diffDays, isFocus, isHm, isStatus, isYmd,
  localDay, seriesDays, zonedToUtc, type SessionStatus,
} from "@/lib/session-plan";

export type SessionResult = { ok: boolean; error?: MessageKey };
export type Scope = "this" | "series";

type Db = Awaited<ReturnType<typeof createClient>>;
const fail = (error: MessageKey): SessionResult => ({ ok: false, error });
const NOT_ALLOWED: MessageKey = "danger.error.notAllowed";
const GENERIC: MessageKey = "danger.error.generic";
const isType = (v: unknown): v is SessionType => typeof v === "string" && (SESSION_TYPE_LIST as readonly string[]).includes(v);
const isScope = (v: unknown): v is Scope => v === "this" || v === "series";

type Row = { id: string; team_id: string; type: SessionType; starts_at: string; series_id: string | null };

async function whoAmI(db: Db): Promise<string | null> {
  const { data: { user } } = await db.auth.getUser();
  return user?.id ?? null;
}

/** The session row, read through RLS (so only members of its team can see it). The team always comes from here, never from the client. */
async function loadSession(db: Db, sessionId: unknown): Promise<Row | null> {
  if (typeof sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(sessionId)) return null;
  const { data } = await db.from("sessions").select("id, team_id, type, starts_at, series_id").eq("id", sessionId).maybeSingle();
  return data && isType(data.type) ? (data as Row) : null;
}

/** The session plus, for scope 'series', all later ones of its series. Every target must be plannable by the caller. */
async function targetsFor(db: Db, row: Row, scope: Scope, kind: StaffKind | null): Promise<Row[] | null> {
  let rows: Row[] = [row];
  if (scope === "series" && row.series_id) {
    const { data } = await db.from("sessions").select("id, team_id, type, starts_at, series_id")
      .eq("team_id", row.team_id).eq("series_id", row.series_id).gte("starts_at", row.starts_at).order("starts_at");
    rows = (data ?? []).filter((r) => isType(r.type)) as Row[];
    if (!rows.some((r) => r.id === row.id)) rows.unshift(row);
  }
  return rows.every((r) => canPlanType(kind, r.type)) ? rows : null;
}

type Fields = {
  type: SessionType; date: string; time: string; duration: number; rpe: number | null;
  focus: string[]; location: string | null; note: string | null; workoutId: string | null;
};

function intIn(v: FormDataEntryValue | null, min: number, max: number): number | null {
  const s = String(v ?? "").trim();
  if (!/^\d{1,4}$/.test(s)) return null;
  const n = Number(s);
  return n >= min && n <= max ? n : null;
}

function parseFields(fd: FormData): Fields | MessageKey {
  const type = fd.get("type");
  if (!isType(type)) return "sessions.error.invalid";
  const date = String(fd.get("date") ?? "");
  const time = String(fd.get("time") ?? "");
  if (!isYmd(date) || !isHm(time)) return "sessions.error.date";
  const duration = intIn(fd.get("duration"), 1, 600);
  if (duration === null) return "sessions.error.invalid";
  const rawRpe = String(fd.get("rpe") ?? "").trim();
  const rpe = rawRpe ? intIn(rawRpe, 1, 10) : null;
  if (rawRpe && rpe === null) return "sessions.error.invalid";
  if (type !== "gym" && rpe === null) return "sessions.error.invalid"; // intensity is required for court sessions
  const focus = [...new Set(fd.getAll("focus").map(String))];
  if (!focus.every(isFocus) || focus.length > FOCUS_LIST.length) return "sessions.error.invalid";
  const location = String(fd.get("location") ?? "").trim();
  const note = String(fd.get("note") ?? "").trim();
  if (location.length > MAX_LOCATION || note.length > MAX_NOTE) return "sessions.error.invalid";
  const workoutId = type === "gym" ? String(fd.get("workout_id") ?? "").trim() || null : null;
  return { type, date, time, duration, rpe, focus: type === "gym" ? [] : focus, location: location || null, note: note || null, workoutId };
}

/** A workout is only stored on gym sessions and only when it is an active workout of this team's club. */
async function workoutOk(db: Db, teamId: string, workoutId: string | null): Promise<boolean> {
  if (!workoutId) return true;
  if (!/^[0-9a-f-]{36}$/i.test(workoutId)) return false;
  const { data: team } = await db.from("teams").select("club_id").eq("id", teamId).maybeSingle();
  if (!team?.club_id) return false;
  const { data } = await db.from("workouts").select("id").eq("id", workoutId).eq("club_id", team.club_id).is("archived_at", null).maybeSingle();
  return !!data;
}

const refresh = (teamId: string) => revalidatePath(`/team/${teamId}`, "layout");

/** Plan one session or a weekly series (same weekday and Amsterdam wall-clock time, one shared series_id). */
export async function createSessions(teamId: string, fd: FormData): Promise<SessionResult> {
  const db = await createClient();
  const uid = await whoAmI(db);
  if (!uid || typeof teamId !== "string" || !/^[0-9a-f-]{36}$/i.test(teamId)) return fail(NOT_ALLOWED);
  const kind = await getStaffKind(db, teamId, uid);
  const f = parseFields(fd);
  if (typeof f === "string") return fail(f);
  if (!canPlanType(kind, f.type)) return fail(NOT_ALLOWED);
  if (!(await workoutOk(db, teamId, f.workoutId))) return fail("sessions.error.invalid");

  let days = [f.date];
  const repeat = String(fd.get("repeat") ?? "none");
  if (repeat === "weekly") {
    const until = String(fd.get("until") ?? "");
    if (!isYmd(until) || until < f.date) return fail("sessions.error.repeat");
    days = seriesDays(f.date, until);
    if (days.length > MAX_OCCURRENCES) return fail("sessions.error.repeat");
  } else if (repeat !== "none") {
    return fail("sessions.error.invalid");
  }
  const seriesId = days.length > 1 ? crypto.randomUUID() : null;
  const rows = days.map((d) => ({
    team_id: teamId, type: f.type, title: "", starts_at: zonedToUtc(d, f.time).toISOString(),
    planned_duration_min: f.duration, planned_rpe: f.rpe, workout_id: f.workoutId,
    focus: f.focus, location: f.location, coach_note: f.note, series_id: seriesId,
  }));
  const { error } = await db.from("sessions").insert(rows);
  if (error) return fail(error.message.includes("row-level security") ? NOT_ALLOWED : GENERIC);
  refresh(teamId);
  return { ok: true };
}

/**
 * Edit one session, or this one and all later sessions of its series (scope 'series').
 * For a series the new weekday shift, time, type and details apply to every later occurrence; DST is handled per occurrence.
 */
export async function updateSession(sessionId: string, scope: Scope, fd: FormData): Promise<SessionResult> {
  const db = await createClient();
  const uid = await whoAmI(db);
  if (!uid || !isScope(scope)) return fail(NOT_ALLOWED);
  const row = await loadSession(db, sessionId);
  if (!row) return fail("sessions.error.notFound");
  const kind = await getStaffKind(db, row.team_id, uid);
  const f = parseFields(fd);
  if (typeof f === "string") return fail(f);
  if (!canPlanType(kind, row.type) || !canPlanType(kind, f.type)) return fail(NOT_ALLOWED);
  const targets = await targetsFor(db, row, scope, kind);
  if (!targets) return fail(NOT_ALLOWED);
  if (!(await workoutOk(db, row.team_id, f.workoutId))) return fail("sessions.error.invalid");

  const shift = diffDays(localDay(row.starts_at), f.date);
  for (const t of targets) {
    const day = t.id === row.id ? f.date : addDays(localDay(t.starts_at), shift);
    const { data, error } = await db.from("sessions").update({
      type: f.type, starts_at: zonedToUtc(day, f.time).toISOString(), planned_duration_min: f.duration, planned_rpe: f.rpe,
      workout_id: f.workoutId, focus: f.focus, location: f.location, coach_note: f.note,
    }).eq("id", t.id).eq("team_id", row.team_id).select("id");
    if (error || !data?.length) return fail(error && !error.message.includes("row-level security") ? GENERIC : NOT_ALLOWED);
  }
  refresh(row.team_id);
  return { ok: true };
}

/** Planned / completed / adjusted / cancelled. A note (for 'adjusted': why) replaces coach_note when given. */
export async function setSessionStatus(sessionId: string, status: SessionStatus, scope: Scope, note?: string | null): Promise<SessionResult> {
  const db = await createClient();
  const uid = await whoAmI(db);
  if (!uid || !isStatus(status) || !isScope(scope)) return fail(NOT_ALLOWED);
  const row = await loadSession(db, sessionId);
  if (!row) return fail("sessions.error.notFound");
  const kind = await getStaffKind(db, row.team_id, uid);
  if (!canPlanType(kind, row.type)) return fail(NOT_ALLOWED);
  const trimmed = typeof note === "string" ? note.trim() : "";
  if (trimmed.length > MAX_NOTE) return fail("sessions.error.invalid");
  const targets = await targetsFor(db, row, scope, kind);
  if (!targets) return fail(NOT_ALLOWED);

  const patch: { status: SessionStatus; coach_note?: string } = { status };
  if (trimmed) patch.coach_note = trimmed;
  const { data, error } = await db.from("sessions").update(patch)
    .in("id", targets.map((t) => t.id)).eq("team_id", row.team_id).select("id");
  if (error || !data?.length) return fail(error && !error.message.includes("row-level security") ? GENERIC : NOT_ALLOWED);
  refresh(row.team_id);
  return { ok: true };
}

/**
 * Delete a session or this and all later sessions of its series. Sessions that already carry athlete logs or workout runs
 * are never deleted (history): a single one is refused with an explanation, inside a series they are cancelled instead.
 */
export async function deleteSession(sessionId: string, scope: Scope): Promise<SessionResult> {
  const db = await createClient();
  const uid = await whoAmI(db);
  if (!uid || !isScope(scope)) return fail(NOT_ALLOWED);
  const row = await loadSession(db, sessionId);
  if (!row) return fail("sessions.error.notFound");
  const kind = await getStaffKind(db, row.team_id, uid);
  if (!canPlanType(kind, row.type)) return fail(NOT_ALLOWED);
  const targets = await targetsFor(db, row, scope, kind);
  if (!targets) return fail(NOT_ALLOWED);

  const ids = targets.map((t) => t.id);
  const [logs, runs] = await Promise.all([
    db.from("session_logs").select("session_id").in("session_id", ids),
    db.from("workout_runs").select("session_id").in("session_id", ids),
  ]);
  const kept = new Set([...(logs.data ?? []), ...(runs.data ?? [])].map((r) => r.session_id as string));
  if (scope === "this" && kept.has(row.id)) return fail("sessions.error.hasLogs");

  const removable = ids.filter((id) => !kept.has(id));
  if (removable.length) {
    const { data, error } = await db.from("sessions").delete().in("id", removable).eq("team_id", row.team_id).select("id");
    if (error || !data?.length) return fail(error && !error.message.includes("row-level security") ? GENERIC : NOT_ALLOWED);
  }
  if (kept.size) await db.from("sessions").update({ status: "cancelled" }).in("id", [...kept]).eq("team_id", row.team_id);
  refresh(row.team_id);
  return { ok: true };
}
