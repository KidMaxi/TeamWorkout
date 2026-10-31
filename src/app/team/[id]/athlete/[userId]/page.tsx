import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AthleteDetail } from "@/components/AthleteDetail";
import { athleteLevel, type Availability, type LoadRow, type SessionType } from "@/lib/load";
import { wellnessAverage, type WellnessEntry } from "@/lib/wellness";
import { baselineDeviation, settingsFromRow } from "@/lib/workload-day";

const DAY = 86_400_000;
const WEEKS = 12;

export default async function AthleteDetailPage({ params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id, userId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("team_members").select("role").eq("team_id", id).eq("user_id", user!.id).single();
  if (me?.role !== "staff") notFound();

  const now = Date.now();
  const startOfWeek = (t: number) => {
    const d = new Date(t);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - ((d.getUTCDay() + 6) % 7) * DAY;
  };
  const thisWeekStart = startOfWeek(now);
  const firstWeekStart = thisWeekStart - (WEEKS - 1) * 7 * DAY;
  const fromDay = new Date(now - 14 * DAY).toISOString().slice(0, 10);

  const { data: member } = await supabase
    .from("team_members").select("role, consent_given").eq("team_id", id).eq("user_id", userId).maybeSingle();
  if (!member || member.role !== "athlete") notFound();

  const [settingsRes, profileRes, availRes, limitRes, logsRes, sessionsRes, wellnessRes, exclRes] = await Promise.all([
    supabase.from("team_workload_settings").select("*").eq("team_id", id).maybeSingle(),
    supabase.from("profiles").select("full_name, birth_date, height_cm, weight_kg").eq("id", userId).maybeSingle(),
    supabase.from("availability").select("status, note").eq("team_id", id).eq("user_id", userId).maybeSingle(),
    supabase.from("athlete_limits").select("max_weekly_load").eq("team_id", id).eq("user_id", userId).maybeSingle(),
    supabase
      .from("session_logs")
      .select("session_id, attended, duration_min, rpe, load, sessions!inner(title, type, starts_at, team_id)")
      .eq("user_id", userId)
      .eq("sessions.team_id", id)
      .neq("sessions.status", "cancelled")
      .gte("sessions.starts_at", new Date(firstWeekStart).toISOString()),
    supabase
      .from("sessions")
      .select("id, starts_at, planned_duration_min")
      .eq("team_id", id)
      .neq("status", "cancelled")
      .gte("starts_at", new Date(now - 15 * DAY).toISOString())
      .lte("starts_at", new Date(now).toISOString()),
    member.consent_given
      ? supabase.from("wellness_checks").select("day, sleep, soreness, fatigue, stress, mood, pain, pain_location")
          .eq("user_id", userId).gte("day", fromDay).order("day", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    // Sessions the coach took this athlete out of (rest): no RPE is owed for them.
    supabase.from("session_exclusions").select("session_id").eq("user_id", userId),
  ]);
  const dbErr = settingsRes.error ?? profileRes.error ?? availRes.error ?? limitRes.error ?? logsRes.error ?? sessionsRes.error ?? wellnessRes.error ?? exclRes.error;
  if (dbErr) throw new Error(dbErr.message);

  type Joined = { title: string | null; type: SessionType; starts_at: string };
  const logs = (logsRes.data ?? []).map((l) => {
    const s = l.sessions as unknown as Joined;
    return {
      session_id: l.session_id as string, attended: l.attended as boolean,
      duration_min: l.duration_min as number, rpe: l.rpe as number, load: (l.load as number) ?? 0,
      starts_at: s.starts_at, type: s.type, title: s.title ?? "",
    };
  });

  // Same definitions as team_load_overview: acute = 7x24h sum, chronic = 28-day sum / 4,
  // ratio only with a first attended log at least 28 days old and chronic > 0.
  let acute = 0;
  let sum28 = 0;
  let firstAttended = Infinity;
  const weekly = Array.from({ length: WEEKS }, (_, i) => ({
    week_start: new Date(firstWeekStart + i * 7 * DAY).toISOString().slice(0, 10),
    total_load: 0,
  }));
  for (const l of logs) {
    const t = new Date(l.starts_at).getTime();
    if (t > now - 7 * DAY && t <= now) acute += l.load;
    if (t > now - 28 * DAY && t <= now) sum28 += l.load;
    if (l.attended && t < firstAttended) firstAttended = t;
    const idx = Math.floor((startOfWeek(t) - firstWeekStart) / (7 * DAY));
    if (idx >= 0 && idx < WEEKS) weekly[idx].total_load += l.load;
  }
  const chronic = sum28 / 4;
  const hasBaseline = firstAttended <= now - 28 * DAY;
  const acwr = hasBaseline && chronic > 0 ? acute / chronic : null;

  const settings = settingsFromRow(settingsRes.data as Record<string, unknown> | null);
  // This week against the athlete's own previous weeks (newest first). A running week only flags a rise.
  const weeklyLoads = weekly.map((w) => w.total_load);
  const dev = baselineDeviation(weeklyLoads[weeklyLoads.length - 1], weeklyLoads.slice(0, -1).reverse(), settings);
  const deviation = { pct: dev.deviationPct, baseline: dev.baseline, flagged: dev.flagged && (dev.deviationPct ?? 0) > 0 };

  const status = (availRes.data?.status ?? "available") as Availability;
  const maxLoad = limitRes.data?.max_weekly_load ?? null;
  const loadRow: LoadRow = {
    user_id: userId,
    full_name: profileRes.data?.full_name ?? "",
    availability: status,
    availability_note: availRes.data?.note ?? null,
    acute_load: acute,
    chronic_weekly_avg: chronic,
    acwr,
    max_weekly_load: maxLoad,
    over_limit: maxLoad !== null && acute > maxLoad,
    has_baseline: hasBaseline,
  };

  const logged = new Set(logs.map((l) => l.session_id));
  const excluded = new Set((exclRes.data ?? []).map((x) => x.session_id as string));
  const missing = (sessionsRes.data ?? []).filter((s) => {
    const end = new Date(s.starts_at).getTime() + s.planned_duration_min * 60_000;
    return end < now && end >= now - 14 * DAY && !logged.has(s.id) && !excluded.has(s.id);
  }).length;

  const recent = [...logs]
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
    .slice(0, 15)
    .map((l) => ({
      starts_at: l.starts_at, type: l.type, title: l.title,
      attended: l.attended, duration_min: l.duration_min, rpe: l.rpe, load: l.load,
    }));

  const wellness: (WellnessEntry & { avg: number })[] = (wellnessRes.data ?? []).map((w) => {
    const e: WellnessEntry = {
      day: w.day, sleep: w.sleep, soreness: w.soreness, fatigue: w.fatigue, stress: w.stress, mood: w.mood,
      pain: !!w.pain, painLocation: w.pain ? (w.pain_location ?? null) : null,
    };
    return { ...e, avg: wellnessAverage(e) };
  });

  const bd = profileRes.data?.birth_date ? new Date(profileRes.data.birth_date) : null;
  const age = bd && !isNaN(bd.getTime()) ? Math.floor((now - bd.getTime()) / (365.25 * DAY)) : null;

  return (
    <AthleteDetail
      teamId={id}
      name={profileRes.data?.full_name ?? ""}
      age={age}
      heightCm={profileRes.data?.height_cm ?? null}
      weightKg={profileRes.data?.weight_kg ?? null}
      consent={member.consent_given}
      availability={{ status, note: availRes.data?.note ?? null }}
      row={loadRow}
      level={
        settings.showRatio ? athleteLevel(loadRow)
        : status === "unavailable" ? "out"
        : loadRow.over_limit ? "high"
        : deviation.flagged ? "watch"
        : deviation.pct === null ? "none" : "ok"
      }
      showRatio={settings.showRatio}
      deviation={deviation}
      weekly={weekly}
      recent={recent}
      missing={missing}
      wellness={wellness}
    />
  );
}
