"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MessageKey } from "@/lib/i18n";

export type WorkloadResult = { ok: boolean; error?: MessageKey };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_ALLOWED: WorkloadResult = { ok: false, error: "workload.error.notAllowed" };
const GENERIC: WorkloadResult = { ok: false, error: "workload.error.generic" };

async function staffContext(teamId: string) {
  if (!UUID.test(teamId)) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase
    .from("team_members").select("role").eq("team_id", teamId).eq("user_id", user.id).maybeSingle();
  if (me?.role !== "staff") return null;
  return { supabase, userId: user.id };
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
