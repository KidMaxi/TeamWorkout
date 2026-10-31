/**
 * Pure helpers shared by the session planner (client), the calendar (client) and the session server actions.
 * All calendar days are YYYY-MM-DD in Europe/Amsterdam; instants are only produced by zonedToUtc.
 */
import { localDay, mondayOf } from "./workload";

export const TIME_ZONE = "Europe/Amsterdam";

export const FOCUS_LIST = [
  "1v1", "2v2", "3v3", "5v5", "tactics", "shooting", "transition",
  "conditioning", "sprint", "skills", "recovery", "strength", "power", "mobility",
] as const;
export type Focus = (typeof FOCUS_LIST)[number];
export const isFocus = (v: unknown): v is Focus => typeof v === "string" && (FOCUS_LIST as readonly string[]).includes(v);

export const STATUS_LIST = ["planned", "completed", "adjusted", "cancelled"] as const;
export type SessionStatus = (typeof STATUS_LIST)[number];
export const isStatus = (v: unknown): v is SessionStatus => typeof v === "string" && (STATUS_LIST as readonly string[]).includes(v);

export const MAX_OCCURRENCES = 26;
export const MAX_LOCATION = 80;
export const MAX_NOTE = 500;

/** Helper bands for the planned RPE; `pick` is the value a chip sets. */
export const RPE_BANDS = [
  { key: "light", min: 1, max: 3, pick: 2 },
  { key: "medium", min: 4, max: 6, pick: 5 },
  { key: "heavy", min: 7, max: 8, pick: 7 },
  { key: "veryHeavy", min: 9, max: 10, pick: 9 },
] as const;

const DAY_MS = 86_400_000;
const utcMs = (ymd: string): number => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export function isYmd(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  return new Date(utcMs(v)).toISOString().slice(0, 10) === v && Number(v.slice(0, 4)) >= 2000 && Number(v.slice(0, 4)) <= 2100;
}
export const isHm = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

export const addDays = (ymd: string, n: number): string => new Date(utcMs(ymd) + n * DAY_MS).toISOString().slice(0, 10);
/** Whole days from a to b. */
export const diffDays = (a: string, b: string): number => Math.round((utcMs(b) - utcMs(a)) / DAY_MS);

/** First day of the month containing ymd, shifted by n months. */
export function addMonths(ymd: string, n: number): string {
  const [y, m] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
}
/** The 42 days (6 Monday-based weeks) shown by the month grid of ymd. */
export function monthGrid(ymd: string): string[] {
  const start = mondayOf(`${ymd.slice(0, 7)}-01`);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export type CalendarView = "day" | "week" | "month";
export const isView = (v: unknown): v is CalendarView => v === "day" || v === "week" || v === "month";
export function shiftDate(view: CalendarView, ymd: string, dir: 1 | -1): string {
  return view === "day" ? addDays(ymd, dir) : view === "week" ? addDays(ymd, 7 * dir) : addMonths(ymd, dir);
}

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
});
function offsetMs(ms: number): number {
  const p = partsFmt.formatToParts(new Date(ms));
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - Math.floor(ms / 1000) * 1000;
}
/** The instant at which the Europe/Amsterdam wall clock reads `ymd hm`. A time skipped by the spring-forward gap moves forward. */
export function zonedToUtc(ymd: string, hm: string): Date {
  const [h, mi] = hm.split(":").map(Number);
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const o1 = offsetMs(guess);
  let t = guess - o1;
  const o2 = offsetMs(t);
  if (o2 !== o1) t = guess - o2;
  return new Date(t);
}

/** HH:MM (Europe/Amsterdam) and minutes since local midnight. */
export function localTime(iso: string): { hm: string; minutes: number } {
  const p = partsFmt.formatToParts(new Date(iso));
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
  const h = g("hour");
  const m = g("minute");
  return { hm: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, minutes: h * 60 + m };
}
export { localDay };

/**
 * Weekly occurrences from start through until (inclusive), same weekday. Stops once MAX_OCCURRENCES + 1 days exist,
 * so a caller can tell "too many" from "exactly the maximum".
 */
export function seriesDays(start: string, until: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= until && out.length <= MAX_OCCURRENCES; d = addDays(d, 7)) out.push(d);
  return out;
}

export const plannedLoadOf = (rpe: number | null, minutes: number): number => (rpe ? rpe * minutes : 0);

export type DayItem = { startMin: number; durationMin: number; rpe: number | null; status: SessionStatus };
/** Planned load of a day (cancelled sessions count nothing) and whether it stacks: >= 2 heavy sessions or overlapping times. */
export function dayStats(items: DayItem[], heavyRpe = 7): { load: number; stacked: boolean; count: number } {
  const live = items.filter((s) => s.status !== "cancelled");
  const load = live.reduce((sum, s) => sum + plannedLoadOf(s.rpe, s.durationMin), 0);
  const heavy = live.filter((s) => (s.rpe ?? 0) >= heavyRpe).length >= 2;
  let overlap = false;
  for (let i = 0; i < live.length && !overlap; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      if (a.startMin < b.startMin + b.durationMin && b.startMin < a.startMin + a.durationMin) { overlap = true; break; }
    }
  }
  return { load, stacked: heavy || overlap, count: live.length };
}
