/**
 * Day-level workload: planned vs actual load, stacking and trend warnings, based on the team's own settings.
 * Pure functions. Contract the UI codes against; implemented by the workload v2 task.
 * Nothing here is a medical judgement: it points coaches at things worth a look and explains why.
 */
import type { SessionType } from "./load";

export type SessionStatus = "planned" | "completed" | "adjusted" | "cancelled";
export type DaySession = {
  id: string;
  type: SessionType;
  startsAt: string;
  durationMin: number;
  plannedRpe: number | null;
  status: SessionStatus;
  /** The athlete was taken out of this session (rest). */
  excluded: boolean;
};
export type ActualLog = { sessionId: string; attended: boolean; durationMin: number | null; rpe: number | null; load: number };

export type WorkloadSettings = {
  heavyRpe: number;
  heavyPerDay: number;
  consecutiveHeavyDays: number;
  baselineWeeks: number;
  deviationPct: number;
  showRatio: boolean;
};
export const DEFAULT_SETTINGS: WorkloadSettings = {
  heavyRpe: 7, heavyPerDay: 2, consecutiveHeavyDays: 3, baselineWeeks: 4, deviationPct: 30, showRatio: false,
};

/** Settings from a team_workload_settings row; a missing row (or a missing/invalid column) means the defaults. */
export function settingsFromRow(row: Record<string, unknown> | null | undefined): WorkloadSettings {
  if (!row) return { ...DEFAULT_SETTINGS };
  const num = (v: unknown, d: number) => {
    const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
    return Number.isFinite(n) ? n : d;
  };
  return {
    heavyRpe: num(row.heavy_rpe, DEFAULT_SETTINGS.heavyRpe),
    heavyPerDay: num(row.heavy_per_day, DEFAULT_SETTINGS.heavyPerDay),
    consecutiveHeavyDays: num(row.consecutive_heavy_days, DEFAULT_SETTINGS.consecutiveHeavyDays),
    baselineWeeks: num(row.baseline_weeks, DEFAULT_SETTINGS.baselineWeeks),
    deviationPct: num(row.deviation_pct, DEFAULT_SETTINGS.deviationPct),
    showRatio: row.show_ratio === true,
  };
}

export type DayEntry = { sessionId: string; type: SessionType; planned: number | null; actual: number | null; heavy: boolean; share: number };
export type DayLoad = {
  day: string; // YYYY-MM-DD in Europe/Amsterdam
  planned: number;
  actual: number;
  sessions: number;
  heavySessions: number;
  entries: DayEntry[];
};

export type WarningKind = "stackedHeavyDay" | "consecutiveHeavyDays" | "overlap" | "deviation" | "missingCheckin" | "pain";
export type DayWarning = { kind: WarningKind; day: string | null; detail?: number };

const TIME_ZONE = "Europe/Amsterdam"; // same zone as workload.ts (runtime siblings are not imported so tests run standalone)
const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
/** YYYY-MM-DD of a timestamp in Europe/Amsterdam. */
const localDay = (iso: string): string => {
  const parts = dayFormatter.formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};
const DAY_MS = 86_400_000;
const dayIndex = (ymd: string): number => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
};
const round1 = (n: number): number => Math.round(n * 10) / 10;
const counts = (s: DaySession): boolean => s.status !== "cancelled" && !s.excluded;

/** planned RPE x planned minutes, or null when no planned RPE. Cancelled/excluded sessions count nothing. */
export function plannedLoad(s: DaySession): number | null {
  if (!counts(s)) return null;
  if (s.plannedRpe === null || s.plannedRpe === undefined || !(s.plannedRpe > 0)) return null;
  return s.plannedRpe * s.durationMin;
}

/**
 * One entry per day of `days` (YYYY-MM-DD): planned and actual load, heavy session count, per-session share of the day.
 * Planned and actual stay separate. Several sessions on one day stay separate entries and are summed per day.
 * A session is heavy when the logged RPE (when the athlete attended and logged one) or else the planned RPE reaches settings.heavyRpe.
 * A session the athlete did not attend is never heavy and has no actual load.
 */
export function buildDays(days: string[], sessions: DaySession[], logs: ActualLog[], settings: WorkloadSettings): DayLoad[] {
  const logOf = new Map<string, ActualLog>();
  for (const l of logs) if (!logOf.has(l.sessionId)) logOf.set(l.sessionId, l);
  const byDay = new Map<string, DaySession[]>();
  for (const s of sessions) {
    if (!counts(s)) continue;
    const d = localDay(s.startsAt);
    byDay.set(d, [...(byDay.get(d) ?? []), s]);
  }
  return days.map((day) => {
    const list = (byDay.get(day) ?? []).slice().sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    const entries: DayEntry[] = list.map((s) => {
      const log = logOf.get(s.id);
      const attended = log ? log.attended : null;
      const actual = log && log.attended ? log.load : null;
      const rpe = log && log.attended && log.rpe !== null ? log.rpe : s.plannedRpe;
      const heavy = attended !== false && rpe !== null && rpe !== undefined && rpe >= settings.heavyRpe;
      return { sessionId: s.id, type: s.type, planned: plannedLoad(s), actual, heavy, share: 0 };
    });
    const planned = entries.reduce((a, e) => a + (e.planned ?? 0), 0);
    const actual = entries.reduce((a, e) => a + (e.actual ?? 0), 0);
    const total = actual > 0 ? actual : planned;
    for (const e of entries) {
      const v = actual > 0 ? e.actual ?? 0 : e.planned ?? 0;
      e.share = total > 0 ? round1(v / total * 100) / 100 : 0;
    }
    return { day, planned, actual, sessions: entries.length, heavySessions: entries.filter((e) => e.heavy).length, entries };
  });
}

