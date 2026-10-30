"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MessageKey } from "@/lib/i18n";
import { TERMS_VERSION } from "@/lib/legal";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createTeam(formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name")).trim();
  const club = String(formData.get("club") ?? "new");
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(club);
  if (club !== "new" && club !== "" && !isUuid) throw new Error("Invalid club");
  const { data, error } = isUuid
    ? await supabase.rpc("create_team_in_club", { _name: name, _club: club })
    : await supabase.rpc("create_team", { _name: name });
  if (error) throw new Error(error.message);
  redirect(`/team/${data}`);
}

export async function joinTeam(formData: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_team", { _code: String(formData.get("code")).trim() });
  if (error) throw new Error(error.message);
  redirect(`/team/${data}`);
}

export async function createSession(teamId: string, formData: FormData) {
  const supabase = await createClient();
  const rpe = formData.get("planned_rpe");
  const type = String(formData.get("type"));

  // A workout is only stored on gym sessions and only if it belongs to this team's club.
  let workoutId: string | null = null;
  const requested = String(formData.get("workout_id") ?? "");
  if (type === "gym" && requested) {
    const { data: team } = await supabase.from("teams").select("club_id").eq("id", teamId).single();
    if (team?.club_id) {
      const { data: w } = await supabase
        .from("workouts").select("id").eq("id", requested).eq("club_id", team.club_id).is("archived_at", null).maybeSingle();
      workoutId = w?.id ?? null;
    }
  }

  const { error } = await supabase.from("sessions").insert({
    team_id: teamId,
    type,
    title: String(formData.get("title") ?? ""),
    starts_at: new Date(String(formData.get("starts_at"))).toISOString(),
    planned_duration_min: Number(formData.get("planned_duration_min")),
    planned_rpe: rpe ? Number(rpe) : null,
    workout_id: workoutId,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/team/${teamId}`, "layout");
}

export async function deleteSession(teamId: string, sessionId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("sessions").delete().eq("id", sessionId);
  if (error) throw new Error(error.message);
  revalidatePath(`/team/${teamId}`, "layout");
}

export async function logSession(teamId: string, sessionId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const attended = formData.get("attended") === "on";
  const { error } = await supabase.from("session_logs").upsert({
    session_id: sessionId,
    user_id: user.id,
    attended,
    duration_min: attended ? Number(formData.get("duration_min")) : null,
    rpe: attended ? Number(formData.get("rpe")) : null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/team/${teamId}`, "layout");
}

export async function createInvite(teamId: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("team_invites").insert({
    team_id: teamId,
    role: String(formData.get("role")),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/team/${teamId}/members`);
}

export async function updateMember(teamId: string, userId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const max = formData.get("max_weekly_load");
  const results = await Promise.all([
    supabase.from("availability").upsert({
      team_id: teamId,
      user_id: userId,
      status: String(formData.get("status")),
      note: String(formData.get("note") ?? "") || null,
      updated_by: user?.id,
      updated_at: new Date().toISOString(),
    }),
    supabase.from("athlete_limits").upsert({
      team_id: teamId,
      user_id: userId,
      max_weekly_load: max ? Number(max) : null,
      updated_at: new Date().toISOString(),
    }),
  ]);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  revalidatePath(`/team/${teamId}`, "layout");
}

/** The signed-in user accepts the current terms and privacy statement. */
export async function acceptTerms() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase
    .from("profiles")
    .update({ terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION })
    .eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function setLocale(locale: string) {
  if (locale !== "nl" && locale !== "en") return;
  (await cookies()).set("tw_locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await supabase.from("profiles").update({ locale }).eq("id", user.id);
  revalidatePath("/", "layout");
}

// ---- Deleting things ----------------------------------------------------

export type DangerResult = { error?: MessageKey };

function dbError(message: string): MessageKey {
  if (message.includes("sole_staff")) return "danger.error.soleStaff";
  if (message.includes("last_staff")) return "danger.error.lastStaff";
  if (message.includes("not allowed")) return "danger.error.notAllowed";
  return "danger.error.generic";
}

const same = (a: FormDataEntryValue | null, b: string) =>
  String(a ?? "").trim().toLowerCase() === b.trim().toLowerCase();

export async function deleteTeam(teamId: string, formData: FormData): Promise<DangerResult> {
  const supabase = await createClient();
  const { data: team } = await supabase.from("teams").select("name").eq("id", teamId).single();
  if (!team) return { error: "danger.error.notAllowed" };
  if (!same(formData.get("confirm"), team.name)) return { error: "danger.error.mismatch" };
  // RLS only lets the owner delete; zero affected rows means not allowed.
  const { data, error } = await supabase.from("teams").delete().eq("id", teamId).select("id");
  if (error) return { error: dbError(error.message) };
  if (!data?.length) return { error: "danger.error.notAllowed" };
  revalidatePath("/", "layout");
  redirect("/");
}

export async function removeMember(teamId: string, userId: string): Promise<DangerResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.rpc("remove_member", { _team: teamId, _user: userId });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/", "layout");
  if (user?.id === userId) redirect("/");
  return {};
}

export async function deleteInvite(teamId: string, code: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("team_invites").delete().eq("code", code).eq("team_id", teamId);
  if (error) throw new Error(error.message);
  revalidatePath(`/team/${teamId}/members`);
}

export async function deleteMyLog(teamId: string, sessionId: string): Promise<DangerResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.from("session_logs").delete().eq("session_id", sessionId).eq("user_id", user.id);
  if (error) return { error: dbError(error.message) };
  revalidatePath(`/team/${teamId}`, "layout");
  return {};
}

export async function deleteAccount(formData: FormData): Promise<DangerResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!same(formData.get("confirm"), user.email ?? "")) return { error: "danger.error.mismatch" };
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: dbError(error.message) };
  await supabase.auth.signOut();
  redirect("/login");
}
