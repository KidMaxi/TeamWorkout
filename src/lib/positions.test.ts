import test from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error node needs the .ts extension; tsconfig does not allow it
import { POSITIONS, isPosition, isJersey, playerLabel, byJerseyThenName } from "./positions.ts";

test("isPosition accepts exactly the five positions", () => {
  assert.equal(POSITIONS.length, 5);
  for (const p of POSITIONS) assert.equal(isPosition(p), true);
  for (const v of ["", "Center", "guard", null, undefined, 3, {}, ["center"]]) assert.equal(isPosition(v), false);
});

test("isJersey accepts integers 0-99 only", () => {
  for (const v of [0, 7, 99]) assert.equal(isJersey(v), true);
  for (const v of [-1, 100, 1.5, NaN, "7", null, undefined]) assert.equal(isJersey(v), false);
});

test("playerLabel", () => {
  assert.equal(playerLabel(7, "Point guard"), "#7 · Point guard");
  assert.equal(playerLabel(0, null), "#0");
  assert.equal(playerLabel(null, "Center"), "Center");
  assert.equal(playerLabel(null, null), "");
});

test("byJerseyThenName sorts numbers first, nulls last, then by name", () => {
  const list = [
    { jersey: null, name: "Zed" }, { jersey: 10, name: "B" }, { jersey: null, name: "Amy" }, { jersey: 0, name: "C" }, { jersey: 10, name: "A" },
  ];
  assert.deepEqual(list.sort(byJerseyThenName).map((x) => x.name), ["C", "A", "B", "Amy", "Zed"]);
});
