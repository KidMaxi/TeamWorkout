"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MessageKey } from "@/lib/i18n";
import { can, getStaffKind, type Capability, type StaffKind } from "@/lib/roles";
import { todayInTeamZone } from "@/lib/wellness";
import type { DangerResult } from "@/app/actions";

export type WorkloadResult = { ok: boolean; error?: MessageKey };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_ALLOWED: WorkloadResult = { ok: false, error: "workload.error.notAllowed" };
const GENERIC: WorkloadResult = { ok: false, error: "workload.error.generic" };

async function staffContext(teamId: string, capability: Capability = "planRules") {
  if (!UUID.test(teamId)) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const kind = await getStaffKind(supabase, teamId, user.id);
  if (!can(kind, capability)) return null;
  return { supabase, userId: user.id, kind: kind as StaffKind };
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function isAthleteOf(supabase: Supabase, teamId: string, userId: string) {
  const { data } = await supabase
    .from("team_members").select("role").eq("team_id", teamId).eq("user_id", userId).maybeSingle();
  return data?.role === "athlete";
}

/** Empty -> null (no limit); otherwise a whole number within [0, max]; undefined = invalid. */
function parseLimit(raw: FormDataEntryValue | null, max: number): number | null | undefined {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s === "") return null;
  if (!/^\d{1,3}$/.test(s)) return undefined;
  const n = Number(s);
  return n >= 0 && n <= max ? n : undefined;
}

/** Save the team default (userId null) or one athlete's override. Partial unique indexes: select, then update or insert. */
export async function saveWeekRules(teamId: string, userId: string | null, formData: FormData): Promise<WorkloadResult> {
  const ctx = await staffContext(teamId);
  if (!ctx) return NOT_ALLOWED;
  const { supabase } = ctx;
  if (userId !== null && (!UUID.test(userId) || !(await isAthleteOf(supabase, teamId, userId)))) return NOT_ALLOWED;

  const maxTrainings = parseLimit(formData.get("max_trainings"), 14);
  const maxGym = parseLimit(formData.get("max_gym"), 14);
  const maxMatches = parseLimit(formData.get("max_matches"), 14);
  const minRest = parseLimit(formData.get("min_rest_days"), 7);
  if ([maxTrainings, maxGym, maxMatches, minRest].some((v) => v === undefined)) {
    return { ok: false, error: "workload.error.invalid" };
  }
  const values = {
    max_trainings: maxTrainings as number | null,
    max_gym: maxGym as number | null,
    max_matches: maxMatches as number | null,
    min_rest_days: minRest as number | null,
  };

  let q = supabase.from("week_rules").select("id").eq("team_id", teamId);
  q = userId === null ? q.is("user_id", null) : q.eq("user_id", userId);
  const { data: existing, error: selErr } = await q.maybeSingle();
  if (selErr) return GENERIC;

  const stamp = { updated_by: ctx.userId, updated_at: new Date().toISOString() };
  const { error } = existing
    ? await supabase.from("week_rules").update({ ...values, ...stamp }).eq("id", existing.id).eq("team_id", teamId)
    : await supabase.from("week_rules").insert({ team_id: teamId, user_id: userId, ...values, ...stamp });
  if (error) return GENERIC;

  revalidatePath(`/team/${teamId}/workload`);
  return { ok: true };
}

/** Remove an athlete's override so the team default applies again. */
export async function resetAthleteRules(teamId: string, userId: string): Promise<WorkloadResult> {
  const ctx = await staffContext(teamId);
  if (!ctx || !UUID.test(userId)) return NOT_ALLOWED;
  const { error } = await ctx.supabase.from("week_rules").delete().eq("team_id", teamId).eq("user_id", userId);
  if (error) return GENERIC;
  revalidatePath(`/team/${teamId}/workload`);
  return { ok: true };
}

/** excluded=true takes the athlete out of the planned session; false puts them back. */
export async function toggleExclusion(
  teamId: string, sessionId: string, userId: string, excluded: boolean,
): Promise<WorkloadResult> {
  const ctx = await staffContext(teamId);
  if (!ctx || !UUID.test(sessionId) || !UUID.test(userId)) return NOT_ALLOWED;
  const { supabase } = ctx;

  const { data: session } = await supabase
    .from("sessions").select("id").eq("id", sessionId).eq("team_id", teamId).maybeSingle();
  if (!session || !(await isAthleteOf(supabase, teamId, userId))) return NOT_ALLOWED;

  if (excluded) {
    const { error } = await supabase
      .from("session_exclusions").insert({ session_id: sessionId, user_id: userId, created_by: ctx.userId });
    // 23505 = already excluded: the desired state holds.
    if (error && error.code !== "23505") return GENERIC;
  } else {
    const { error } = await supabase
      .from("session_exclusions").delete().eq("session_id", sessionId).eq("user_id", userId);
    if (error) return GENERIC;
  }
  revalidatePath(`/team/${teamId}/workload`);
  return { ok: true };
}

