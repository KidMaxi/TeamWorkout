import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { Hint } from "@/components/Hint";
import { dateLocale, SESSION_TYPE_KEY } from "@/lib/i18n";
import { WorkloadTabs } from "@/components/WorkloadTabs";
import { WorkloadBoard, type BoardAthlete, type BoardSession, type BoardNote, type BoardWarning } from "@/components/WorkloadBoard";
import { WeekRulesForm, WorkloadSettingsForm, type RulesValues } from "@/components/WeekRulesForm";
import { can, getStaffKind } from "@/lib/roles";
import {
  baselineDeviation, buildDays, dayWarnings, planVsActual, settingsFromRow, topContributors,
  type ActualLog, type DaySession, type SessionStatus,
} from "@/lib/workload-day";
import type { SessionType } from "@/lib/load";
import { todayInTeamZone, TEAM_TIME_ZONE } from "@/lib/wellness";
import {
  assessReadiness, assessWeek, categoryOf, countWeek, localDay, mergeRules, mondayOf, weekDays,
  type CheckIn, type PlannedSession, type WeekRules, type WeekStatus,
} from "@/lib/workload";

const DAY_MS = 86_400_000;
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Pure calendar arithmetic on YYYY-MM-DD (UTC noon avoids any DST edge). */
function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12) + n * DAY_MS).toISOString().slice(0, 10);
}
function validYmd(v: string | undefined): v is string {
  const m = v ? YMD.exec(v) : null;
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

type RuleRow = {
  user_id: string | null;
  max_trainings: number | null; max_gym: number | null; max_matches: number | null; min_rest_days: number | null;
};
const toRules = (r: RuleRow | null | undefined): WeekRules | null =>
  r ? { maxTrainings: r.max_trainings, maxGym: r.max_gym, maxMatches: r.max_matches, minRestDays: r.min_rest_days } : null;

const STATUS_ORDER: Record<WeekStatus, number> = { over: 0, watch: 1, unknown: 2, ok: 3 };
const SEGMENTS = [
  { key: "ok", color: "var(--ok)", label: "workload.summary.ok" },
  { key: "watch", color: "var(--warn)", label: "workload.summary.watch" },
  { key: "over", color: "var(--danger)", label: "workload.summary.over" },
  { key: "unknown", color: "var(--muted)", label: "workload.summary.unknown" },
] as const;

export default async function WorkloadPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { id } = await params;
  const { week: weekParam } = await searchParams;
  const { t, locale } = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const kind = await getStaffKind(supabase, id, user!.id);
  if (!kind) notFound();
  const canRules = can(kind, "planRules");
  const canNotes = can(kind, "writeNotes");
  const canManage = can(kind, "manageTeam");

  const today = todayInTeamZone();
  const monday = mondayOf(validYmd(weekParam) ? weekParam : today);
  const days = weekDays(monday);
  const daySet = new Set(days);
  const thisMonday = mondayOf(today);
  // Query a day wider on both sides in UTC (Amsterdam is UTC+1/+2), then filter by Amsterdam calendar day.
  const fromIso = new Date(Date.parse(`${addDays(monday, -1)}T00:00:00Z`)).toISOString();
  const toIso = new Date(Date.parse(`${addDays(monday, 8)}T00:00:00Z`)).toISOString();
  const wellnessFrom = addDays(today, -28);

  const settingsRes = await supabase.from("team_workload_settings").select("*").eq("team_id", id).maybeSingle();
  if (settingsRes.error) throw new Error(settingsRes.error.message);
  const settings = settingsFromRow(settingsRes.data as Record<string, unknown> | null);
  const logsFromIso = new Date(Date.parse(`${addDays(monday, -7 * settings.baselineWeeks - 1)}T00:00:00Z`)).toISOString();

  const [membersRes, sessionsRes, rulesRes, notesRes, logsRes] = await Promise.all([
    supabase.from("team_members").select("user_id, consent_given").eq("team_id", id).eq("role", "athlete"),
    // Cancelled sessions count nothing and are not listed.
    supabase.from("sessions").select("id, type, title, starts_at, planned_duration_min, planned_rpe, status").eq("team_id", id)
      .neq("status", "cancelled").gte("starts_at", fromIso).lt("starts_at", toIso).order("starts_at"),
    supabase.from("week_rules").select("user_id, max_trainings, max_gym, max_matches, min_rest_days").eq("team_id", id),
    supabase.from("workload_notes").select("id, user_id, session_id, day, reason, note, created_by, created_at")
      .eq("team_id", id).order("created_at", { ascending: false }).limit(300),
    // Actual load: this week plus the weeks before it (for the athlete's own average).
    supabase.from("session_logs")
      .select("user_id, session_id, attended, duration_min, rpe, load, sessions!inner(starts_at, status, team_id)")
      .eq("sessions.team_id", id).neq("sessions.status", "cancelled")
      .gte("sessions.starts_at", logsFromIso).lt("sessions.starts_at", toIso).limit(5000),
  ]);
  const dbErr = membersRes.error ?? sessionsRes.error ?? rulesRes.error ?? notesRes.error ?? logsRes.error;
  if (dbErr) throw new Error(dbErr.message);

  const members = membersRes.data ?? [];
  const athleteIds = members.map((m) => m.user_id as string);
  const consentIds = members.filter((m) => m.consent_given).map((m) => m.user_id as string);
  const weekSessions = (sessionsRes.data ?? []).filter((s) => daySet.has(localDay(s.starts_at as string)));
  const sessionIds = weekSessions.map((s) => s.id as string);

  const noteRows = notesRes.data ?? [];
  const profileIds = [...new Set([...athleteIds, ...noteRows.map((n) => n.created_by as string | null).filter((x): x is string => !!x)])];
  const [profilesRes, exclRes, wellnessRes] = await Promise.all([
    profileIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    sessionIds.length && athleteIds.length
      ? supabase.from("session_exclusions").select("session_id, user_id").in("session_id", sessionIds)
      : Promise.resolve({ data: [], error: null }),
    consentIds.length
      ? supabase.from("wellness_checks")
          .select("user_id, day, sleep, soreness, fatigue, stress, mood, pain, pain_location")
          .in("user_id", consentIds).gte("day", wellnessFrom).order("day", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  const dbErr2 = profilesRes.error ?? exclRes.error ?? wellnessRes.error;
  if (dbErr2) throw new Error(dbErr2.message);

  const names = new Map((profilesRes.data ?? []).map((p) => [p.id as string, (p.full_name as string) || ""]));
  const consent = new Set(consentIds);
  const excludedBy = new Map<string, Set<string>>();
  for (const e of exclRes.data ?? []) {
    const set = excludedBy.get(e.user_id as string) ?? new Set<string>();
    set.add(e.session_id as string);
    excludedBy.set(e.user_id as string, set);
  }
  const checkIns = new Map<string, CheckIn[]>();
  for (const w of wellnessRes.data ?? []) {
    const list = checkIns.get(w.user_id as string) ?? [];
    list.push({
      day: w.day as string, sleep: w.sleep, soreness: w.soreness, fatigue: w.fatigue, stress: w.stress, mood: w.mood,
      pain: !!w.pain, painLocation: (w.pain_location as string | null) ?? null,
    });
    checkIns.set(w.user_id as string, list);
  }

  const ruleRows = (rulesRes.data ?? []) as RuleRow[];
  const defaultRow = ruleRows.find((r) => r.user_id === null);
  const teamDefault = toRules(defaultRow);
  const overrides = new Map(ruleRows.filter((r) => r.user_id !== null).map((r) => [r.user_id as string, toRules(r)!]));
  const defaults: RulesValues = teamDefault ?? { maxTrainings: null, maxGym: null, maxMatches: null, minRestDays: null };

  const planned: PlannedSession[] = weekSessions.map((s) => ({
    id: s.id as string, type: s.type as SessionType, startsAt: s.starts_at as string,
  }));

  const loc = dateLocale(locale);
  const dayFmt = new Intl.DateTimeFormat(loc, { timeZone: TEAM_TIME_ZONE, weekday: "short", day: "numeric", month: "short" });
  const wdFmt = new Intl.DateTimeFormat(loc, { timeZone: "UTC", weekday: "short" });
  const timeFmt = new Intl.DateTimeFormat(loc, { timeZone: TEAM_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  const at = (ymd: string) => new Date(`${ymd}T12:00:00Z`);
  const dayLabel = (ymd: string) => dayFmt.format(at(ymd));
  const currentWeek = monday === thisMonday;
  const weekOver = addDays(monday, 6) < today;
  const sessionMeta = new Map(weekSessions.map((s) => [s.id as string, {
    title: (s.title as string | null)?.trim() || t(SESSION_TYPE_KEY[s.type as SessionType]),
    day: localDay(s.starts_at as string),
  }]));

  // Actual logs per athlete: this week's logs (per session) and the weekly totals of the weeks before.
  const weekOffset = (startsAt: string) => {
    const m = mondayOf(localDay(startsAt));
    return Math.round((Date.parse(`${monday}T12:00:00Z`) - Date.parse(`${m}T12:00:00Z`)) / (7 * DAY_MS));
  };
  const weekLogs = new Map<string, ActualLog[]>();
  const previous = new Map<string, number[]>();
  for (const l of logsRes.data ?? []) {
    const st = (l.sessions as unknown as { starts_at: string }).starts_at;
    const uid = l.user_id as string;
    const off = weekOffset(st);
    if (off === 0) {
      weekLogs.set(uid, [...(weekLogs.get(uid) ?? []), {
        sessionId: l.session_id as string, attended: !!l.attended, durationMin: (l.duration_min as number | null) ?? null,
        rpe: (l.rpe as number | null) ?? null, load: Number(l.load ?? 0),
      }]);
    } else if (off >= 1 && off <= settings.baselineWeeks) {
      const arr = previous.get(uid) ?? Array.from({ length: settings.baselineWeeks }, () => 0);
      if (l.attended) arr[off - 1] += Number(l.load ?? 0);
      previous.set(uid, arr);
    }
  }

  const notesBy = new Map<string, BoardNote[]>();
  for (const n of noteRows) {
    const uid = n.user_id as string | null;
    if (!uid) continue;
    const list = notesBy.get(uid) ?? [];
    if (list.length >= 6) continue;
    const sid = n.session_id as string | null;
    list.push({
      id: n.id as string, reason: n.reason as BoardNote["reason"], note: n.note as string,
      day: dayLabel(n.day as string),
      author: names.get(n.created_by as string) || "",
      mine: n.created_by === user!.id,
      session: sid ? sessionMeta.get(sid)?.title ?? null : null,
    });
    notesBy.set(uid, list);
  }

  const teamPlanned = days.map(() => 0);
  const athletes: BoardAthlete[] = athleteIds.map((uid) => {
    const excluded = excludedBy.get(uid) ?? new Set<string>();
    const override = overrides.get(uid) ?? null;
    const rules = mergeRules(teamDefault, override);
    const counts = countWeek(planned, excluded);
    const locked = !consent.has(uid);
    const myCheckIns = locked ? [] : checkIns.get(uid) ?? [];
    const readiness = assessReadiness(myCheckIns, today);
    const a = assessWeek(counts, rules, readiness);

    const daySessions: DaySession[] = weekSessions.map((s) => ({
      id: s.id as string, type: s.type as SessionType, startsAt: s.starts_at as string,
      durationMin: Number(s.planned_duration_min ?? 0),
      plannedRpe: s.planned_rpe === null || s.planned_rpe === undefined ? null : Number(s.planned_rpe),
      status: (s.status as SessionStatus) ?? "planned",
      excluded: excluded.has(s.id as string),
    }));
    const dayLoads = buildDays(days, daySessions, weekLogs.get(uid) ?? [], settings);
    const totals = planVsActual(dayLoads);
    const prevWeeks = previous.get(uid) ?? [];
    const dev = baselineDeviation(totals.actual, prevWeeks, settings);
    const weeksUsed = prevWeeks.slice(0, settings.baselineWeeks).filter((w) => w > 0).length;
    const missingCheckin = currentWeek && !locked && !myCheckIns.some((e) => e.day === today);
    const pain = currentWeek && readiness.reasons.includes("pain");
    const warnings: BoardWarning[] = dayWarnings(dayLoads, daySessions, settings, {
      weeklyActual: totals.actual, previousWeeks: prevWeeks, missingCheckin, pain,
    })
      // A part-way week compared with whole weeks always looks low: only show a rise until the week is over.
      .filter((w) => !(w.kind === "deviation" && (w.detail ?? 0) < 0 && !weekOver))
      .map((w) => ({
        kind: w.kind,
        day: w.day ? dayLabel(w.day) : null,
        time: w.kind === "overlap" && w.detail ? timeFmt.format(new Date(w.detail)) : null,
        n: w.kind === "deviation" ? Math.abs(w.detail ?? 0) : w.detail ?? 0,
        up: (w.detail ?? 0) >= 0,
        weeks: weeksUsed,
      }));
    const warnKinds = new Map<string, Set<string>>();
    for (const w of dayWarnings(dayLoads, daySessions, settings, { weeklyActual: 0, previousWeeks: [], missingCheckin: false, pain: false })) {
      if (!w.day) continue;
      const set = warnKinds.get(w.day) ?? new Set<string>();
      set.add(w.kind);
      warnKinds.set(w.day, set);
    }
    dayLoads.forEach((d, i) => { teamPlanned[i] += d.planned; });

    return {
      id: uid,
      name: names.get(uid) || t("dashboard.athlete.unnamed"),
      status: a.status,
      total: counts.total,
      checks: a.checks,
      level: readiness.level,
      reasons: readiness.reasons,
      average: readiness.average,
      baseline: readiness.baseline,
      painLocation: readiness.painLocation,
      pain: readiness.reasons.includes("pain"),
      locked,
      advice: a.advice,
      excluded: [...excluded],
      override,
      days: dayLoads.map((d) => ({
        ymd: d.day, weekday: wdFmt.format(at(d.day)), num: Number(d.day.slice(8)), label: dayLabel(d.day),
        planned: d.planned, actual: d.actual, sessions: d.sessions, heavy: d.heavySessions,
        flags: [...(warnKinds.get(d.day) ?? [])] as BoardAthlete["days"][number]["flags"],
      })),
      totals: { planned: totals.planned, actual: totals.actual, diffPct: totals.diffPct },
      ownAverage: dev.baseline,
      ownAverageWeeks: weeksUsed,
      top: topContributors(dayLoads, 3).map((e) => ({
        sessionId: e.sessionId, type: e.type,
        title: sessionMeta.get(e.sessionId)?.title ?? "",
        day: dayLabel(sessionMeta.get(e.sessionId)?.day ?? days[0]),
        value: totals.actual > 0 ? e.actual ?? 0 : e.planned ?? 0,
        kind: totals.actual > 0 ? "actual" as const : "planned" as const,
      })),
      warnings,
      notes: notesBy.get(uid) ?? [],
    };
  }).sort((x, y) => STATUS_ORDER[x.status] - STATUS_ORDER[y.status] || x.name.localeCompare(y.name, dateLocale(locale)));

  const timeOf = (iso: string) => timeFmt.format(new Date(iso));
  const boardSessions: BoardSession[] = weekSessions.map((s) => {
    const when = new Date(s.starts_at as string);
    const type = s.type as SessionType;
    return {
      id: s.id as string, type,
      title: (s.title as string | null)?.trim() || t(SESSION_TYPE_KEY[type]),
      day: dayFmt.format(when), time: timeOf(s.starts_at as string), ymd: localDay(s.starts_at as string),
    };
  });
  const busiestIdx = teamPlanned.reduce((best, v, i) => (v > teamPlanned[best] ? i : best), 0);
  const busiest = teamPlanned[busiestIdx] > 0 ? { label: dayLabel(days[busiestIdx]), load: teamPlanned[busiestIdx] } : null;

  const statusCount = { ok: 0, watch: 0, over: 0, unknown: 0 };
  for (const a of athletes) statusCount[a.status]++;
  const catCount = { training: 0, gym: 0, match: 0 };
  for (const s of planned) catCount[categoryOf(s.type)]++;

  const rangeFmt = new Intl.DateTimeFormat(loc, { timeZone: "UTC", day: "numeric", month: "short" });
  const range = t("workload.week.range", { from: rangeFmt.format(at(monday)), to: rangeFmt.format(at(addDays(monday, 6))) });
  const base = `/team/${id}/workload`;
  const nav = "inline-grid size-11 shrink-0 place-items-center rounded-full text-muted transition-colors hover:text-[var(--foreground)]";

  return (
    <section className="flex flex-col gap-5">
      <WorkloadTabs teamId={id} />
      <Hint id="workload-week" text={t("workload.hint")} href="/help#week" linkLabel={t("help.hint.more")} />

      <nav aria-label={t("workload.week.nav")} className="flex items-center justify-between gap-2">
        <Link href={`${base}?week=${addDays(monday, -7)}`} aria-label={t("workload.week.prev")} title={t("workload.week.prev")} className={nav}>
          <ChevronLeft size={20} aria-hidden />
        </Link>
        <div className="flex min-w-0 flex-col items-center text-center">
          <span className="font-semibold">{range}</span>
          {monday === thisMonday ? (
            <span className="text-xs text-muted">{t("workload.week.this")}</span>
          ) : (
            <Link href={base} className="link inline-flex min-h-11 items-center text-xs">{t("workload.week.this")}</Link>
          )}
        </div>
        <Link href={`${base}?week=${addDays(monday, 7)}`} aria-label={t("workload.week.next")} title={t("workload.week.next")} className={nav}>
          <ChevronRight size={20} aria-hidden />
        </Link>
      </nav>

      <div className="stagger flex flex-col gap-5">
        <div className="card card-hero flex flex-col gap-4">
          <p className="eyebrow">{t("workload.summary.title")}</p>
          {athletes.length > 0 && (
            <div
              role="img"
              aria-label={t("workload.summary.aria", statusCount)}
              className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
              style={{ background: "var(--surface-3)" }}
            >
              {SEGMENTS.filter((s) => statusCount[s.key] > 0).map((s) => (
                <span key={s.key} style={{ flex: statusCount[s.key], background: s.color }} />
              ))}
            </div>
          )}
          <div className="grid grid-cols-4 gap-2">
            {SEGMENTS.map((s) => (
              <div key={s.key} className="flex flex-col items-center gap-1 rounded-2xl border border-[var(--line)] bg-[var(--surface-2)]/60 px-1 py-3 text-center">
                <p className="num text-2xl" style={{ color: statusCount[s.key] && s.key !== "unknown" ? s.color : undefined }}>{statusCount[s.key]}</p>
                <p className="text-[11px] leading-tight text-muted">{t(s.label)}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted">{t("workload.summary.sessions")}</p>
            {planned.length ? (
              <div className="flex flex-wrap gap-1.5">
                {(["training", "gym", "match"] as const).map((c) => (
                  <span key={c} className="chip">{t(`workload.cat.${c}`)} <span className="num text-[var(--foreground)]">{catCount[c]}</span></span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">{t("workload.summary.noSessions")}</p>
            )}
          </div>
          <p className="text-sm text-muted">
            {busiest
              ? t("workload.summary.busiest", { day: busiest.label, load: busiest.load })
              : t("workload.summary.busiestNone")}
          </p>
          <p className="text-xs text-muted">{t("workload.summary.plannedNote")}</p>
        </div>

        {canRules && (
          <div className="card flex flex-col gap-3">
            <h2 className="display text-xl">{t("workload.rules.title")}</h2>
            <p className="text-sm text-muted">{t("workload.rules.intro")}</p>
            <WeekRulesForm teamId={id} userId={null} initial={defaults} />
          </div>
        )}

        {canManage && <WorkloadSettingsForm teamId={id} settings={settings} />}

        <WorkloadBoard
          teamId={id} athletes={athletes} sessions={boardSessions} defaults={defaults} settings={settings}
          canRules={canRules} canNotes={canNotes} isHead={kind === "head"} today={today}
        />
      </div>
    </section>
  );
}
