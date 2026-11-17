/** Pure helpers for the academy week overview (aggregation, week navigation, ?week validation). All days are YYYY-MM-DD in Europe/Amsterdam. */

export type AcademyRow = {
  team_id: string;
  team_name: string;
  user_id: string;
  full_name: string | null;
  jersey_number: number | null;
  position: string | null;
  day_au: number[];
  week_au: number;
  sessions: number;
  gym_sessions: number;
  avg_28d: number;
};

const DAY_MS = 86_400_000;
const utcMs = (ymd: string): number => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const addDays = (ymd: string, n: number): string => new Date(utcMs(ymd) + n * DAY_MS).toISOString().slice(0, 10);

// Not imported from ./workload: node's test runner needs .ts extensions that tsc forbids, so the two tiny helpers live here.
const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" });
/** YYYY-MM-DD of an instant in Europe/Amsterdam. */
const localDay = (iso: string): string => {
  const p = dayFormatter.formatToParts(new Date(iso));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}`;
};
/** Monday of the week containing ymd. */
const mondayOf = (ymd: string): string => addDays(ymd, -((new Date(utcMs(ymd)).getUTCDay() + 6) % 7));

const int = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0);
/** Seven integers Mon..Sun; missing or invalid entries count as 0. */
export const normalizeDays = (days: unknown): number[] =>
  Array.from({ length: 7 }, (_, i) => (Array.isArray(days) ? int(days[i]) : 0));

/** Rounded integer average; 0 for no values. */
export const avgRound = (sum: number, n: number): number => (n > 0 ? Math.round(sum / n) : 0);

export type Kpis = { players: number; weekAu: number; sessions: number; gymSessions: number };
export function kpis(rows: readonly AcademyRow[]): Kpis {
  return rows.reduce<Kpis>(
    (k, r) => ({ players: k.players + 1, weekAu: k.weekAu + int(r.week_au), sessions: k.sessions + int(r.sessions), gymSessions: k.gymSessions + int(r.gym_sessions) }),
    { players: 0, weekAu: 0, sessions: 0, gymSessions: 0 },
  );
}

/** Sum over all rows per weekday (Mon..Sun). */
export function dailyTotals(rows: readonly AcademyRow[]): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0];
  for (const r of rows) normalizeDays(r.day_au).forEach((v, i) => (out[i] += v));
  return out;
}

export type TeamSummary = { teamId: string; teamName: string; players: number; totalAu: number; avgAu: number };
/** One summary per team, sorted by team name; avgAu = rounded total / players. */
export function teamSummaries(rows: readonly AcademyRow[]): TeamSummary[] {
  const m = new Map<string, TeamSummary>();
  for (const r of rows) {
    const s = m.get(r.team_id) ?? { teamId: r.team_id, teamName: r.team_name, players: 0, totalAu: 0, avgAu: 0 };
    s.players += 1;
    s.totalAu += int(r.week_au);
    m.set(r.team_id, s);
  }
  return [...m.values()]
    .map((s) => ({ ...s, avgAu: avgRound(s.totalAu, s.players) }))
    .sort((a, b) => a.teamName.localeCompare(b.teamName));
}

/** ?week must be a real YYYY-MM-DD date; returns its Monday, or null when invalid. */
export function parseWeekParam(v: unknown): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  if (new Date(utcMs(s)).toISOString().slice(0, 10) !== s) return null;
  const y = Number(s.slice(0, 4));
  if (y < 2000 || y > 2100) return null;
  return mondayOf(s);
}

/** Monday of the current week in Europe/Amsterdam. */
export const currentWeekStart = (now: Date = new Date()): string => mondayOf(localDay(now.toISOString()));

export type WeekNav = { start: string; end: string; prev: string; next: string; thisWeek: string; isCurrent: boolean; days: string[]; todayIndex: number };
/** Navigation data for the week containing `weekStart`; todayIndex is the Mon..Sun index of today, or -1 if not in this week. */
export function weekNav(weekStart: string, now: Date = new Date()): WeekNav {
  const start = mondayOf(weekStart);
  const today = localDay(now.toISOString());
  const thisWeek = mondayOf(today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return { start, end: days[6], prev: addDays(start, -7), next: addDays(start, 7), thisWeek, isCurrent: start === thisWeek, days, todayIndex: days.indexOf(today) };
}

export type FitStatus = "fit" | "less_fit" | "not_fit" | "unknown";
export type FitRow = { team_id: string; user_id: string; status: FitStatus; reason_code: string | null; reason_detail: string | null };

const REASONS = ["availability", "pain", "sleep", "soreness", "fatigue", "stress", "mood"] as const;
export type ReasonCode = (typeof REASONS)[number];

/** Narrow a raw status string; anything unexpected counts as unknown. */
export const fitStatus = (v: unknown): FitStatus => (v === "fit" || v === "less_fit" || v === "not_fit" ? v : "unknown");

/** Known reason code, or null (admins get no reason, unknown codes are ignored). */
export const reasonKey = (code: unknown): ReasonCode | null =>
  typeof code === "string" && (REASONS as readonly string[]).includes(code) ? (code as ReasonCode) : null;

/** Lookup key of a player within a team. */
export const fitKey = (teamId: string, userId: string): string => `${teamId}:${userId}`;

/** Fit rows indexed by team + user. */
export function fitMap(fit: readonly FitRow[]): Map<string, FitRow> {
  const m = new Map<string, FitRow>();
  for (const f of fit) m.set(fitKey(f.team_id, f.user_id), { ...f, status: fitStatus(f.status) });
  return m;
}

export type Flag = { teamId: string; teamName: string; userId: string; name: string; status: "less_fit" | "not_fit"; reason: ReasonCode | null; detail: string | null };
/** Players that are less_fit or not_fit: not_fit first, then team name, then player name. */
export function flagList(rows: readonly AcademyRow[], fit: readonly FitRow[]): Flag[] {
  const m = fitMap(fit);
  const out: Flag[] = [];
  for (const r of rows) {
    const f = m.get(fitKey(r.team_id, r.user_id));
    if (!f || (f.status !== "less_fit" && f.status !== "not_fit")) continue;
    out.push({
      teamId: r.team_id, teamName: r.team_name, userId: r.user_id, name: r.full_name?.trim() || "—",
      status: f.status, reason: reasonKey(f.reason_code), detail: f.reason_detail?.trim() || null,
    });
  }
  const rank = (s: Flag["status"]) => (s === "not_fit" ? 0 : 1);
  return out.sort((a, b) => rank(a.status) - rank(b.status) || a.teamName.localeCompare(b.teamName) || a.name.localeCompare(b.name));
}
