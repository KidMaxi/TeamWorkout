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

/** planned RPE x planned minutes, or null when no planned RPE. Cancelled/excluded sessions count nothing. */
export function plannedLoad(s: DaySession): number | null {
  void s;
  return null; // TODO(engine)
}
/** One entry per day of `days` (YYYY-MM-DD): planned and actual load, heavy session count, per-session share of the day. */
export function buildDays(days: string[], sessions: DaySession[], logs: ActualLog[], settings: WorkloadSettings): DayLoad[] {
  void sessions; void logs; void settings;
  return days.map((day) => ({ day, planned: 0, actual: 0, sessions: 0, heavySessions: 0, entries: [] })); // TODO(engine)
}
export function dayWarnings(
  days: DayLoad[],
  sessions: DaySession[],
  settings: WorkloadSettings,
  ctx: { weeklyActual: number; previousWeeks: number[]; missingCheckin: boolean; pain: boolean },
): DayWarning[] {
  void days; void sessions; void settings; void ctx;
  return []; // TODO(engine)
}
/** This week's load against the mean of the athlete's previous weeks (needs at least 2 previous weeks with load). */
export function baselineDeviation(
  thisWeek: number, previousWeeks: number[], settings: WorkloadSettings,
): { baseline: number | null; deviationPct: number | null; flagged: boolean } {
  void thisWeek; void previousWeeks; void settings;
  return { baseline: null, deviationPct: null, flagged: false }; // TODO(engine)
}
export function planVsActual(days: DayLoad[]): { planned: number; actual: number; diffPct: number | null } {
  void days;
  return { planned: 0, actual: 0, diffPct: null }; // TODO(engine)
}
/** The sessions that contribute most to the given days' actual (or planned when nothing is logged) load, largest first. */
export function topContributors(days: DayLoad[], n: number): DayEntry[] {
  void days; void n;
  return []; // TODO(engine)
}
