/** Pure helpers for the club leaderboard (no imports, so node's test runner can load them directly). */

export type RecordRow = {
  rank: number;
  user_id: string;
  full_name: string | null;
  team_name: string | null;
  jersey_number: number | null;
  best_kg: number;
  tested_at: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The first value of a search param. */
export const firstParam = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/** The wanted id when it is a valid uuid and one of the allowed ids, otherwise the first allowed id (or null). */
export function pickId(wanted: string | string[] | undefined, allowed: readonly string[]): string | null {
  const w = firstParam(wanted);
  if (w && UUID.test(w)) {
    const hit = allowed.find((a) => a.toLowerCase() === w.toLowerCase());
    if (hit) return hit;
  }
  return allowed[0] ?? null;
}

/** Podium = everyone with rank 1-3 (ties share a rank, so it can hold more than three); the rest follows as a list. */
export function splitPodium<T extends { rank: number }>(rows: readonly T[]): { podium: T[]; rest: T[] } {
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  return { podium: sorted.filter((r) => r.rank <= 3), rest: sorted.filter((r) => r.rank > 3) };
}

/** 62.5 -> "62,5" (nl) / "62.5" (en); whole numbers without decimals. */
export function formatKg(kg: number, locale: "nl" | "en"): string {
  const rounded = Math.round(kg * 10) / 10;
  const s = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return locale === "nl" ? s.replace(".", ",") : s;
}

/** Rank as a zero-padded label: 1 -> "01". */
export const rankLabel = (rank: number): string => String(rank).padStart(2, "0");
