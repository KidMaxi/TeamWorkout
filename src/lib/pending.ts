import type { SupabaseClient } from "@supabase/supabase-js";
import { todayInTeamZone } from "@/lib/wellness";

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 14;

/**
 * Open items for an athlete in a team: finished sessions of the last 14 days (not cancelled) without a log or
 * exclusion, plus 1 when today's daily check-in is missing. RLS-scoped client; any error yields 0.
 */
export async function getPendingCount(supabase: SupabaseClient, teamId: string, userId: string): Promise<number> {
  try {
    const now = Date.now();
    const from = new Date(now - (WINDOW_DAYS + 1) * DAY_MS).toISOString();
    const [sessionsRes, logsRes, exclRes, wellnessRes] = await Promise.all([
      supabase
        .from("sessions")
        .select("id, starts_at, planned_duration_min")
        .eq("team_id", teamId)
        .neq("status", "cancelled")
        .gte("starts_at", from)
        .lte("starts_at", new Date(now).toISOString())
        .limit(200),
      supabase
        .from("session_logs")
        .select("session_id, sessions!inner(team_id, starts_at)")
        .eq("user_id", userId)
        .eq("sessions.team_id", teamId)
        .gte("sessions.starts_at", from)
        .limit(500),
      supabase
        .from("session_exclusions")
        .select("session_id, sessions!inner(team_id, starts_at)")
        .eq("user_id", userId)
        .eq("sessions.team_id", teamId)
        .gte("sessions.starts_at", from)
        .limit(500),
      supabase.from("wellness_checks").select("day").eq("user_id", userId).eq("day", todayInTeamZone()).maybeSingle(),
    ]);
    if (sessionsRes.error || logsRes.error || exclRes.error || wellnessRes.error) return 0;

    const done = new Set<string>([
      ...(logsRes.data ?? []).map((r) => r.session_id as string),
      ...(exclRes.data ?? []).map((r) => r.session_id as string),
    ]);
    const cutoff = now - WINDOW_DAYS * DAY_MS;
    let pending = 0;
    for (const s of sessionsRes.data ?? []) {
      const start = Date.parse(s.starts_at as string);
      const end = start + ((s.planned_duration_min as number | null) ?? 0) * 60_000;
      if (end < now && end >= cutoff && !done.has(s.id as string)) pending++;
    }
    if (!wellnessRes.data) pending++;
    return pending;
  } catch {
    return 0;
  }
}
