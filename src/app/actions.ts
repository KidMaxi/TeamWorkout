"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createTeam(formData: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_team", { _name: String(formData.get("name")).trim() });
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
  const { error } = await supabase.from("sessions").insert({
    team_id: teamId,
    type: String(formData.get("type")),
    title: String(formData.get("title") ?? ""),
    starts_at: new Date(String(formData.get("starts_at"))).toISOString(),
    planned_duration_min: Number(formData.get("planned_duration_min")),
    planned_rpe: rpe ? Number(rpe) : null,
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
    supabase.from("team_members").update({
      consent_given: formData.get("consent") === "on",
      consent_at: formData.get("consent") === "on" ? new Date().toISOString() : null,
    }).eq("team_id", teamId).eq("user_id", userId),
  ]);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  revalidatePath(`/team/${teamId}`, "layout");
}
