"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MessageKey } from "@/lib/i18n";
import type { DangerResult } from "@/app/actions";

export type ConsentResult = { ok: boolean; error?: MessageKey };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOTE_MAX = 200;

function mapError(message: string): MessageKey {
  if (message.includes("birth_date_required")) return "consent.error.birthDateRequired";
  if (message.includes("parent_consent_required")) return "consent.error.parentRequired";
  if (message.includes("athlete_must_consent_themselves")) return "consent.error.mustConsentThemselves";
  if (message.includes("note_required")) return "consent.error.noteRequired";
  if (message.includes("not allowed")) return "consent.error.notAllowed";
  return "consent.error.generic";
}

function refresh(teamId: string) {
  revalidatePath("/profile");
  revalidatePath(`/team/${teamId}`, "layout");
}

/** The signed-in athlete gives or withdraws their own consent for one team. */
export async function setMyConsent(teamId: string, given: boolean): Promise<ConsentResult> {
  if (!UUID.test(teamId)) return { ok: false, error: "consent.error.notAllowed" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "consent.error.auth" };
  const { error } = await supabase.rpc("set_my_consent", { _team: teamId, _given: !!given });
  if (error) return { ok: false, error: mapError(error.message) };
  refresh(teamId);
  return { ok: true };
}

/** Staff records or withdraws parental consent for an athlete under 16. */
export async function recordParentConsent(
  teamId: string,
  userId: string,
  given: boolean,
  note: string,
): Promise<ConsentResult> {
  if (!UUID.test(teamId) || !UUID.test(userId)) return { ok: false, error: "consent.error.notAllowed" };
  const clean = String(note ?? "").trim();
  if (clean.length > NOTE_MAX) return { ok: false, error: "consent.error.noteTooLong" };
  if (given && !clean) return { ok: false, error: "consent.error.noteRequired" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "consent.error.auth" };
  const { error } = await supabase.rpc("record_parent_consent", {
    _team: teamId,
    _user: userId,
    _given: !!given,
    _note: given ? clean : "",
  });
  if (error) return { ok: false, error: mapError(error.message) };
  refresh(teamId);
  return { ok: true };
}

/** Form wrapper for useActionState: records parental consent from the note input. */
export async function giveParentConsent(
  teamId: string,
  userId: string,
  _prev: ConsentResult | null,
  formData: FormData,
): Promise<ConsentResult> {
  return recordParentConsent(teamId, userId, true, String(formData.get("note") ?? ""));
}

/** Form wrapper for ConfirmButton: withdraws parental consent. */
export async function withdrawParentConsent(
  teamId: string,
  userId: string,
): Promise<DangerResult> {
  const r = await recordParentConsent(teamId, userId, false, "");
  return r.ok ? {} : { error: r.error };
}
