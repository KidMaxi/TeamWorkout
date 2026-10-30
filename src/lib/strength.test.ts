import test from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error node needs the .ts extension; tsconfig does not allow it
import { rpePercent, estimateOneRM, estimateFiveRM, weightFor, roundToStep } from "./strength.ts";

const near = (a: number | null, b: number, eps = 1e-9) => {
  assert.notEqual(a, null);
  assert.ok(Math.abs((a as number) - b) < eps, `${a} !~ ${b}`);
};

test("reference values from a 5RM", () => {
  assert.equal(weightFor(125, 1, 9), 137.5);
  assert.equal(weightFor(70, 5, 8), 65);
  assert.equal(weightFor(70, 3, 8), 70);
  assert.equal(weightFor(70, 8, 7), 57.5);
});

test("5RM at RPE 10 returns the 5RM itself", () => {
  assert.equal(weightFor(100, 5, 10), 100);
});

test("estimateFiveRM", () => {
  const est = estimateFiveRM(120, 5, 9);
  assert.equal(est?.fiveRmKg, 123.7);
  assert.equal(est?.estimated, true);
  const exact = estimateFiveRM(100, 5, 10);
  assert.equal(exact?.fiveRmKg, 100);
  assert.equal(exact?.estimated, false);
  assert.equal(estimateFiveRM(100, 3, 10)?.estimated, true);
  assert.equal(estimateFiveRM(100, 0, 10), null);
  assert.equal(estimateFiveRM(0, 5, 10), null);
});

test("estimateOneRM", () => {
  near(estimateOneRM(100, 1, 10), 100);
  assert.equal(estimateOneRM(-5, 5, 10), null);
  assert.equal(estimateOneRM(100, 13, 10), null);
});

test("half-point RPE interpolates between whole RPEs", () => {
  const lo = rpePercent(3, 9)!;
  const hi = rpePercent(3, 10)!;
  const mid = rpePercent(3, 9.5)!;
  assert.ok(mid > lo && mid < hi);
  near(mid, (lo + hi) / 2);
});

test("out-of-table inputs return null", () => {
  for (const [reps, rpe] of [[0, 8], [13, 10], [2.5, 8], [5, 4], [5, 10.5], [5, 9.3], [-1, 8], [NaN, 8], [5, NaN]]) {
    assert.equal(rpePercent(reps, rpe), null, `${reps}@${rpe}`);
  }
  // reps + reserve beyond 12
  assert.equal(rpePercent(12, 9), null);
  assert.equal(rpePercent(10, 7), null);
  assert.equal(rpePercent(12, 9.5), null);
  assert.ok(rpePercent(12, 10) !== null);
  assert.ok(rpePercent(9, 7) !== null);
  assert.equal(weightFor(100, 13, 8), null);
  assert.equal(weightFor(0, 5, 8), null);
});

test("more reps at the same RPE lowers the percentage", () => {
  for (const rpe of [7, 8, 9, 9.5, 10]) {
    let prev = Infinity;
    for (let reps = 1; reps <= 12; reps++) {
      const p = rpePercent(reps, rpe);
      if (p === null) break;
      assert.ok(p < prev, `${reps}@${rpe}`);
      prev = p;
    }
  }
});

test("higher RPE at the same reps raises the percentage", () => {
  for (let reps = 1; reps <= 8; reps++) {
    let prev = 0;
    for (let rpe = 7; rpe <= 10; rpe += 0.5) {
      const p = rpePercent(reps, rpe)!;
      assert.ok(p > prev, `${reps}@${rpe}`);
      prev = p;
    }
  }
});

test("weightFor increases with the 5RM", () => {
  let prev = 0;
  for (let kg = 40; kg <= 200; kg += 5) {
    const w = weightFor(kg, 3, 8)!;
    assert.ok(w >= prev);
    prev = w;
  }
  assert.ok(weightFor(200, 3, 8)! > weightFor(40, 3, 8)!);
});

test("roundToStep", () => {
  assert.equal(roundToStep(61.2), 60);
  assert.equal(roundToStep(61.3), 62.5);
  assert.equal(roundToStep(63.75), 65);
  assert.equal(roundToStep(63, 1), 63);
  assert.equal(roundToStep(63.4, 5), 65);
  assert.equal(roundToStep(0), 0);
});
