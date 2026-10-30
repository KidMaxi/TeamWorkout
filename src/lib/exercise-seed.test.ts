import test from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error node needs the .ts extension; tsconfig does not allow it
import { STARTER_EXERCISES } from "./exercise-seed.ts";
// @ts-expect-error node needs the .ts extension; tsconfig does not allow it
import { EQUIPMENT, EXERCISE_KINDS, MUSCLES } from "./exercises.ts";

test("starter exercises are well-formed", () => {
  assert.ok(STARTER_EXERCISES.length >= 25);
  const keys = new Set<string>();
  for (const e of STARTER_EXERCISES) {
    assert.match(e.key, /^[a-z0-9]+(-[a-z0-9]+)*$/, e.key);
    assert.ok(!keys.has(e.key), `duplicate key ${e.key}`);
    keys.add(e.key);
    for (const l of ["nl", "en"] as const) {
      assert.ok(e.name[l].trim(), `${e.key} name ${l}`);
      assert.ok(e.instructions[l].trim(), `${e.key} instructions ${l}`);
    }
    assert.ok((EQUIPMENT as readonly string[]).includes(e.equipment), `${e.key} equipment`);
    assert.ok((EXERCISE_KINDS as readonly string[]).includes(e.kind), `${e.key} kind`);
    assert.ok((MUSCLES as readonly string[]).includes(e.primary_muscle), `${e.key} primary`);
    for (const m of e.other_muscles) assert.ok((MUSCLES as readonly string[]).includes(m), `${e.key} muscle ${m}`);
    assert.ok(!e.other_muscles.includes(e.primary_muscle), `${e.key} primary repeated`);
  }
});
