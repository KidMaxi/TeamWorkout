/**
 * Pure helpers for the academy planning tab (week grouping, planned AU, colours, week bounds).
 * All days are YYYY-MM-DD in Europe/Amsterdam. Deliberately self-contained (no imports from other lib files).
 */

const TZ = "Europe/Amsterdam";
const DAY_MS = 86_400_000;

const utcMs = (ymd: string): number => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
export const addDays = (ymd: string, n: number): string => new Date(utcMs(ymd) + n * DAY_MS).toISOString().slice(0, 10);

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
});
const parts = (ms: number) => {
  const p = partsFmt.formatToParts(new Date(ms));
  return (t: string) => Number(p.find((x) => x.type === t)?.value);
};

/** YYYY-MM-DD of an instant in Europe/Amsterdam. */
export function amsterdamDay(iso: string): string {
  const g = parts(new Date(iso).getTime());
  return `${String(g("year")).padStart(4, "0")}-${String(g("month")).padStart(2, "0")}-${String(g("day")).padStart(2, "0")}`;
}

/** HH:MM of an instant in Europe/Amsterdam. */
export function amsterdamTime(iso: string): string {
  const g = parts(new Date(iso).getTime());
  return `${String(g("hour")).padStart(2, "0")}:${String(g("minute")).padStart(2, "0")}`;
}

/** The instant at which the Amsterdam wall clock reads midnight of ymd. */
export function amsterdamMidnight(ymd: string): Date {
  const guess = utcMs(ymd);
  const off = (ms: number) => {
    const g = parts(ms);
    return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - Math.floor(ms / 1000) * 1000;
  };
  const o1 = off(guess);
  let t = guess - o1;
  const o2 = off(t);
  if (o2 !== o1) t = guess - o2;
  return new Date(t);
}

/** [from, to) in UTC (ISO) for the Monday-based week starting at weekStart (Amsterdam local midnights). */
export function weekBoundsUtc(weekStart: string): { from: string; to: string } {
  return { from: amsterdamMidnight(weekStart).toISOString(), to: amsterdamMidnight(addDays(weekStart, 7)).toISOString() };
}

/** Seven days Mon..Sun from the Monday weekStart. */
export const weekDayList = (weekStart: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

/** Planned load in AU: minutes x RPE, or null when either is missing or not positive. */
export function plannedAu(minutes: number | null | undefined, rpe: number | null | undefined): number | null {
  if (typeof minutes !== "number" || typeof rpe !== "number") return null;
  if (!Number.isFinite(minutes) || !Number.isFinite(rpe) || minutes <= 0 || rpe <= 0) return null;
  return Math.round(minutes * rpe);
}

export type TypeGroup = "basketball" | "gym" | "match";
export const TYPE_GROUPS: readonly TypeGroup[] = ["basketball", "gym", "match"];
/** Gym and match have their own colour; every other session type counts as basketball (court). */
export const typeGroup = (type: string): TypeGroup => (type === "gym" ? "gym" : type === "match" ? "match" : "basketball");

export const GROUP_COLOR: Record<TypeGroup, string> = {
  basketball: "#3b82f6",
  gym: "#f97316",
  match: "#eab308",
};
export const colorOf = (type: string): string => GROUP_COLOR[typeGroup(type)];

export type PlanItem = {
  id: string;
  teamId: string;
  teamName: string;
  type: string;
  title: string;
  startsAt: string;
  day: string;
  time: string;
  durationMin: number | null;
  rpe: number | null;
  au: number | null;
  status: string;
  location: string | null;
};

export type RawSession = {
  id: string;
  team_id: string;
  type: string;
  title: string | null;
  starts_at: string;
  planned_duration_min: number | null;
  planned_rpe: number | null;
  status: string | null;
  location: string | null;
};

/** Map a database row to a display item (Amsterdam day/time, AU). */
export function toPlanItem(r: RawSession, teamName: string): PlanItem {
  return {
    id: r.id, teamId: r.team_id, teamName, type: r.type, title: (r.title ?? "").trim(), startsAt: r.starts_at,
    day: amsterdamDay(r.starts_at), time: amsterdamTime(r.starts_at),
    durationMin: r.planned_duration_min ?? null, rpe: r.planned_rpe ?? null,
    au: plannedAu(r.planned_duration_min, r.planned_rpe), status: r.status ?? "planned", location: r.location ?? null,
  };
}

/** Sort by start time, then by team name. */
export const sortItems = (items: readonly PlanItem[]): PlanItem[] =>
  [...items].sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.teamName.localeCompare(b.teamName));

/** Items per day for the given days (every day present, sorted); items outside the days are ignored. */
export function groupByDay(items: readonly PlanItem[], days: readonly string[]): Record<string, PlanItem[]> {
  const out: Record<string, PlanItem[]> = {};
  for (const d of days) out[d] = [];
  for (const it of sortItems(items)) if (out[it.day]) out[it.day].push(it);
  return out;
}

/** Day to show first in day view: today when it is in the week, else the first day with sessions, else the first day. */
export function defaultDay(days: readonly string[], today: string, grouped: Record<string, readonly unknown[]>): string {
  if (days.includes(today)) return today;
  return days.find((d) => (grouped[d]?.length ?? 0) > 0) ?? days[0];
}

/** Apply the team and type filters (empty set = no filter on that dimension). */
export function filterItems(items: readonly PlanItem[], teams: ReadonlySet<string>, groups: ReadonlySet<TypeGroup>): PlanItem[] {
  return items.filter((i) => (teams.size === 0 || teams.has(i.teamId)) && (groups.size === 0 || groups.has(typeGroup(i.type))));
}

/** Total planned AU of non-cancelled items. */
export const totalAu = (items: readonly PlanItem[]): number =>
  items.reduce((s, i) => s + (i.status === "cancelled" ? 0 : (i.au ?? 0)), 0);
