import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TERMS_VERSION } from "@/lib/legal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function host(endpoint: unknown): string | null {
  try {
    return new URL(String(endpoint)).host;
  } catch {
    return null;
  }
}

/** Right of access / portability: everything about the signed-in user, RLS-scoped. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });

  const uid = user.id;
  const [profile, memberships, availability, limits, logs, wellness, strength, subs, exclusions, weekRules, runs] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    supabase
      .from("team_members")
      .select("team_id, role, joined_at, consent_given, consent_at, consent_by, consent_note, teams(name)")
      .eq("user_id", uid),
    supabase.from("availability").select("*").eq("user_id", uid),
    supabase.from("athlete_limits").select("*").eq("user_id", uid),
    supabase.from("session_logs").select("*, sessions(type, title, starts_at)").eq("user_id", uid),
    supabase.from("wellness_checks").select("*").eq("user_id", uid),
    supabase.from("strength_tests").select("*, exercises(name)").eq("user_id", uid),
    supabase.from("push_subscriptions").select("created_at, user_agent, endpoint").eq("user_id", uid),
    supabase.from("session_exclusions").select("*").eq("user_id", uid),
    supabase.from("week_rules").select("*").eq("user_id", uid),
    supabase.from("workout_runs").select("*").eq("user_id", uid),
  ]);

  const failed = [profile, memberships, availability, limits, logs, wellness, strength, subs, exclusions, weekRules, runs].find((r) => r.error);
  if (failed?.error) {
    return NextResponse.json({ error: "export_failed" }, { status: 500, headers: NO_STORE });
  }

  // Sets of the user's own runs, fetched in chunks to keep the request URL short.
  const runRows = runs.data ?? [];
  const setRows: Record<string, unknown>[] = [];
  for (let i = 0; i < runRows.length; i += 100) {
    const ids = runRows.slice(i, i + 100).map((r) => r.id as string);
    const { data, error } = await supabase.from("run_sets").select("*").in("run_id", ids);
    if (error) return NextResponse.json({ error: "export_failed" }, { status: 500, headers: NO_STORE });
    setRows.push(...((data ?? []) as Record<string, unknown>[]));
  }
  const setsByRun = new Map<string, Record<string, unknown>[]>();
  for (const st of setRows) {
    const k = st.run_id as string;
    setsByRun.set(k, [...(setsByRun.get(k) ?? []), st]);
  }

  const now = new Date();
  const body = {
    exportedAt: now.toISOString(),
    termsVersion: TERMS_VERSION,
    account: { id: uid, email: user.email ?? null, createdAt: user.created_at ?? null },
    profile: profile.data ?? null,
    teamMemberships: (memberships.data ?? []).map((m) => {
      const { teams, ...rest } = m;
      return { ...rest, teamName: (teams as unknown as { name?: string } | null)?.name ?? null };
    }),
    availability: availability.data ?? [],
    athleteLimits: limits.data ?? [],
    sessionLogs: (logs.data ?? []).map(({ sessions, ...l }) => ({ ...l, session: sessions ?? null })),
    wellnessChecks: wellness.data ?? [],
    sessionExclusions: exclusions.data ?? [],
    weekRules: weekRules.data ?? [],
    workoutRuns: runRows.map((r) => ({ ...r, sets: setsByRun.get(r.id as string) ?? [] })),
    strengthTests: (strength.data ?? []).map(({ exercises, ...s }) => ({
      ...s,
      exerciseName: (exercises as { name?: string } | null)?.name ?? null,
    })),
    pushSubscriptions: (subs.data ?? []).map((s) => ({
      createdAt: s.created_at ?? null,
      userAgent: s.user_agent ?? null,
      endpointHost: host(s.endpoint),
    })),
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="teamworkout-export-${now.toISOString().slice(0, 10)}.json"`,
      ...NO_STORE,
    },
  });
}
