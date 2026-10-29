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
