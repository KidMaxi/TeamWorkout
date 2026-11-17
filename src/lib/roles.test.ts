import test from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error node needs the .ts extension; tsconfig does not allow it
import { can, canPlanType, kindsFromRow, getStaffKinds, getStaffKind, STAFF_KINDS } from "./roles.ts";

const CAPS = ["planGym", "planCourt", "manageLibrary", "planRules", "writeNotes", "setAvailability", "viewHealth", "manageMembers", "managePlayers", "manageTeam"] as const;

const fakeDb = (row: unknown) => ({
  from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row }) }) }) }) }),
});

test("null, undefined and empty arrays can do nothing", () => {
  for (const cap of CAPS) {
    assert.equal(can(null, cap), false);
    assert.equal(can(undefined, cap), false);
    assert.equal(can([], cap), false);
  }
  assert.equal(canPlanType([], "gym"), false);
  assert.equal(canPlanType(null, "academy"), false);
});

test("a single kind and a one-element array agree", () => {
  for (const k of STAFF_KINDS) for (const cap of CAPS) assert.equal(can(k, cap), can([k], cap));
});

test("basketball + sc can plan both gym and court; each alone only one", () => {
  assert.equal(canPlanType(["basketball"], "gym"), false);
  assert.equal(canPlanType(["basketball"], "academy"), true);
  assert.equal(canPlanType(["sc"], "gym"), true);
  assert.equal(canPlanType(["sc"], "academy"), false);
  assert.equal(canPlanType(["basketball", "sc"], "gym"), true);
  assert.equal(canPlanType(["basketball", "sc"], "academy"), true);
  assert.equal(canPlanType(["basketball", "sc"], "match"), true);
});

test("union adds capabilities, never removes", () => {
  assert.equal(can(["medical"], "planRules"), false);
  assert.equal(can(["medical", "basketball"], "planRules"), true);
  assert.equal(can(["medical", "sc"], "manageLibrary"), true);
  assert.equal(can(["basketball", "sc", "medical"], "manageMembers"), false);
  assert.equal(can(["basketball", "sc", "medical"], "manageTeam"), false);
});

test("head still implies everything", () => {
  for (const cap of CAPS) {
    assert.equal(can("head", cap), true);
    assert.equal(can(["head", "medical"], cap), true);
  }
  assert.equal(canPlanType("head", "gym"), true);
  assert.equal(canPlanType("head", "academy"), true);
});

test("kindsFromRow: primary first, extras de-duplicated and sanitised", () => {
  assert.deepEqual(kindsFromRow({ role: "staff", staff_kind: "basketball", extra_kinds: ["sc"] }), ["basketball", "sc"]);
  assert.deepEqual(kindsFromRow({ role: "staff", staff_kind: "sc", extra_kinds: ["sc", "medical", "medical", "head", "bogus", 3] }), ["sc", "medical"]);
  assert.deepEqual(kindsFromRow({ role: "staff", staff_kind: "medical", extra_kinds: null }), ["medical"]);
  assert.deepEqual(kindsFromRow({ role: "staff", staff_kind: "medical" }), ["medical"]);
});

test("legacy staff row without a kind counts as head", () => {
  assert.deepEqual(kindsFromRow({ role: "staff", staff_kind: null, extra_kinds: [] }), ["head"]);
  assert.deepEqual(kindsFromRow({ role: "staff", staff_kind: "nonsense" }), ["head"]);
});

test("athletes and missing rows have no kinds", () => {
  assert.deepEqual(kindsFromRow({ role: "athlete", staff_kind: null, extra_kinds: ["sc"] }), []);
  assert.deepEqual(kindsFromRow(null), []);
  assert.deepEqual(kindsFromRow(undefined), []);
});

test("getStaffKinds / getStaffKind read the row", async () => {
  const db = fakeDb({ role: "staff", staff_kind: "basketball", extra_kinds: ["sc"] });
  assert.deepEqual(await getStaffKinds(db, "t", "u"), ["basketball", "sc"]);
  assert.equal(await getStaffKind(db, "t", "u"), "basketball");
  assert.deepEqual(await getStaffKinds(fakeDb({ role: "athlete", staff_kind: null, extra_kinds: [] }), "t", "u"), []);
  assert.equal(await getStaffKind(fakeDb(null), "t", "u"), null);
  assert.deepEqual(await getStaffKinds(fakeDb({ role: "staff", staff_kind: null }), "t", "u"), ["head"]);
});

test("managePlayers mirrors is_team_planner: head, sc, basketball; not medical or athletes", () => {
  assert.equal(can("head", "managePlayers"), true);
  assert.equal(can("sc", "managePlayers"), true);
  assert.equal(can("basketball", "managePlayers"), true);
  assert.equal(can("medical", "managePlayers"), false);
  assert.equal(can(["medical", "sc"], "managePlayers"), true);
  assert.equal(can([], "managePlayers"), false);
});
