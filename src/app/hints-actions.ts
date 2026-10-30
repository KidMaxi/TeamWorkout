"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Remember that this user closed a tip (stored on the profile, not in the browser). */
export async function dismissHint(id: string): Promise<{ ok: boolean }> {
  if (typeof id !== "string" || !/^[a-z0-9-]{1,40}$/.test(id)) return { ok: false };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { data } = await supabase.from("profiles").select("dismissed_hints").eq("id", user.id).single();
  const current: string[] = Array.isArray(data?.dismissed_hints) ? data.dismissed_hints : [];
  if (current.includes(id)) return { ok: true };
  const next = [...current, id].slice(-50);
  const { error } = await supabase.from("profiles").update({ dismissed_hints: next }).eq("id", user.id);
  if (error) return { ok: false };
  revalidatePath("/", "layout");
  return { ok: true };
}
