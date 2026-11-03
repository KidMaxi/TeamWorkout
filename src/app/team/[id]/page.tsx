import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getMembership } from "@/lib/auth-cache";
import { StaffDashboard } from "@/components/StaffDashboard";
import { AthleteDashboard } from "@/components/AthleteDashboard";
import { WorkloadTabs } from "@/components/WorkloadTabs";
import { countWeek, localDay, mondayOf, weekDays } from "@/lib/workload";
import { baselineDeviation, settingsFromRow } from "@/lib/workload-day";
import { todayInTeamZone, type WellnessEntry } from "@/lib/wellness";
import {
  athleteLevel,
  type Availability, type AthleteRow, type DashboardFilter, type LoadRow, type MissingRow, type SessionType, type WeekTrendRow,
} from "@/lib/load";

export default async function TeamOverview({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthUser();
  const me = await getMembership(id, user!.id);

  if (me?.role === "staff") {
    const day = todayInTeamZone();
    // Everything except the weekly logs (which need the baseline length from the settings) goes out at once.
    const [settingsRes, overview, trend, missing, wellnessRes, membersRes] = await Promise.all([
      supabase.from("team_workload_settings").select("*").eq("team_id", id).maybeSingle(),
      supabase.rpc("team_load_overview", { _team: id }),
      supabase.rpc("team_week_trend", { _team: id, _weeks: 8 }),
      supabase.rpc("team_missing_logs", { _team: id }),
      // RLS only returns rows of athletes who gave consent.
      supabase
        .from("wellness_checks")
        .select("user_id, day, sleep, soreness, fatigue, stress, mood, pain, pain_location")
        .eq("day", day),
      supabase.from("team_members").select("user_id, consent_given").eq("team_id", id).eq("role", "athlete"),
    ]);
    if (settingsRes.error) throw new Error(settingsRes.error.message);
    const settings = settingsFromRow(settingsRes.data as Record<string, unknown> | null);
    const thisMonday = mondayOf(day);
    const weekMs = 7 * 86_400_000;
    const logsFrom = new Date(Date.parse(`${thisMonday}T00:00:00Z`) - (settings.baselineWeeks * 7 + 1) * 86_400_000).toISOString();
    // Weekly totals per athlete for the comparison with their own recent weeks (cancelled sessions count nothing).
    const logsRes = await supabase.from("session_logs")
      .select("user_id, attended, load, sessions!inner(starts_at, status, team_id)")
      .eq("sessions.team_id", id).neq("sessions.status", "cancelled").gte("sessions.starts_at", logsFrom).limit(5000);
    const err = overview.error ?? trend.error ?? missing.error;
    if (err) throw new Error(err.message);
    // Own-average comparison: this Monday-Sunday week against the athlete's previous weeks (newest first).
    const weekly = new Map<string, number[]>();
    for (const l of logsRes.data ?? []) {
      if (!l.attended) continue;
      const startsAt = (l.sessions as unknown as { starts_at: string }).starts_at;
      const off = Math.round((Date.parse(`${thisMonday}T12:00:00Z`) - Date.parse(`${mondayOf(localDay(startsAt))}T12:00:00Z`)) / weekMs);
      if (off < 0 || off > settings.baselineWeeks) continue;
      const arr = weekly.get(l.user_id as string) ?? Array.from({ length: settings.baselineWeeks + 1 }, () => 0);
      arr[off] += Number(l.load ?? 0);
      weekly.set(l.user_id as string, arr);
    }
    const deviation: Record<string, { pct: number | null; flagged: boolean }> = {};
    for (const r of overview.data as LoadRow[]) {
      const w = weekly.get(r.user_id) ?? [];
      const d = baselineDeviation(w[0] ?? 0, w.slice(1), settings);
      // The running week is only part-way: a rise is meaningful at any time, a drop only once the week is done.
      deviation[r.user_id] = { pct: d.deviationPct, flagged: d.flagged && (d.deviationPct ?? 0) > 0 };
    }
    const missingBy = new Map((missing.data as MissingRow[]).map((m) => [m.user_id, m.missing]));
    const rows: AthleteRow[] = (overview.data as LoadRow[]).map((r) => ({
      ...r,
      missing: missingBy.get(r.user_id) ?? 0,
      // The fixed ratio bands only apply when the head coach switched the ratio on; otherwise the own-average comparison drives 'watch'.
      level: settings.showRatio
        ? athleteLevel(r)
        : r.availability === "unavailable" ? "out"
        : r.over_limit ? "high"
        : deviation[r.user_id]?.flagged ? "watch"
        : deviation[r.user_id]?.pct == null ? "none" : "ok",
    }));
    // Wellness is optional extra data: a failure here must not take the dashboard down.
    const consent: Record<string, boolean> = {};
    for (const m of membersRes.data ?? []) consent[m.user_id as string] = !!m.consent_given;
    const wellness: Record<string, WellnessEntry | null> = {};
    for (const r of rows) wellness[r.user_id] = null;
    for (const w of wellnessRes.data ?? []) {
      if (consent[w.user_id as string]) {
        wellness[w.user_id as string] = {
          day: w.day, sleep: w.sleep, soreness: w.soreness, fatigue: w.fatigue, stress: w.stress, mood: w.mood,
          pain: !!w.pain, painLocation: w.pain ? (w.pain_location ?? null) : null,
        };
      }
    }
    const { filter } = await searchParams;
    const f: DashboardFilter = (["alerts", "unavailable", "missing"] as const).find((x) => x === filter) ?? "all";
    return (
      <>
        <WorkloadTabs teamId={id} />
        <StaffDashboard
          teamId={id} rows={rows} weeks={trend.data as WeekTrendRow[]} filter={f} wellness={wellness} consent={consent}
          showRatio={settings.showRatio} deviation={deviation}
        />
      </>
    );
  }

  const DAY = 86400_000;
  const now = Date.now();
  const startOfWeek = (t: number) => {
    const d = new Date(t);
    const mondayOffset = (d.getUTCDay() + 6) % 7;
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - mondayOffset * DAY;
  };
  const thisWeekStart = startOfWeek(now);
  const firstWeekStart = thisWeekStart - 5 * 7 * DAY;

  const today = todayInTeamZone();
  const weekYmd = weekDays(today);
  const weekFrom = weekYmd.length ? new Date(Date.parse(`${weekYmd[0]}T00:00:00Z`) - DAY).toISOString() : null;
  const weekTo = weekYmd.length ? new Date(Date.parse(`${weekYmd[weekYmd.length - 1]}T00:00:00Z`) + 2 * DAY).toISOString() : null;
  // Sessions the coach took this athlete out of (own rows only, enforced by RLS and the user filter). Selected through the
  // session's time window (a superset of the two lists above) so it runs together with them, not after them.
  const exclFrom = new Date(Math.min(now - 15 * DAY, weekFrom ? Date.parse(weekFrom) : Infinity)).toISOString();
  const exclTo = new Date(Math.max(now, weekTo ? Date.parse(weekTo) : 0)).toISOString();
  const [logsRes, sessionsRes, availRes, wellnessRes, weekRes, exclRes] = await Promise.all([
    supabase
      .from("session_logs")
      .select("session_id, load, rpe, duration_min, attended, sessions!inner(title, type, starts_at, team_id)")
      .eq("user_id", user!.id)
      .eq("sessions.team_id", id)
      .neq("sessions.status", "cancelled")
      .gte("sessions.starts_at", new Date(firstWeekStart).toISOString()),
    supabase
      .from("sessions")
      .select("id, title, type, starts_at, planned_duration_min, planned_rpe")
      .eq("team_id", id)
      .neq("status", "cancelled")
      .gte("starts_at", new Date(now - 15 * DAY).toISOString())
      .lte("starts_at", new Date(now).toISOString()),
    supabase
      .from("availability").select("status, note").eq("team_id", id).eq("user_id", user!.id).maybeSingle(),
    supabase
      .from("wellness_checks")
      .select("day, sleep, soreness, fatigue, stress, mood, pain, pain_location")
      .eq("user_id", user!.id)
      .gte("day", new Date(Date.parse(`${today}T00:00:00Z`) - 6 * DAY).toISOString().slice(0, 10))
      .order("day", { ascending: false }),
    // Team sessions around the current Monday-Sunday week (trimmed to the exact week in Europe/Amsterdam below).
    weekFrom && weekTo
      ? supabase.from("sessions").select("id, title, type, starts_at").eq("team_id", id).neq("status", "cancelled").gte("starts_at", weekFrom).lte("starts_at", weekTo).order("starts_at")
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("session_exclusions")
      .select("session_id, sessions!inner(team_id, starts_at)")
      .eq("user_id", user!.id).eq("sessions.team_id", id).gte("sessions.starts_at", exclFrom).lte("sessions.starts_at", exclTo),
  ]);
  const dbErr = logsRes.error ?? sessionsRes.error ?? availRes.error ?? weekRes.error ?? exclRes.error;
  if (dbErr) throw new Error(dbErr.message);

  const weekSet = new Set(weekYmd);
  const weekSessions = (weekRes.data ?? []).filter((s) => weekSet.has(localDay(s.starts_at as string)));

  const excluded = new Set((exclRes.data ?? []).map((x) => x.session_id as string));

  type Joined = { title: string; type: SessionType; starts_at: string };
  const logs = (logsRes.data ?? []).map((l) => {
    const s = l.sessions as unknown as Joined;
    return { session_id: l.session_id as string, attended: l.attended, duration_min: l.duration_min, rpe: l.rpe, load: l.load, ...s };
  });

  // Six Monday-based UTC weeks, oldest first; the last bucket is the current week.
  const weekly = Array.from({ length: 6 }, (_, i) => ({
    week_start: new Date(firstWeekStart + i * 7 * DAY).toISOString().slice(0, 10),
    total_load: 0,
  }));
  let attendedThisWeek = 0;
  let last7Load = 0;
  for (const l of logs) {
    const t = new Date(l.starts_at).getTime();
    const idx = Math.floor((startOfWeek(t) - firstWeekStart) / (7 * DAY));
    if (idx >= 0 && idx < 6) weekly[idx].total_load += l.load;
    if (t >= thisWeekStart && t <= now && l.attended) attendedThisWeek++;
    if (t >= now - 7 * DAY && t <= now) last7Load += l.load;
  }

  const logged = new Set(logs.map((l) => l.session_id));
  const pending = (sessionsRes.data ?? [])
    .filter((s) => {
      const end = new Date(s.starts_at).getTime() + s.planned_duration_min * 60_000;
      return end < now && end >= now - 14 * DAY && !logged.has(s.id) && !excluded.has(s.id);
    })
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
    .map((s) => ({
      id: s.id, type: s.type as SessionType, title: s.title ?? "", starts_at: s.starts_at,
      plannedDurationMin: s.planned_duration_min as number, plannedRpe: (s.planned_rpe as number | null) ?? null,
    }));

  const recentLogs = [...logs]
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
    .slice(0, 8)
    .map((l) => ({
      starts_at: l.starts_at, type: l.type, title: l.title ?? "",
      attended: l.attended, duration_min: l.duration_min, rpe: l.rpe, load: l.load,
    }));

  const recentWellness: WellnessEntry[] = (wellnessRes.data ?? []).map((w) => ({
    day: w.day, sleep: w.sleep, soreness: w.soreness, fatigue: w.fatigue, stress: w.stress, mood: w.mood,
    pain: !!w.pain, painLocation: w.pain ? (w.pain_location ?? null) : null,
  }));

  const planned = weekSessions.map((s) => ({ id: s.id as string, type: s.type as SessionType, startsAt: s.starts_at as string }));
  const counts = countWeek(planned, excluded);
  const week = {
    sessions: weekSessions.map((s) => ({
      id: s.id as string, type: s.type as SessionType, title: (s.title as string | null) ?? "",
      starts_at: s.starts_at as string, excluded: excluded.has(s.id as string),
    })),
    counts: { training: counts.training, gym: counts.gym, match: counts.match, restDays: counts.restDays },
  };

  return (
    <AthleteDashboard
      teamId={id}
      availability={availRes.data ? { status: availRes.data.status as Availability, note: availRes.data.note } : null}
      pending={pending}
      weekly={weekly}
      recentLogs={recentLogs}
      last7Load={last7Load}
      attendedThisWeek={attendedThisWeek}
      week={week}
      wellness={{ today: recentWellness.find((w) => w.day === today) ?? null, recent: recentWellness }}
    />
  );
}
