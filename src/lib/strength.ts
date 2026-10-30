/**
 * RPE-based strength calculations (pure functions, no imports so they can be unit tested directly).
 *
 * Model: a table of %1RM for 1..12 reps at RPE 10 (max effort). A set of `reps` at a lower RPE r
 * has (10 - r) reps in reserve, so it equals `reps + (10 - r)` reps at RPE 10. Half-point RPEs
 * interpolate linearly between the neighbouring whole RPEs.
 * These are population-level estimates: they depend on how honestly the athlete rates RPE.
 */

/** %1RM (as a percentage) for 1..12 reps at RPE 10. */
const RPE10_PERCENT = [100, 95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68.0] as const;

export const MAX_REPS = 12;
export const MIN_RPE = 5;
export const MAX_RPE = 10;
export const DEFAULT_STEP_KG = 2.5;

const isHalfStep = (n: number) => Number.isFinite(n) && Math.abs(n * 2 - Math.round(n * 2)) < 1e-9;

/** Fraction of 1RM (0..1) for `reps` at `rpe`, or null outside the table (reps 1..12, rpe 5..10 in 0.5 steps). */
export function rpePercent(reps: number, rpe: number): number | null {
  if (!Number.isInteger(reps) || reps < 1 || reps > MAX_REPS) return null;
  if (!isHalfStep(rpe) || rpe < MIN_RPE || rpe > MAX_RPE) return null;
  const reserve = MAX_RPE - rpe; // reps in reserve, may be x.5
  const lo = Math.floor(reserve);
  const frac = reserve - lo;
  const at = (reserveWhole: number) => {
    const idx = reps + reserveWhole - 1;
    return idx < RPE10_PERCENT.length ? RPE10_PERCENT[idx] : null;
  };
  const a = at(lo);
  if (a === null) return null;
  if (frac === 0) return a / 100;
  const b = at(lo + 1);
  if (b === null) return null;
  return (a * (1 - frac) + b * frac) / 100;
}

export function roundToStep(kg: number, step: number = DEFAULT_STEP_KG): number {
  return Math.round(kg / step) * step;
}

/** Estimated 1RM from a performed set, or null when outside the table. */
export function estimateOneRM(weightKg: number, reps: number, rpe: number): number | null {
  if (!(weightKg > 0)) return null;
  const p = rpePercent(reps, rpe);
  return p === null ? null : weightKg / p;
}

/**
 * 5RM from a performed set. `estimated` is false only for a true test: 5 reps at RPE 10.
 * The value is rounded to 0.1 kg; round for display with roundToStep.
 */
export function estimateFiveRM(weightKg: number, reps: number, rpe: number): { fiveRmKg: number; estimated: boolean } | null {
  const oneRm = estimateOneRM(weightKg, reps, rpe);
  const p5 = rpePercent(5, MAX_RPE);
  if (oneRm === null || p5 === null) return null;
  const exact = reps === 5 && rpe === MAX_RPE;
  return { fiveRmKg: Math.round(oneRm * p5 * 10) / 10, estimated: !exact };
}

/** Working weight for `reps` at `rpe`, given an athlete's 5RM, rounded to `step` kg. Null outside the table. */
export function weightFor(fiveRmKg: number, reps: number, rpe: number, step: number = DEFAULT_STEP_KG): number | null {
  const p5 = rpePercent(5, MAX_RPE);
  const p = rpePercent(reps, rpe);
  if (!(fiveRmKg > 0) || p5 === null || p === null) return null;
  return roundToStep((fiveRmKg / p5) * p, step);
}
