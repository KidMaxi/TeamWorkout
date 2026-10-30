"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MessageKey } from "@/lib/i18n";
import { estimateFiveRM } from "@/lib/strength";
import { todayInTeamZone } from "@/lib/wellness";

export type StrengthResult = { ok: boolean; error?: MessageKey };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accepts "102,5" and "102.5"; returns null for anything else. */
function parseDecimal(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(s)) return null;
  return Number(s);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** May `userId` act on `athleteId`'s tests within team `teamId`? Self (as team member) or staff of that team. */
async function mayManage(supabase: Supabase, teamId: string, userId: string, athleteId: string): Promise<boolean> {
  const { data: members } = await supabase
    .from("team_members").select("user_id, role").eq("team_id", teamId).in("user_id", [userId, athleteId]);
  const mine = members?.find((m) => m.user_id === userId);
  const theirs = members?.find((m) => m.user_id === athleteId);
  if (!mine || !theirs) return false;
  return userId === athleteId || mine.role === "staff";
}

export async function saveStrengthTest(teamId: string, athleteId: string, formData: FormData): Promise<StrengthResult> {
  if (!UUID.test(teamId) || !UUID.test(athleteId)) return { ok: false, error: "strength.error.notAllowed" };

  const exerciseId = String(formData.get("exercise_id") ?? "");
  if (!UUID.test(exerciseId)) return { ok: false, error: "strength.error.exercise" };

  const weight = parseDecimal(String(formData.get("weight_kg") ?? ""));
  if (weight === null || weight <= 0 || weight > 1000) return { ok: false, error: "strength.error.weight" };

  const repsRaw = String(formData.get("reps") ?? "");
  const reps = Number(repsRaw);
  if (!/^\d{1,2}$/.test(repsRaw) || reps < 1 || reps > 12) return { ok: false, error: "strength.error.reps" };

  const rpeRaw = String(formData.get("rpe") ?? "").replace(",", ".");
  const rpe = Number(rpeRaw);
  if (!/^\d{1,2}(\.5)?$/.test(rpeRaw) || rpe < 5 || rpe > 10 || (rpe * 2) % 1 !== 0) {
    return { ok: false, error: "strength.error.rpe" };
  }

  const date = String(formData.get("tested_at") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || date > todayInTeamZone()) {
    return { ok: false, error: "strength.error.date" };
  }

  const note = String(formData.get("note") ?? "").trim();
  if (note.length > 300) return { ok: false, error: "strength.error.note" };

  // Recompute on the server: never trust client values.
  const est = estimateFiveRM(weight, reps, rpe);
  if (!est) return { ok: false, error: "strength.error.outOfTable" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "strength.error.auth" };
  if (!(await mayManage(supabase, teamId, user.id, athleteId))) return { ok: false, error: "strength.error.notAllowed" };

  const { data: team } = await supabase.from("teams").select("club_id").eq("id", teamId).single();
  if (!team) return { ok: false, error: "strength.error.notAllowed" };
  const { data: exercise } = await supabase
    .from("exercises").select("id").eq("id", exerciseId).eq("club_id", team.club_id).eq("track_5rm", true).maybeSingle();
  if (!exercise) return { ok: false, error: "strength.error.exercise" };

  const { error } = await supabase.from("strength_tests").insert({
    user_id: athleteId,
    exercise_id: exerciseId,
    tested_at: date,
    weight_kg: weight,
    reps,
    rpe,
    five_rm_kg: est.fiveRmKg,
    estimated: est.estimated,
    note: note || null,
    created_by: user.id,
  });
  if (error) return { ok: false, error: "strength.error.save" };

  revalidatePath(`/team/${teamId}/strength`);
  return { ok: true };
}

export async function deleteStrengthTest(teamId: string, testId: string): Promise<{ error?: MessageKey }> {
  if (!UUID.test(teamId) || !UUID.test(testId)) return { error: "strength.error.notAllowed" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "strength.error.auth" };

  const { data: test } = await supabase.from("strength_tests").select("id, user_id").eq("id", testId).maybeSingle();
  if (!test) return { error: "strength.error.notAllowed" };
  if (!(await mayManage(supabase, teamId, user.id, test.user_id))) return { error: "strength.error.notAllowed" };

  const { data, error } = await supabase.from("strength_tests").delete().eq("id", testId).select("id");
  if (error || !data?.length) return { error: "strength.error.save" };

  revalidatePath(`/team/${teamId}/strength`);
  return {};
}
