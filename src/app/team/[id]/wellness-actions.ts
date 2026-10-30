"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MessageKey } from "@/lib/i18n";
import { WELLNESS_ITEMS, todayInTeamZone } from "@/lib/wellness";

export type WellnessResult = { ok: boolean; error?: MessageKey };

/** Saves (or overwrites) the signed-in athlete's check-in for today in the team's time zone. */
export async function saveWellness(teamId: string, formData: FormData): Promise<WellnessResult> {
  const values: Record<string, number> = {};
  for (const k of WELLNESS_ITEMS) {
    const raw = String(formData.get(k) ?? "");
    const n = Number(raw);
    if (!/^[1-5]$/.test(raw) || !Number.isInteger(n)) return { ok: false, error: "wellness.error.invalid" };
    values[k] = n;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "wellness.error.auth" };

  const { error } = await supabase
    .from("wellness_checks")
    .upsert({ user_id: user.id, day: todayInTeamZone(), ...values }, { onConflict: "user_id,day" });
  if (error) return { ok: false, error: "wellness.error.save" };

  revalidatePath(`/team/${teamId}`, "layout");
  return { ok: true };
}
