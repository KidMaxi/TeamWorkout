import { createClient } from "@/lib/supabase/server";
import { StaffDashboard } from "@/components/StaffDashboard";
import { AthleteDashboard } from "@/components/AthleteDashboard";
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
    const [overview, trend, missing] = await Promise.all([
      supabase.rpc("team_load_overview", { _team: id }),
      supabase.rpc("team_week_trend", { _team: id, _weeks: 8 }),
      supabase.rpc("team_missing_logs", { _team: id }),
    ]);
    const err = overview.error ?? trend.error ?? missing.error;
    if (err) throw new Error(err.message);
    const missingBy = new Map((missing.data as MissingRow[]).map((m) => [m.user_id, m.missing]));
    const rows: AthleteRow[] = (overview.data as LoadRow[]).map((r) => ({
      ...r,
      missing: missingBy.get(r.user_id) ?? 0,
      level: athleteLevel(r),
    }));
    const { filter } = await searchParams;
    const f: DashboardFilter = (["alerts", "unavailable", "missing"] as const).find((x) => x === filter) ?? "all";
    return <StaffDashboard teamId={id} rows={rows} weeks={trend.data as WeekTrendRow[]} filter={f} />;
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

  const [logsRes, sessionsRes, availRes] = await Promise.all([
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
  ]);
  const dbErr = logsRes.error ?? sessionsRes.error ?? availRes.error;
  if (dbErr) throw new Error(dbErr.message);

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
      return end < now && end >= now - 14 * DAY && !logged.has(s.id);
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

  return (
    <AthleteDashboard
      teamId={id}
      availability={availRes.data ? { status: availRes.data.status as Availability, note: availRes.data.note } : null}
      pending={pending}
      weekly={weekly}
      recentLogs={recentLogs}
      last7Load={last7Load}
      attendedThisWeek={attendedThisWeek}
    />
  );
}
