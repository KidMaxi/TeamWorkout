export const SESSION_TYPES = {
  academy: "Academy",
  gym: "Gym",
  evening: "Avondtraining",
  match: "Wedstrijd",
  other: "Overig",
} as const;
export type SessionType = keyof typeof SESSION_TYPES;

export const AVAILABILITY = {
  available: "Beschikbaar",
  limited: "Beperkt",
  unavailable: "Niet beschikbaar",
} as const;
export type Availability = keyof typeof AVAILABILITY;

/** Session load in arbitrary units: RPE (1-10) x minutes. */
export const sessionLoad = (rpe: number, minutes: number) => rpe * minutes;

/** Acute:chronic ratio signal. Indicative only; null while there is no 28-day baseline. */
export function acwrSignal(acwr: number | null): "none" | "ok" | "watch" | "high" {
  if (acwr === null) return "none";
  if (acwr > 1.5) return "high";
  if (acwr > 1.3 || acwr < 0.8) return "watch";
  return "ok";
}

export type LoadRow = {
  user_id: string;
  full_name: string;
  availability: Availability | null;
  availability_note: string | null;
  acute_load: number;
  chronic_weekly_avg: number;
  acwr: number | null;
  max_weekly_load: number | null;
  over_limit: boolean;
  has_baseline: boolean;
};

export type WeekTrendRow = { week_start: string; total_load: number; athletes_logged: number };
export type MissingRow = { user_id: string; missing: number };

export type DashboardFilter = "all" | "alerts" | "unavailable" | "missing";

export type AthleteRow = LoadRow & { missing: number; level: "none" | "ok" | "watch" | "high" | "out" };

/** Highest severity wins: over the weekly limit counts as high. */
export function athleteLevel(r: LoadRow): AthleteRow["level"] {
  // An athlete who is out is an availability matter, not a load warning.
  if (r.availability === "unavailable") return "out";
  return r.over_limit ? "high" : acwrSignal(r.acwr);
}

const ORDER = { high: 0, watch: 1, out: 2, ok: 3, none: 4 } as const;

export function sortByRisk(rows: AthleteRow[]): AthleteRow[] {
  return [...rows].sort(
    (a, b) =>
      ORDER[a.level] - ORDER[b.level] ||
      b.missing - a.missing ||
      a.full_name.localeCompare(b.full_name, "nl"),
  );
}

export function applyFilter(rows: AthleteRow[], f: DashboardFilter): AthleteRow[] {
  switch (f) {
    case "alerts":
      return rows.filter((r) => r.level === "high" || r.level === "watch");
    case "unavailable":
      return rows.filter((r) => r.availability && r.availability !== "available");
    case "missing":
      return rows.filter((r) => r.missing > 0);
    default:
      return rows;
  }
}
