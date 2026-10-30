/** Daily wellness check. All items are 1-5 where 5 is best (slept well, no soreness, fresh, relaxed, good mood). */
export const WELLNESS_ITEMS = ["sleep", "soreness", "fatigue", "stress", "mood"] as const;
export type WellnessItem = (typeof WELLNESS_ITEMS)[number];

export type WellnessEntry = { day: string } & Record<WellnessItem, number> & {
  /** Optional pain flag and short free-text location (max 60 chars). */
  pain?: boolean;
  painLocation?: string | null;
};

export const wellnessAverage = (e: Record<WellnessItem, number>): number =>
  Math.round((WELLNESS_ITEMS.reduce((s, k) => s + e[k], 0) / WELLNESS_ITEMS.length) * 10) / 10;

/** "low": clear concern; "watch": worth a look; "ok" otherwise. Indicative only; staff decide. */
export function wellnessFlag(e: Record<WellnessItem, number>): "ok" | "watch" | "low" {
  const min = Math.min(...WELLNESS_ITEMS.map((k) => e[k]));
  const avg = wellnessAverage(e);
  if (avg < 2.5 || min === 1) return "low";
  if (avg < 3.2 || min <= 2) return "watch";
  return "ok";
}

/** Today's date (YYYY-MM-DD) in the team's time zone, so a check-in belongs to the local day. */
export const TEAM_TIME_ZONE = "Europe/Amsterdam";
export function todayInTeamZone(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TEAM_TIME_ZONE }).format(now);
}