/**
 * Warnings with the numbers that explain them. Decision support, not a verdict.
 * detail: stackedHeavyDay = heavy sessions that day; consecutiveHeavyDays = length of the run (day = first day of the run);
 * overlap = start of the later session as epoch milliseconds (day = its local day); deviation = rounded % vs own average.
 * `ctx.previousWeeks` is newest first.
 */
export function dayWarnings(
  days: DayLoad[],
  sessions: DaySession[],
  settings: WorkloadSettings,
  ctx: { weeklyActual: number; previousWeeks: number[]; missingCheckin: boolean; pain: boolean },
): DayWarning[] {
  const out: DayWarning[] = [];

  for (const d of days) {
    if (d.heavySessions >= settings.heavyPerDay) out.push({ kind: "stackedHeavyDay", day: d.day, detail: d.heavySessions });
  }

  let run: DayLoad[] = [];
  const flush = () => {
    if (run.length >= settings.consecutiveHeavyDays) out.push({ kind: "consecutiveHeavyDays", day: run[0].day, detail: run.length });
    run = [];
  };
  for (const d of days) {
    const heavy = d.heavySessions >= 1;
    if (heavy && run.length && dayIndex(d.day) !== dayIndex(run[run.length - 1].day) + 1) flush();
    if (heavy) run.push(d);
    else flush();
  }
  flush();

  const daySet = new Set(days.map((d) => d.day));
  const live = sessions
    .filter((s) => counts(s) && daySet.has(localDay(s.startsAt)))
    .map((s) => ({ start: Date.parse(s.startsAt), end: Date.parse(s.startsAt) + s.durationMin * 60_000 }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const seen = new Set<number>();
  let maxEnd = -Infinity;
  for (const s of live) {
    if (s.start < maxEnd && !seen.has(s.start)) {
      seen.add(s.start);
      out.push({ kind: "overlap", day: localDay(new Date(s.start).toISOString()), detail: s.start });
    }
    maxEnd = Math.max(maxEnd, s.end);
  }

  if (ctx.weeklyActual > 0) {
    const dev = baselineDeviation(ctx.weeklyActual, ctx.previousWeeks, settings);
    if (dev.flagged && dev.deviationPct !== null) out.push({ kind: "deviation", day: null, detail: Math.round(dev.deviationPct) });
  }
  if (ctx.missingCheckin) out.push({ kind: "missingCheckin", day: null });
  if (ctx.pain) out.push({ kind: "pain", day: null });
  return out;
}

/**
 * This week's load against the mean of the athlete's own previous weeks (newest first; the newest
 * settings.baselineWeeks are used, weeks without load are ignored, at least 2 are needed).
 */
export function baselineDeviation(
  thisWeek: number, previousWeeks: number[], settings: WorkloadSettings,
): { baseline: number | null; deviationPct: number | null; flagged: boolean } {
  const used = previousWeeks.slice(0, Math.max(0, settings.baselineWeeks)).filter((w) => Number.isFinite(w) && w > 0);
  if (used.length < 2) return { baseline: null, deviationPct: null, flagged: false };
  const baseline = used.reduce((a, b) => a + b, 0) / used.length;
  const deviationPct = round1((thisWeek - baseline) / baseline * 100);
  return { baseline: round1(baseline), deviationPct, flagged: Math.abs(deviationPct) >= settings.deviationPct };
}

export function planVsActual(days: DayLoad[]): { planned: number; actual: number; diffPct: number | null } {
  const planned = days.reduce((a, d) => a + d.planned, 0);
  const actual = days.reduce((a, d) => a + d.actual, 0);
  return { planned, actual, diffPct: planned > 0 ? round1((actual - planned) / planned * 100) : null };
}

/** The sessions that contribute most to the given days' actual (or planned when nothing is logged) load, largest first. */
export function topContributors(days: DayLoad[], n: number): DayEntry[] {
  const all = days.flatMap((d) => d.entries);
  const useActual = all.some((e) => (e.actual ?? 0) > 0);
  const value = (e: DayEntry) => (useActual ? e.actual ?? 0 : e.planned ?? 0);
  return all
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => value(e) > 0)
    .sort((a, b) => value(b.e) - value(a.e) || a.i - b.i)
    .slice(0, Math.max(0, n))
    .map(({ e }) => e);
}
