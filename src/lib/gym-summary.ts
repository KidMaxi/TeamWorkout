/** Pure helpers for the "Gelogde sets" overview (rows come from public.session_set_summary). */

export type SummaryRow = {
  user_id: string;
  full_name: string | null;
  jersey_number: number | null;
  exercise_id: string;
  exercise_name: string;
  sets: number | string;
  top_weight_kg: number | string | null;
  top_reps: number | string | null;
  finished: boolean | null;
};

export type ExerciseLine = { exerciseId: string; name: string; sets: number; topWeightKg: number | null; topReps: number | null };
export type AthleteSummary = { userId: string; name: string; jersey: number | null; finished: boolean; exercises: ExerciseLine[] };

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** One entry per athlete (shirt number first, then name); exercises keep the order of the rows. */
export function groupByAthlete(rows: readonly SummaryRow[]): AthleteSummary[] {
  const by = new Map<string, AthleteSummary>();
  const done = new Map<string, boolean>();
  for (const r of rows) {
    let a = by.get(r.user_id);
    if (!a) {
      a = { userId: r.user_id, name: r.full_name ?? "", jersey: num(r.jersey_number), finished: false, exercises: [] };
      by.set(r.user_id, a);
      done.set(r.user_id, true);
    }
    if (!r.finished) done.set(r.user_id, false);
    a.exercises.push({ exerciseId: r.exercise_id, name: r.exercise_name, sets: num(r.sets) ?? 0, topWeightKg: num(r.top_weight_kg), topReps: num(r.top_reps) });
  }
  for (const [id, a] of by) a.finished = done.get(id) === true;
  return [...by.values()].sort((a, b) => {
    if (a.jersey === null) return b.jersey === null ? a.name.localeCompare(b.name) : 1;
    if (b.jersey === null) return -1;
    return a.jersey - b.jersey || a.name.localeCompare(b.name);
  });
}

/** Kilograms with a decimal comma in Dutch, a point in English; whole numbers without decimals. */
export function formatKg(kg: number, locale: "nl" | "en"): string {
  const s = String(Math.round(kg * 100) / 100);
  return locale === "nl" ? s.replace(".", ",") : s;
}

/** Top set parts: weight text (null for bodyweight / no weight) and reps (null when unknown). */
export function topSet(line: Pick<ExerciseLine, "topWeightKg" | "topReps">, locale: "nl" | "en"): { weight: string | null; reps: number | null } {
  const w = line.topWeightKg;
  return { weight: w !== null && w > 0 ? formatKg(w, locale) : null, reps: line.topReps };
}

/** How many of the (non-excluded) athletes have finished; never more than the total. */
export function doneTotal(athletes: readonly Pick<AthleteSummary, "finished" | "userId">[], total: number): { done: number; total: number } {
  const done = athletes.filter((a) => a.finished).length;
  return { done: Math.min(done, total), total };
}
