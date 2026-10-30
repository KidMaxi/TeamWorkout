/**
 * Weekly workload rules (coach-defined) + readiness advice (from the daily check-in).
 * Pure functions. The coach decides; this only counts, compares and explains.
 * Implemented by the workload-engine task: the signatures below are the contract the UI codes against.
 */
import type { SessionType } from "./load";
import type { WellnessEntry } from "./wellness";

const TIME_ZONE = "Europe/Amsterdam"; // same as TEAM_TIME_ZONE in wellness.ts (runtime values are not imported so tests run standalone)

export type SessionCategory = "training" | "gym" | "match";
/** academy, evening and other count as 'training'; gym and match are their own categories. */
export const categoryOf = (t: SessionType): SessionCategory => (t === "gym" ? "gym" : t === "match" ? "match" : "training");

/** NULL = no limit. */
export type WeekRules = { maxTrainings: number | null; maxGym: number | null; maxMatches: number | null; minRestDays: number | null };
export const NO_RULES: WeekRules = { maxTrainings: null, maxGym: null, maxMatches: null, minRestDays: null };

export type PlannedSession = { id: string; type: SessionType; startsAt: string };
/** restDays = days of the Monday-Sunday week (Europe/Amsterdam) without any counted session. */
export type WeekCounts = { training: number; gym: number; match: number; total: number; restDays: number };

export type RuleKey = "maxTrainings" | "maxGym" | "maxMatches" | "minRestDays";
/** state: 'ok' below the limit, 'at' exactly at it, 'over' beyond it. For minRestDays 'over' means fewer rest days than required. */
export type RuleCheck = { key: RuleKey; limit: number; actual: number; state: "ok" | "at" | "over" };

export type CheckIn = WellnessEntry & { pain?: boolean; painLocation?: string | null };
export type ReadinessLevel = "good" | "reduced" | "low" | "unknown";
export type ReadinessReason =
  | "pain" | "sleepLow" | "energyLow" | "sorenessHigh" | "stressHigh" | "moodLow" | "belowBaseline" | "declining" | "noRecentData";
export type Readiness = {
  level: ReadinessLevel;
  reasons: ReadinessReason[];
  /** Average of the most recent check-in (1-5), null if none. */
  average: number | null;
  /** The athlete's own mean over the previous days (needs >= 5 check-ins), else null. */
  baseline: number | null;
  painLocation: string | null;
};

export type WeekStatus = "ok" | "watch" | "over" | "unknown";
export type WeekAdvice = "none" | "reduceOne" | "considerRest";
export type WeekAssessment = { status: WeekStatus; checks: RuleCheck[]; readiness: Readiness; advice: WeekAdvice };

/** Athlete override fields that are non-null replace the team default. */
export function mergeRules(teamDefault: WeekRules | null, athlete: Partial<WeekRules> | null): WeekRules {
  const out: WeekRules = { ...(teamDefault ?? NO_RULES) };
  if (athlete) {
    for (const k of ["maxTrainings", "maxGym", "maxMatches", "minRestDays"] as const) {
      const v = athlete[k];
      if (v !== null && v !== undefined) out[k] = v;
    }
  }
  return out;
}

