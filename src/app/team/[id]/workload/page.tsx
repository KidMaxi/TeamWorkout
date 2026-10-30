import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { Hint } from "@/components/Hint";
import { dateLocale, SESSION_TYPE_KEY } from "@/lib/i18n";
import { WorkloadTabs } from "@/components/WorkloadTabs";
import { WorkloadBoard, type BoardAthlete, type BoardSession } from "@/components/WorkloadBoard";
import { WeekRulesForm, type RulesValues } from "@/components/WeekRulesForm";
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
  const { data: me } = await supabase
    .from("team_members").select("role").eq("team_id", id).eq("user_id", user!.id).maybeSingle();
  if (me?.role !== "staff") notFound();

  const today = todayInTeamZone();
  const monday = mondayOf(validYmd(weekParam) ? weekParam : today);
  const days = weekDays(monday);
  const daySet = new Set(days);
  const thisMonday = mondayOf(today);
  // Query a day wider on both sides in UTC (Amsterdam is UTC+1/+2), then filter by Amsterdam calendar day.
  const fromIso = new Date(Date.parse(`${addDays(monday, -1)}T00:00:00Z`)).toISOString();
  const toIso = new Date(Date.parse(`${addDays(monday, 8)}T00:00:00Z`)).toISOString();
  const wellnessFrom = addDays(today, -28);

  const [membersRes, sessionsRes, rulesRes] = await Promise.all([
    supabase.from("team_members").select("user_id, consent_given").eq("team_id", id).eq("role", "athlete"),
    supabase.from("sessions").select("id, type, title, starts_at").eq("team_id", id)
      .gte("starts_at", fromIso).lt("starts_at", toIso).order("starts_at"),
    supabase.from("week_rules").select("user_id, max_trainings, max_gym, max_matches, min_rest_days").eq("team_id", id),
  ]);
  const dbErr = membersRes.error ?? sessionsRes.error ?? rulesRes.error;
  if (dbErr) throw new Error(dbErr.message);

  const members = membersRes.data ?? [];
  const athleteIds = members.map((m) => m.user_id as string);
  const consentIds = members.filter((m) => m.consent_given).map((m) => m.user_id as string);
  const weekSessions = (sessionsRes.data ?? []).filter((s) => daySet.has(localDay(s.starts_at as string)));
  const sessionIds = weekSessions.map((s) => s.id as string);

  const [profilesRes, exclRes, wellnessRes] = await Promise.all([
    athleteIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", athleteIds)
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

  const athletes: BoardAthlete[] = athleteIds.map((uid) => {
    const excluded = excludedBy.get(uid) ?? new Set<string>();
    const override = overrides.get(uid) ?? null;
    const rules = mergeRules(teamDefault, override);
    const counts = countWeek(planned, excluded);
    const locked = !consent.has(uid);
    const readiness = assessReadiness(locked ? [] : checkIns.get(uid) ?? [], today);
    const a = assessWeek(counts, rules, readiness);
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
    };
  }).sort((x, y) => STATUS_ORDER[x.status] - STATUS_ORDER[y.status] || x.name.localeCompare(y.name, dateLocale(locale)));

  const loc = dateLocale(locale);
  const dayFmt = new Intl.DateTimeFormat(loc, { timeZone: TEAM_TIME_ZONE, weekday: "short", day: "numeric", month: "short" });
  const timeFmt = new Intl.DateTimeFormat(loc, { timeZone: TEAM_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  const boardSessions: BoardSession[] = weekSessions.map((s) => {
    const when = new Date(s.starts_at as string);
    const type = s.type as SessionType;
    return {
      id: s.id as string, type,
      title: (s.title as string | null)?.trim() || t(SESSION_TYPE_KEY[type]),
      day: dayFmt.format(when), time: timeFmt.format(when),
    };
  });

  const statusCount = { ok: 0, watch: 0, over: 0, unknown: 0 };
  for (const a of athletes) statusCount[a.status]++;
  const catCount = { training: 0, gym: 0, match: 0 };
  for (const s of planned) catCount[categoryOf(s.type)]++;

  const rangeFmt = new Intl.DateTimeFormat(loc, { timeZone: "UTC", day: "numeric", month: "short" });
  const at = (ymd: string) => new Date(`${ymd}T12:00:00Z`);
  const range = t("workload.week.range", { from: rangeFmt.format(at(monday)), to: rangeFmt.format(at(addDays(monday, 6))) });
  const base = `/team/${id}/workload`;
  const nav = "inline-grid size-11 shrink-0 place-items-center rounded-full text-muted transition-colors hover:text-[var(--foreground)]";

  return (
    <section className="flex flex-col gap-5">
      <WorkloadTabs teamId={id} />
      <Hint id="workload-week" text={t("help.hint.workload")} href="/help#week" linkLabel={t("help.hint.more")} />

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
        </div>

        <div className="card flex flex-col gap-3">
          <h2 className="display text-xl">{t("workload.rules.title")}</h2>
          <p className="text-sm text-muted">{t("workload.rules.intro")}</p>
          <WeekRulesForm teamId={id} userId={null} initial={defaults} />
        </div>

        <WorkloadBoard teamId={id} athletes={athletes} sessions={boardSessions} defaults={defaults} />
      </div>
    </section>
  );
}
