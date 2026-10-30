"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MessageKey } from "@/lib/i18n";

export type PinResult = { ok: boolean; error?: MessageKey };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PIN = /^\d{4,6}$/;

function mapError(message: string): MessageKey {
  if (message.includes("invalid_pin")) return "pins.error.invalid";
  if (message.includes("not allowed")) return "pins.error.notAllowed";
  return "pins.error.generic";
}

function refresh(teamId?: string | null) {
  revalidatePath("/profile");
  if (teamId && UUID.test(teamId)) revalidatePath(`/team/${teamId}/settings`);
}

/** Staff of the team turn the "PIN required on the iPad" rule on or off. */
export async function setKioskPinRequired(teamId: string, required: boolean): Promise<PinResult> {
  if (!UUID.test(teamId)) return { ok: false, error: "pins.error.notAllowed" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "pins.error.auth" };
  const { data: me } = await supabase
    .from("team_members").select("role").eq("team_id", teamId).eq("user_id", user.id).maybeSingle();
  if (me?.role !== "staff") return { ok: false, error: "pins.error.notAllowed" };
  const { data, error } = await supabase
    .from("teams").update({ kiosk_pin_required: !!required }).eq("id", teamId).select("id");
  if (error) return { ok: false, error: mapError(error.message) };
  if (!data?.length) return { ok: false, error: "pins.error.notAllowed" };
  refresh(teamId);
  return { ok: true };
}

/** Set or change a PIN. userId null = the signed-in user. The database checks who may do it. */
export async function setPin(userId: string | null, pin: string, teamId?: string): Promise<PinResult> {
  if (userId !== null && !UUID.test(userId)) return { ok: false, error: "pins.error.notAllowed" };
  if (typeof pin !== "string" || !PIN.test(pin)) return { ok: false, error: "pins.error.invalid" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "pins.error.auth" };
  const { error } = await supabase.rpc("set_athlete_pin", { _user: userId ?? user.id, _pin: pin });
  if (error) return { ok: false, error: mapError(error.message) };
  refresh(teamId);
  return { ok: true };
}

/** Remove a PIN. userId null = the signed-in user. */
export async function clearPin(userId: string | null, teamId?: string): Promise<PinResult> {
  if (userId !== null && !UUID.test(userId)) return { ok: false, error: "pins.error.notAllowed" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "pins.error.auth" };
  const { error } = await supabase.rpc("clear_athlete_pin", { _user: userId ?? user.id });
  if (error) return { ok: false, error: mapError(error.message) };
  refresh(teamId);
  return { ok: true };
}