const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
/** YYYY-MM-DD of a timestamp in Europe/Amsterdam. */
export function localDay(iso: string): string {
  const parts = dayFormatter.formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const toUtc = (ymd: string): number => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUtc = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const DAY_MS = 86_400_000;
const addDays = (ymd: string, n: number): string => fromUtc(toUtc(ymd) + n * DAY_MS);

/** Monday (YYYY-MM-DD) of the week containing the given YYYY-MM-DD. */
export function mondayOf(ymd: string): string {
  const dow = new Date(toUtc(ymd)).getUTCDay(); // 0 = Sunday
  return addDays(ymd, -((dow + 6) % 7));
}
/** The 7 days Monday..Sunday (YYYY-MM-DD) of the week that contains `ymd`. */
export function weekDays(ymd: string): string[] {
  const monday = mondayOf(ymd);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/**
 * Counts per category over all non-excluded sessions. restDays is computed for ONE week only:
 * the Monday-Sunday week of the earliest counted session; days with a counted session in that week
 * are subtracted from 7 (sessions in other weeks do not affect restDays). No sessions: 7.
 */
export function countWeek(sessions: PlannedSession[], excluded: ReadonlySet<string>): WeekCounts {
  const counted = sessions.filter((s) => !excluded.has(s.id));
  const counts: WeekCounts = { training: 0, gym: 0, match: 0, total: counted.length, restDays: 7 };
  for (const s of counted) counts[categoryOf(s.type)] += 1;
  if (counted.length === 0) return counts;
  const days = counted.map((s) => localDay(s.startsAt));
  const first = days.reduce((a, b) => (a < b ? a : b));
  const week = new Set(weekDays(first));
  const busy = new Set(days.filter((d) => week.has(d)));
  counts.restDays = Math.max(0, 7 - busy.size);
  return counts;
}

/** One entry per rule that has a limit. */
export function checkRules(counts: WeekCounts, rules: WeekRules): RuleCheck[] {
  const out: RuleCheck[] = [];
  const max = (key: RuleKey, limit: number | null, actual: number) => {
    if (limit === null || limit === undefined) return;
    out.push({ key, limit, actual, state: actual < limit ? "ok" : actual === limit ? "at" : "over" });
  };
  max("maxTrainings", rules.maxTrainings, counts.training);
  max("maxGym", rules.maxGym, counts.gym);
  max("maxMatches", rules.maxMatches, counts.match);
  const min = rules.minRestDays;
  if (min !== null && min !== undefined) {
    out.push({ key: "minRestDays", limit: min, actual: counts.restDays, state: counts.restDays > min ? "ok" : counts.restDays === min ? "at" : "over" });
  }
  return out;
}

const ITEMS = ["sleep", "soreness", "fatigue", "stress", "mood"] as const;
const avg = (e: WellnessEntry): number => Math.round((ITEMS.reduce((s, k) => s + e[k], 0) / ITEMS.length) * 10) / 10;
const round1 = (n: number): number => Math.round(n * 10) / 10;
/** Same thresholds as wellnessFlag in wellness.ts (copied to stay self-contained). */
function flag(e: WellnessEntry): "ok" | "watch" | "low" {
  const min = Math.min(...ITEMS.map((k) => e[k]));
  const a = avg(e);
  if (a < 2.5 || min === 1) return "low";
  if (a < 3.2 || min <= 2) return "watch";
  return "ok";
}
const EPS = 1e-9;
const RANK: Record<ReadinessLevel, number> = { unknown: 0, good: 1, reduced: 2, low: 3 };

/** entries: newest first, up to 28 days. today: YYYY-MM-DD. */
export function assessReadiness(entries: CheckIn[], today: string): Readiness {
  const latest = entries[0];
  if (!latest || (latest.day !== today && latest.day !== addDays(today, -1))) {
    return { level: "unknown", reasons: ["noRecentData"], average: null, baseline: null, painLocation: null };
  }
  const reasons: ReadinessReason[] = [];
  if (latest.pain === true) reasons.push("pain");
  if (latest.sleep <= 2) reasons.push("sleepLow");
  if (latest.fatigue <= 2) reasons.push("energyLow");
  if (latest.soreness <= 2) reasons.push("sorenessHigh");
  if (latest.stress <= 2) reasons.push("stressHigh");
  if (latest.mood <= 2) reasons.push("moodLow");

  const f = flag(latest);
  let level: ReadinessLevel = latest.pain === true || f === "low" ? "low" : f === "watch" ? "reduced" : "good";
  const raise = (to: ReadinessLevel) => {
    if (RANK[to] > RANK[level]) level = to;
  };

  const latestAvg = avg(latest);
  const older = entries.slice(1);
  let baseline: number | null = null;
  if (older.length >= 5) {
    baseline = older.reduce((s, e) => s + avg(e), 0) / older.length;
    if (latestAvg <= baseline - 0.8 + EPS) {
      reasons.push("belowBaseline");
      raise("reduced");
    }
  }

  // declining: latest 3 entries, all within the last 4 days (today and 3 days before), strictly falling, drop >= 1.0
  const last3 = entries.slice(0, 3);
  const cutoff = addDays(today, -3);
  if (last3.length === 3 && last3.every((e) => e.day >= cutoff && e.day <= today)) {
    const [a, b, c] = last3.map(avg); // newest, middle, oldest
    if (a < b && b < c && c - a >= 1.0 - EPS) {
      reasons.push("declining");
      raise("reduced");
    }
  }

  return {
    level,
    reasons,
    average: latestAvg,
    baseline: baseline === null ? null : round1(baseline),
    painLocation: latest.pain === true ? (latest.painLocation ?? null) : null,
  };
}

export function assessWeek(counts: WeekCounts, rules: WeekRules, readiness: Readiness): WeekAssessment {
  const checks = checkRules(counts, rules);
  const anyOver = checks.some((c) => c.state === "over");
  const anyAt = checks.some((c) => c.state === "at");
  const lowLoaded = readiness.level === "low" && counts.total > 0;

  let status: WeekStatus;
  if (anyOver || lowLoaded) status = "over";
  else if (anyAt || readiness.level === "reduced") status = "watch";
  else if (checks.length === 0 && readiness.level === "unknown") status = "unknown";
  else status = "ok";

  let advice: WeekAdvice = "none";
  if (lowLoaded) advice = readiness.reasons.includes("pain") ? "considerRest" : "reduceOne";
  else if (readiness.level === "reduced" && (anyAt || anyOver)) advice = "reduceOne";

  return { status, checks, readiness, advice };
}
