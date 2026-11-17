import test from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error node needs the .ts extension; tsconfig does not allow it
import { groupByAthlete, formatKg, topSet, doneTotal } from "./gym-summary.ts";

const row = (o: Record<string, unknown>) => ({
  user_id: "u1", full_name: "A", jersey_number: 7, exercise_id: "e1", exercise_name: "Bench press",
  sets: 4, top_weight_kg: 70, top_reps: 6, finished: true, ...o,
});

test("groups rows per athlete, sorted by shirt number then name, no-number last", () => {
  const g = groupByAthlete([
    row({ user_id: "u3", full_name: "Zed", jersey_number: null }),
    row({ user_id: "u2", full_name: "Bo", jersey_number: 4 }),
    row({ user_id: "u1", exercise_id: "e2", exercise_name: "Squat" }),
    row({ user_id: "u1" }),
  ]);
  assert.deepEqual(g.map((a: { userId: string }) => a.userId), ["u2", "u1", "u3"]);
  assert.equal(g[1].exercises.length, 2);
});

test("finished only when every row is finished; numeric strings are coerced", () => {
  const g = groupByAthlete([row({ sets: "3", top_weight_kg: "62.5" }), row({ exercise_id: "e2", finished: false })]);
  assert.equal(g[0].finished, false);
  assert.equal(g[0].exercises[0].sets, 3);
  assert.equal(g[0].exercises[0].topWeightKg, 62.5);
  assert.equal(groupByAthlete([row({})])[0].finished, true);
});

test("formatKg uses a decimal comma in nl", () => {
  assert.equal(formatKg(62.5, "nl"), "62,5");
  assert.equal(formatKg(62.5, "en"), "62.5");
  assert.equal(formatKg(70, "nl"), "70");
});

test("topSet hides zero or missing weight", () => {
  assert.deepEqual(topSet({ topWeightKg: 0, topReps: 12 }, "nl"), { weight: null, reps: 12 });
  assert.deepEqual(topSet({ topWeightKg: null, topReps: 8 }, "nl"), { weight: null, reps: 8 });
  assert.deepEqual(topSet({ topWeightKg: 72.5, topReps: 5 }, "nl"), { weight: "72,5", reps: 5 });
});

test("doneTotal counts finished athletes, capped at total", () => {
  const a = [{ userId: "1", finished: true }, { userId: "2", finished: false }, { userId: "3", finished: true }];
  assert.deepEqual(doneTotal(a, 5), { done: 2, total: 5 });
  assert.deepEqual(doneTotal(a, 1), { done: 1, total: 1 });
  assert.deepEqual(doneTotal([], 0), { done: 0, total: 0 });
});