const REASONS = ["load", "pain", "illness", "schedule", "tactics", "other"] as const;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** A staff note (any staff kind that may write notes): why the plan was adjusted, or what was seen. */
export async function addWorkloadNote(teamId: string, userId: string, formData: FormData): Promise<WorkloadResult> {
  const ctx = await staffContext(teamId, "writeNotes");
  if (!ctx || !UUID.test(userId)) return NOT_ALLOWED;
  const { supabase } = ctx;
  if (!(await isAthleteOf(supabase, teamId, userId))) return NOT_ALLOWED;

  const reason = String(formData.get("reason") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const dayRaw = String(formData.get("day") ?? "").trim();
  const sessionRaw = String(formData.get("session_id") ?? "").trim();
  if (!(REASONS as readonly string[]).includes(reason) || note.length < 1 || note.length > 500) {
    return { ok: false, error: "workload.error.note" };
  }
  let day = todayInTeamZone();
  if (dayRaw !== "") {
    const d = YMD.test(dayRaw) ? new Date(`${dayRaw}T12:00:00Z`) : null;
    if (!d || isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== dayRaw) return { ok: false, error: "workload.error.note" };
    day = dayRaw;
  }
  let sessionId: string | null = null;
  if (sessionRaw !== "") {
    if (!UUID.test(sessionRaw)) return { ok: false, error: "workload.error.note" };
    const { data: session } = await supabase.from("sessions").select("id").eq("id", sessionRaw).eq("team_id", teamId).maybeSingle();
    if (!session) return NOT_ALLOWED;
    sessionId = sessionRaw;
  }
  const { error } = await supabase.from("workload_notes").insert({
    team_id: teamId, user_id: userId, session_id: sessionId, day, reason, note, created_by: ctx.userId,
  });
  if (error) return GENERIC;
  revalidatePath(`/team/${teamId}/workload`);
  return { ok: true };
}

/** Delete a note: the author or the head coach (RLS decides; this only checks the caller is staff). */
export async function deleteWorkloadNote(teamId: string, noteId: string): Promise<DangerResult> {
  const ctx = await staffContext(teamId, "writeNotes");
  if (!ctx || !UUID.test(noteId)) return { error: "workload.error.notAllowed" };
  const { error } = await ctx.supabase.from("workload_notes").delete().eq("id", noteId).eq("team_id", teamId);
  if (error) return { error: "workload.error.generic" };
  revalidatePath(`/team/${teamId}/workload`);
  return {};
}

function parseNumber(raw: FormDataEntryValue | null, min: number, max: number, integer: boolean): number | undefined {
  const s = typeof raw === "string" ? raw.trim().replace(",", ".") : "";
  if (!/^\d{1,3}(\.\d)?$/.test(s)) return undefined;
  const n = Number(s);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) return undefined;
  return n;
}

/** Team workload thresholds (head coach only). Ranges mirror the table checks. Missing row = defaults. */
export async function saveWorkloadSettings(teamId: string, formData: FormData): Promise<WorkloadResult> {
  const ctx = await staffContext(teamId, "manageTeam");
  if (!ctx) return NOT_ALLOWED;
  const heavyRpe = parseNumber(formData.get("heavy_rpe"), 1, 10, false);
  const heavyPerDay = parseNumber(formData.get("heavy_per_day"), 1, 6, true);
  const consecutive = parseNumber(formData.get("consecutive_heavy_days"), 2, 7, true);
  const baselineWeeks = parseNumber(formData.get("baseline_weeks"), 2, 12, true);
  const deviationPct = parseNumber(formData.get("deviation_pct"), 10, 100, true);
  if ([heavyRpe, heavyPerDay, consecutive, baselineWeeks, deviationPct].some((v) => v === undefined)) {
    return { ok: false, error: "workload.error.settings" };
  }
  const values = {
    heavy_rpe: heavyRpe as number,
    heavy_per_day: heavyPerDay as number,
    consecutive_heavy_days: consecutive as number,
    baseline_weeks: baselineWeeks as number,
    deviation_pct: deviationPct as number,
    show_ratio: formData.get("show_ratio") === "on",
    updated_by: ctx.userId,
    updated_at: new Date().toISOString(),
  };
  const { supabase } = ctx;
  const { data: existing, error: selErr } = await supabase
    .from("team_workload_settings").select("team_id").eq("team_id", teamId).maybeSingle();
  if (selErr) return GENERIC;
  const { error } = existing
    ? await supabase.from("team_workload_settings").update(values).eq("team_id", teamId)
    : await supabase.from("team_workload_settings").insert({ team_id: teamId, ...values });
  if (error) return GENERIC;
  revalidatePath(`/team/${teamId}/workload`);
  revalidatePath(`/team/${teamId}`);
  return { ok: true };
}
