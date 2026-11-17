import test from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error node needs the .ts extension; tsconfig does not allow it
import { formatKg, pickId, rankLabel, splitPodium, firstParam } from "./leaderboard.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

test("formatKg uses the locale decimal separator", () => {
  assert.equal(formatKg(62.5, "nl"), "62,5");
  assert.equal(formatKg(62.5, "en"), "62.5");
  assert.equal(formatKg(100, "nl"), "100");
  assert.equal(formatKg(72.46, "nl"), "72,5");
});

test("pickId validates against the allowed list", () => {
  assert.equal(pickId(B, [A, B]), B);
  assert.equal(pickId(B.toUpperCase(), [A, B]), B);
  assert.equal(pickId("nope", [A, B]), A);
  assert.equal(pickId(undefined, [A, B]), A);
  assert.equal(pickId([B, A], [A, B]), B);
  assert.equal(pickId("33333333-3333-4333-8333-333333333333", [A, B]), A);
  assert.equal(pickId(A, []), null);
});

test("splitPodium keeps ties together", () => {
  const rows = [{ rank: 4 }, { rank: 1 }, { rank: 1 }, { rank: 3 }, { rank: 5 }];
  const { podium, rest } = splitPodium(rows);
  assert.deepEqual(podium.map((r: { rank: number }) => r.rank), [1, 1, 3]);
  assert.deepEqual(rest.map((r: { rank: number }) => r.rank), [4, 5]);
  assert.deepEqual(splitPodium([]), { podium: [], rest: [] });
});

test("rankLabel and firstParam", () => {
  assert.equal(rankLabel(1), "01");
  assert.equal(rankLabel(12), "12");
  assert.equal(firstParam(["a", "b"]), "a");
});
