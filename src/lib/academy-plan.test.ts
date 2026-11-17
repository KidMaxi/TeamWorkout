import test from "node:test";
import assert from "node:assert/strict";
import type { RawSession } from "./academy-plan.ts";
// @ts-expect-error node needs the .ts extension; tsconfig does not allow it
import { amsterdamDay, amsterdamTime, weekBoundsUtc, weekDayList, plannedAu, typeGroup, colorOf, GROUP_COLOR, toPlanItem, groupByDay, defaultDay, filterItems, totalAu } from "./academy-plan.ts";

const raw = (o: Partial<RawSession>): RawSession => ({
  id: "s1", team_id: "t1", type: "academy", title: "Shooting", starts_at: "2026-11-17T17:00:00Z",
  planned_duration_min: 90, planned_rpe: 6, status: "planned", location: null, ...o,
});

test("week bounds use Amsterdam midnights (winter)", () => {
  const b = weekBoundsUtc("2026-11-16");
  assert.equal(b.from, "2026-11-15T23:00:00.000Z");
  assert.equal(b.to, "2026-11-22T23:00:00.000Z");
});

test("week bounds across the October DST change are 7 days + 1 hour", () => {
  const b = weekBoundsUtc("2026-10-19");
  assert.equal(b.from, "2026-10-18T22:00:00.000Z");
  assert.equal(b.to, "2026-10-25T23:00:00.000Z");
});

test("week bounds in summer", () => {
  assert.equal(weekBoundsUtc("2026-06-01").from, "2026-05-31T22:00:00.000Z");
});

test("weekDayList is Mon..Sun", () => {
  const d = weekDayList("2026-11-16");
  assert.equal(d.length, 7);
  assert.equal(d[0], "2026-11-16");
  assert.equal(d[6], "2026-11-22");
});

test("Amsterdam day and time near midnight", () => {
  assert.equal(amsterdamDay("2026-11-16T23:30:00Z"), "2026-11-17");
  assert.equal(amsterdamTime("2026-11-16T23:30:00Z"), "00:30");
  assert.equal(amsterdamDay("2026-07-01T21:59:00Z"), "2026-07-01");
  assert.equal(amsterdamDay("2026-07-01T22:00:00Z"), "2026-07-02");
});

test("plannedAu needs both values", () => {
  assert.equal(plannedAu(90, 6), 540);
  assert.equal(plannedAu(60, null), null);
  assert.equal(plannedAu(null, 5), null);
  assert.equal(plannedAu(0, 5), null);
});

test("type groups and colours", () => {
  assert.equal(typeGroup("gym"), "gym");
  assert.equal(typeGroup("match"), "match");
  for (const t of ["academy", "evening", "other"]) assert.equal(typeGroup(t), "basketball");
  assert.equal(colorOf("gym"), GROUP_COLOR.gym);
  assert.notEqual(colorOf("gym"), colorOf("match"));
});

test("groupByDay sorts, keeps empty days and ignores outside days", () => {
  const days = weekDayList("2026-11-16");
  const items = [
    toPlanItem(raw({ id: "b", starts_at: "2026-11-17T18:00:00Z" }), "B"),
    toPlanItem(raw({ id: "a", starts_at: "2026-11-17T09:00:00Z" }), "A"),
    toPlanItem(raw({ id: "x", starts_at: "2026-11-30T09:00:00Z" }), "A"),
  ];
  const g = groupByDay(items, days);
  assert.deepEqual(g["2026-11-17"].map((i) => i.id), ["a", "b"]);
  assert.deepEqual(g["2026-11-16"], []);
  assert.equal(Object.keys(g).length, 7);
});

test("defaultDay prefers today, then first day with sessions", () => {
  const days = weekDayList("2026-11-16");
  const g = groupByDay([toPlanItem(raw({ starts_at: "2026-11-19T17:00:00Z" }), "A")], days);
  assert.equal(defaultDay(days, "2026-11-18", g), "2026-11-18");
  assert.equal(defaultDay(days, "2026-12-01", g), "2026-11-19");
  assert.equal(defaultDay(days, "2026-12-01", groupByDay([], days)), "2026-11-16");
});

test("filters and totals", () => {
  const items = [
    toPlanItem(raw({ id: "1", team_id: "t1", type: "gym" }), "A"),
    toPlanItem(raw({ id: "2", team_id: "t2", type: "match" }), "B"),
    toPlanItem(raw({ id: "3", team_id: "t2", type: "academy", status: "cancelled" }), "B"),
  ];
  assert.equal(filterItems(items, new Set(), new Set()).length, 3);
  assert.deepEqual(filterItems(items, new Set(["t2"]), new Set()).map((i) => i.id), ["2", "3"]);
  assert.deepEqual(filterItems(items, new Set(["t2"]), new Set(["match" as const])).map((i) => i.id), ["2"]);
  assert.equal(totalAu(items), 1080);
});
