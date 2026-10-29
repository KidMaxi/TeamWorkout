"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MessageKey } from "@/lib/i18n";

export type ProfileResult = { ok: boolean; error?: MessageKey };

const err = (error: MessageKey): ProfileResult => ({ ok: false, error });

export async function updateProfile(_prev: ProfileResult | null, formData: FormData): Promise<ProfileResult> {
  const name = String(formData.get("full_name") ?? "").trim();
  const birthRaw = String(formData.get("birth_date") ?? "").trim();
  const heightRaw = String(formData.get("height_cm") ?? "").trim();
  const weightRaw = String(formData.get("weight_kg") ?? "").trim().replace(",", ".");

  if (name.length > 80) return err("profile.error.name");

  let birth: string | null = null;
  if (birthRaw) {
    const d = new Date(`${birthRaw}T00:00:00Z`);
    const valid =
      /^\d{4}-\d{2}-\d{2}$/.test(birthRaw) &&
      !Number.isNaN(d.getTime()) &&
      d.toISOString().slice(0, 10) === birthRaw &&
      birthRaw <= new Date().toISOString().slice(0, 10) &&
      d.getUTCFullYear() >= 1900;
    if (!valid) return err("profile.error.birthDate");
    birth = birthRaw;
  }

  let height: number | null = null;
  if (heightRaw) {
    height = Number(heightRaw);
    if (!/^\d+$/.test(heightRaw) || height < 100 || height > 250) return err("profile.error.height");
  }

  let weight: number | null = null;
  if (weightRaw) {
    weight = Number(weightRaw);
    if (!/^\d+(\.\d)?$/.test(weightRaw) || weight < 30 || weight > 250) return err("profile.error.weight");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("profile.error.auth");

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: name || null, birth_date: birth, height_cm: height, weight_kg: weight })
    .eq("id", user.id);
  if (error) return err("profile.error.save");

  revalidatePath("/", "layout");
  return { ok: true };
}
