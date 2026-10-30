"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MessageKey } from "@/lib/i18n";
import { WELLNESS_ITEMS, todayInTeamZone } from "@/lib/wellness";

const PAIN_LOCATION_MAX = 60;

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

  const painRaw = String(formData.get("pain") ?? "");
  if (painRaw !== "yes" && painRaw !== "no") return { ok: false, error: "wellness.error.pain" };
  const pain = painRaw === "yes";
  // Control characters become spaces; empty -> null; only kept when pain is reported.
  const where = String(formData.get("painLocation") ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (where.length > PAIN_LOCATION_MAX) return { ok: false, error: "wellness.error.painWhere" };
  const painLocation = pain && where ? where : null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "wellness.error.auth" };

  const { error } = await supabase
    .from("wellness_checks")
    .upsert({ user_id: user.id, day: todayInTeamZone(), ...values, pain, pain_location: painLocation }, { onConflict: "user_id,day" });
  if (error) return { ok: false, error: "wellness.error.save" };

  revalidatePath(`/team/${teamId}`, "layout");
  return { ok: true };
}
