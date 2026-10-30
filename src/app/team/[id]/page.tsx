import { createClient } from "@/lib/supabase/server";
import { StaffDashboard } from "@/components/StaffDashboard";
import { AthleteDashboard } from "@/components/AthleteDashboard";
import { WorkloadTabs } from "@/components/WorkloadTabs";
import { countWeek, localDay, weekDays } from "@/lib/workload";
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
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("team_members").select("role").eq("team_id", id).eq("user_id", user!.id).single();

  if (me?.role === "staff") {
    const day = todayInTeamZone();
    const [overview, trend, missing, wellnessRes, membersRes] = await Promise.all([
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
    const err = overview.error ?? trend.error ?? missing.error;
    if (err) throw new Error(err.message);
    const missingBy = new Map((missing.data as MissingRow[]).map((m) => [m.user_id, m.missing]));
    const rows: AthleteRow[] = (overview.data as LoadRow[]).map((r) => ({
      ...r,
      missing: missingBy.get(r.user_id) ?? 0,
      level: athleteLevel(r),
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
        <StaffDashboard teamId={id} rows={rows} weeks={trend.data as WeekTrendRow[]} filter={f} wellness={wellness} consent={consent} />
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
  const [logsRes, sessionsRes, availRes, wellnessRes, weekRes] = await Promise.all([
    supabase
      .from("session_logs")
      .select("session_id, load, rpe, duration_min, attended, sessions!inner(title, type, starts_at, team_id)")
      .eq("user_id", user!.id)
      .eq("sessions.team_id", id)
      .gte("sessions.starts_at", new Date(firstWeekStart).toISOString()),
    supabase
      .from("sessions")
      .select("id, title, type, starts_at, planned_duration_min")
      .eq("team_id", id)
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
      ? supabase.from("sessions").select("id, title, type, starts_at").eq("team_id", id).gte("starts_at", weekFrom).lte("starts_at", weekTo).order("starts_at")
      : Promise.resolve({ data: [], error: null }),
  ]);
  const dbErr = logsRes.error ?? sessionsRes.error ?? availRes.error ?? weekRes.error;
  if (dbErr) throw new Error(dbErr.message);

  const weekSet = new Set(weekYmd);
  const weekSessions = (weekRes.data ?? []).filter((s) => weekSet.has(localDay(s.starts_at as string)));

  // Sessions the coach took this athlete out of (own rows only, enforced by RLS and the user filter).
  const exclIds = [...new Set([...(sessionsRes.data ?? []).map((s) => s.id as string), ...weekSessions.map((s) => s.id as string)])];
  const exclRes = exclIds.length
    ? await supabase.from("session_exclusions").select("session_id").eq("user_id", user!.id).in("session_id", exclIds)
    : { data: [], error: null };
  if (exclRes.error) throw new Error(exclRes.error.message);
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
    .map((s) => ({ id: s.id, type: s.type as SessionType, title: s.title ?? "", starts_at: s.starts_at }));

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
