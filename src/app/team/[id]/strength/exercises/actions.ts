"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n";
import { EQUIPMENT, EXERCISE_KINDS, MUSCLES, type Muscle } from "@/lib/exercises";
import { STARTER_EXERCISES } from "@/lib/exercise-seed";

export type ExerciseResult = { ok: boolean; error?: MessageKey };
export type SeedResult = { added: number; error?: MessageKey };

const NOT_ALLOWED: MessageKey = "exercises.error.notAllowed";
const GENERIC: MessageKey = "exercises.error.generic";
const WEIGHT_KINDS = ["weight_reps", "weighted_bodyweight"];

/** Re-derive club and role from the team; never trust anything the client sends. */
async function staffContext(teamId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: team }, { data: me }] = await Promise.all([
    supabase.from("teams").select("club_id").eq("id", teamId).single(),
    supabase.from("team_members").select("role").eq("team_id", teamId).eq("user_id", user.id).single(),
  ]);
  if (!team?.club_id || me?.role !== "staff") return null;
  return { supabase, userId: user.id, clubId: team.club_id as string };
}

type Parsed =
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; error: MessageKey };

function parse(formData: FormData): Parsed {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1 || name.length > 80) return { ok: false, error: "exercises.error.name" };
  const instructions = String(formData.get("instructions") ?? "").trim();
  if (instructions.length < 1 || instructions.length > 4000) return { ok: false, error: "exercises.error.instructions" };

  const equipment = String(formData.get("equipment") ?? "");
  if (!(EQUIPMENT as readonly string[]).includes(equipment)) return { ok: false, error: "exercises.error.equipment" };

  const primaryRaw = String(formData.get("primary_muscle") ?? "");
  const primary = primaryRaw === "" ? null : primaryRaw;
  if (primary !== null && !(MUSCLES as readonly string[]).includes(primary)) return { ok: false, error: "exercises.error.muscle" };

  const othersRaw = formData.getAll("other_muscles").map(String);
  if (!othersRaw.every((m) => (MUSCLES as readonly string[]).includes(m))) return { ok: false, error: "exercises.error.muscle" };
  const others = [...new Set(othersRaw)].filter((m) => m !== primary) as Muscle[];

  const kind = String(formData.get("kind") ?? "");
  if (!(EXERCISE_KINDS as readonly string[]).includes(kind)) return { ok: false, error: "exercises.error.kind" };

  const mediaKind = String(formData.get("media_kind") ?? "none");
  if (!["none", "image", "video"].includes(mediaKind)) return { ok: false, error: "exercises.error.media" };
  let mediaUrl: string | null = null;
  if (mediaKind !== "none") {
    const raw = String(formData.get("media_url") ?? "").trim();
    try {
      const u = new URL(raw);
      if (u.protocol !== "https:" || raw.length > 2000) throw new Error("bad");
      mediaUrl = u.toString();
    } catch {
      return { ok: false, error: "exercises.error.media" };
    }
  }

  return {
    ok: true,
    row: {
      name,
      instructions,
      equipment,
      primary_muscle: primary,
      other_muscles: others,
      kind,
      per_side: formData.get("per_side") === "on",
      track_pr: formData.get("track_pr") === "on",
      track_5rm: formData.get("track_5rm") === "on" && WEIGHT_KINDS.includes(kind),
      media_kind: mediaKind,
      media_url: mediaUrl,
    },
  };
}

function failure(error: { code?: string } | null): ExerciseResult {
  return { ok: false, error: error?.code === "23505" ? "exercises.error.duplicate" : GENERIC };
}

const path = (teamId: string) => `/team/${teamId}/strength/exercises`;

export async function createExercise(teamId: string, formData: FormData): Promise<ExerciseResult> {
  const ctx = await staffContext(teamId);
  if (!ctx) return { ok: false, error: NOT_ALLOWED };
  const parsed = parse(formData);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.supabase.from("exercises").insert({ ...parsed.row, club_id: ctx.clubId, created_by: ctx.userId });
  if (error) return failure(error);
  revalidatePath(path(teamId));
  return { ok: true };
}

export async function updateExercise(teamId: string, exerciseId: string, formData: FormData): Promise<ExerciseResult> {
  const ctx = await staffContext(teamId);
  if (!ctx) return { ok: false, error: NOT_ALLOWED };
  const parsed = parse(formData);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.supabase
    .from("exercises").update(parsed.row)
    .eq("id", exerciseId).eq("club_id", ctx.clubId).is("archived_at", null).select("id");
  if (error) return failure(error);
  if (!data?.length) return { ok: false, error: NOT_ALLOWED };
  revalidatePath(path(teamId));
  return { ok: true };
}

export async function archiveExercise(teamId: string, exerciseId: string): Promise<{ error?: MessageKey }> {
  const ctx = await staffContext(teamId);
  if (!ctx) return { error: NOT_ALLOWED };
  const { data, error } = await ctx.supabase
    .from("exercises").update({ archived_at: new Date().toISOString() })
    .eq("id", exerciseId).eq("club_id", ctx.clubId).is("archived_at", null).select("id");
  if (error) return { error: GENERIC };
  if (!data?.length) return { error: NOT_ALLOWED };
  revalidatePath(path(teamId));
  return {};
}

export async function seedStarterExercises(teamId: string): Promise<SeedResult> {
  const ctx = await staffContext(teamId);
  if (!ctx) return { added: 0, error: NOT_ALLOWED };
  const locale = await getLocale();

  const { data: existing, error: readError } = await ctx.supabase
    .from("exercises").select("name").eq("club_id", ctx.clubId).is("archived_at", null);
  if (readError) return { added: 0, error: GENERIC };
  const seen = new Set((existing ?? []).map((e) => String(e.name).trim().toLowerCase()));

  const rows = [];
  for (const s of STARTER_EXERCISES) {
    const name = s.name[locale];
    const key = name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      club_id: ctx.clubId,
      created_by: ctx.userId,
      name,
      instructions: s.instructions[locale],
      equipment: s.equipment,
      primary_muscle: s.primary_muscle,
      other_muscles: s.other_muscles.filter((m) => m !== s.primary_muscle),
      kind: s.kind,
      per_side: s.per_side,
      track_pr: s.track_pr,
      track_5rm: s.track_5rm,
      media_kind: "none",
      media_url: null,
    });
  }
  if (!rows.length) return { added: 0 };

  let added = 0;
  const bulk = await ctx.supabase.from("exercises").insert(rows);
  if (!bulk.error) {
    added = rows.length;
  } else if (bulk.error.code === "23505") {
    // A concurrent insert won the race for some name: retry row by row and skip duplicates.
    for (const row of rows) {
      const one = await ctx.supabase.from("exercises").insert(row);
      if (!one.error) added++;
      else if (one.error.code !== "23505") return { added, error: GENERIC };
    }
  } else {
    return { added: 0, error: GENERIC };
  }
  revalidatePath(path(teamId));
  return { added };
}
