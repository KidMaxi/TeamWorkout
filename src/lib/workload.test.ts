import type { PlannedSession, CheckIn } from "./workload";
import test from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error node needs the .ts extension; tsconfig does not allow it
import { mergeRules, localDay, mondayOf, weekDays, countWeek, checkRules, assessReadiness, assessWeek, NO_RULES, categoryOf } from "./workload.ts";

const R = (o: Record<string, number | null> = {}) => ({ ...NO_RULES, ...o });
const S = (id: string, type: string, startsAt: string) => ({ id, type, startsAt }) as PlannedSession;
const E = (day: string, v: number | number[], extra: Record<string, unknown> = {}) => {
  const [sleep, soreness, fatigue, stress, mood] = Array.isArray(v) ? v : [v, v, v, v, v];
  return { day, sleep, soreness, fatigue, stress, mood, ...extra } as CheckIn;
};
const TODAY = "2026-06-10";

test("categoryOf", () => {
  assert.equal(categoryOf("gym"), "gym");
  assert.equal(categoryOf("match"), "match");
  assert.equal(categoryOf("academy"), "training");
  assert.equal(categoryOf("evening"), "training");
});

test("week math", () => {
  assert.equal(mondayOf("2026-06-08"), "2026-06-08"); // Monday
  assert.equal(mondayOf("2026-06-14"), "2026-06-08"); // Sunday
  assert.equal(mondayOf("2026-06-15"), "2026-06-15");
  assert.equal(mondayOf("2026-01-01"), "2025-12-29"); // across year
  assert.deepEqual(weekDays("2026-06-10"), ["2026-06-08", "2026-06-09", "2026-06-10", "2026-06-11", "2026-06-12", "2026-06-13", "2026-06-14"]);
  // DST change week (29 March 2026) stays 7 distinct days
  const w = weekDays("2026-03-29");
  assert.equal(w[0], "2026-03-23");
  assert.equal(w[6], "2026-03-29");
  assert.equal(new Set(w).size, 7);
});

test("localDay uses Europe/Amsterdam", () => {
  assert.equal(localDay("2026-06-10T12:00:00Z"), "2026-06-10");
  assert.equal(localDay("2026-06-10T21:59:00Z"), "2026-06-10"); // 23:59 CEST
  assert.equal(localDay("2026-06-10T22:00:00Z"), "2026-06-11"); // 00:00 CEST
  assert.equal(localDay("2026-01-15T22:59:00Z"), "2026-01-15"); // 23:59 CET
  assert.equal(localDay("2026-01-15T23:00:00Z"), "2026-01-16"); // 00:00 CET
  assert.equal(localDay("2026-03-28T23:30:00Z"), "2026-03-29"); // 00:30 CET, before the switch
  assert.equal(localDay("2026-12-31T23:30:00Z"), "2027-01-01");
});

test("mergeRules", () => {
  assert.deepEqual(mergeRules(null, null), NO_RULES);
  const team = R({ maxTrainings: 4, maxGym: 2, minRestDays: 1 });
  assert.deepEqual(mergeRules(team, null), team);
  assert.deepEqual(mergeRules(team, {}), team);
  assert.deepEqual(mergeRules(team, { maxTrainings: null, maxGym: undefined }), team);
  assert.deepEqual(mergeRules(team, { maxGym: 0, maxMatches: 1 }), R({ maxTrainings: 4, maxGym: 0, maxMatches: 1, minRestDays: 1 }));
  assert.deepEqual(mergeRules(null, { maxMatches: 2 }), R({ maxMatches: 2 }));
  assert.notEqual(mergeRules(null, null), NO_RULES); // no shared mutable reference
});

test("countWeek basics, exclusions and rest days", () => {
  assert.deepEqual(countWeek([], new Set()), { training: 0, gym: 0, match: 0, total: 0, restDays: 7 });
  const sessions = [
    S("a", "academy", "2026-06-08T17:00:00Z"), // Mon
    S("b", "gym", "2026-06-08T18:00:00Z"), // Mon too
    S("c", "evening", "2026-06-10T17:00:00Z"), // Wed
    S("d", "match", "2026-06-13T12:00:00Z"), // Sat
  ];
  assert.deepEqual(countWeek(sessions, new Set()), { training: 2, gym: 1, match: 1, total: 4, restDays: 4 });
  assert.deepEqual(countWeek(sessions, new Set(["b", "d"])), { training: 2, gym: 0, match: 0, total: 2, restDays: 5 });
  assert.deepEqual(countWeek(sessions, new Set(["a", "b", "c", "d", "zzz"])), { training: 0, gym: 0, match: 0, total: 0, restDays: 7 });
});

test("countWeek: Amsterdam day, not UTC day", () => {
  // Sunday 23:30 UTC in summer = Monday 01:30 local, so it is a Monday session
  const s = [S("a", "academy", "2026-06-07T23:30:00Z"), S("b", "gym", "2026-06-09T10:00:00Z")];
  const c = countWeek(s, new Set());
  assert.equal(c.restDays, 5); // Mon + Tue in one week
  // Sunday 21:30 UTC = Sunday 23:30 local; Monday 22:30 UTC = Tuesday local
  const c2 = countWeek([S("a", "academy", "2026-06-07T21:30:00Z"), S("b", "gym", "2026-06-08T22:30:00Z")], new Set());
  assert.equal(c2.restDays, 6); // earliest week is the one ending Sun 7 June; Tuesday is next week
  assert.equal(c2.total, 2);
});

test("countWeek: rest days only from the earliest week, max 0", () => {
  const all = ["08", "09", "10", "11", "12", "13", "14"].map((d, i) => S(`s${i}`, "academy", `2026-06-${d}T10:00:00Z`));
  assert.equal(countWeek(all, new Set()).restDays, 0);
  assert.equal(countWeek(all, new Set(["s6"])).restDays, 1);
  assert.equal(countWeek([...all, S("n", "gym", "2026-06-15T10:00:00Z")], new Set()).restDays, 0);
});

test("checkRules states", () => {
  const counts = { training: 3, gym: 1, match: 2, total: 6, restDays: 2 };
  assert.deepEqual(checkRules(counts, NO_RULES), []);
  const c = checkRules(counts, R({ maxTrainings: 4, maxGym: 1, maxMatches: 1, minRestDays: 2 }));
  assert.deepEqual(c.map((x: { key: string }) => x.key), ["maxTrainings", "maxGym", "maxMatches", "minRestDays"]);
  assert.deepEqual(c.map((x: { state: string }) => x.state), ["ok", "at", "over", "at"]);
  assert.deepEqual(c[0], { key: "maxTrainings", limit: 4, actual: 3, state: "ok" });
  assert.equal(checkRules(counts, R({ minRestDays: 1 }))[0].state, "ok");
  assert.equal(checkRules(counts, R({ minRestDays: 3 }))[0].state, "over");
  assert.equal(checkRules(counts, R({ maxGym: 0 }))[0].state, "over");
  assert.equal(checkRules({ ...counts, gym: 0 }, R({ maxGym: 0 }))[0].state, "at");
  assert.deepEqual(checkRules(counts, R({ maxMatches: 2 })).map((x: { key: string }) => x.key), ["maxMatches"]);
});

test("readiness: no data, old data", () => {
  const none = { level: "unknown", reasons: ["noRecentData"], average: null, baseline: null, painLocation: null };
  assert.deepEqual(assessReadiness([], TODAY), none);
  assert.deepEqual(assessReadiness([E("2026-06-08", 5)], TODAY), none);
  assert.equal(assessReadiness([E("2026-06-09", 5)], TODAY).level, "good"); // yesterday counts
  assert.equal(assessReadiness([E(TODAY, 5)], TODAY).level, "good");
  assert.equal(assessReadiness([E("2026-06-11", 5)], TODAY).level, "unknown"); // future day is not valid
  assert.equal(assessReadiness([E("2026-06-01", 1, { pain: true })], TODAY).level, "unknown");
});

test("readiness: levels and reasons", () => {
  let r = assessReadiness([E(TODAY, [4, 4, 4, 4, 4])], TODAY);
  assert.deepEqual(r, { level: "good", reasons: [], average: 4, baseline: null, painLocation: null });
  r = assessReadiness([E(TODAY, [2, 4, 4, 4, 4])], TODAY); // avg 3.6, min 2 -> watch
  assert.equal(r.level, "reduced");
  assert.deepEqual(r.reasons, ["sleepLow"]);
  assert.equal(r.average, 3.6);
  r = assessReadiness([E(TODAY, [4, 2, 4, 4, 4])], TODAY);
  assert.deepEqual(r.reasons, ["sorenessHigh"]);
  r = assessReadiness([E(TODAY, [4, 4, 2, 4, 4])], TODAY);
  assert.deepEqual(r.reasons, ["energyLow"]);
  r = assessReadiness([E(TODAY, [4, 4, 4, 2, 4])], TODAY);
  assert.deepEqual(r.reasons, ["stressHigh"]);
  r = assessReadiness([E(TODAY, [4, 4, 4, 4, 2])], TODAY);
  assert.deepEqual(r.reasons, ["moodLow"]);
  r = assessReadiness([E(TODAY, [1, 4, 4, 4, 4])], TODAY); // min 1 -> low
  assert.equal(r.level, "low");
  assert.deepEqual(r.reasons, ["sleepLow"]);
  r = assessReadiness([E(TODAY, [2, 2, 2, 2, 2])], TODAY);
  assert.equal(r.level, "low");
  assert.deepEqual(r.reasons, ["sleepLow", "energyLow", "sorenessHigh", "stressHigh", "moodLow"]);
  r = assessReadiness([E(TODAY, [3, 3, 3, 3, 3])], TODAY); // avg 3.0 < 3.2, min 3 -> watch, no item reason
  assert.equal(r.level, "reduced");
  assert.deepEqual(r.reasons, []);
});

test("readiness: pain", () => {
  let r = assessReadiness([E(TODAY, 5, { pain: true, painLocation: "knee" })], TODAY);
  assert.equal(r.level, "low");
  assert.deepEqual(r.reasons, ["pain"]);
  assert.equal(r.painLocation, "knee");
  r = assessReadiness([E(TODAY, [2, 5, 5, 5, 5], { pain: true })], TODAY);
  assert.deepEqual(r.reasons, ["pain", "sleepLow"]);
  assert.equal(r.painLocation, null);
  r = assessReadiness([E(TODAY, 5, { pain: false, painLocation: "knee" })], TODAY);
  assert.equal(r.level, "good");
  assert.equal(r.painLocation, null);
  // pain only in an older entry does not count
  r = assessReadiness([E(TODAY, 5), E("2026-06-09", 5, { pain: true })], TODAY);
  assert.equal(r.level, "good");
});

const history = (n: number, v: number, start = 9) =>
  Array.from({ length: n }, (_, i) => E(`2026-06-${String(start - i).padStart(2, "0")}`, v));

test("readiness: baseline", () => {
  // 4 older entries: not enough
  let r = assessReadiness([E(TODAY, [4, 3, 4, 4, 3]), ...history(4, 5)], TODAY);
  assert.equal(r.baseline, null);
  assert.ok(!r.reasons.includes("belowBaseline"));
  // 5 older entries at 4.8 avg-> baseline 5, latest 3.6 (<= 4.2) -> belowBaseline
  r = assessReadiness([E(TODAY, [4, 3, 4, 4, 3]), ...history(5, 5)], TODAY);
  assert.equal(r.average, 3.6);
  assert.equal(r.baseline, 5);
  assert.deepEqual(r.reasons, ["belowBaseline"]);
  assert.equal(r.level, "reduced");
  // exactly 0.8 below counts: baseline 5, latest 4.2
  r = assessReadiness([E(TODAY, [5, 4, 4, 4, 4]), ...history(5, 5)], TODAY);
  assert.equal(r.average, 4.2);
  assert.ok(r.reasons.includes("belowBaseline"));
  // 0.6 below does not
  r = assessReadiness([E(TODAY, [5, 5, 4, 4, 4]), ...history(5, 5)], TODAY);
  assert.equal(r.average, 4.4);
  assert.deepEqual(r.reasons, []);
  assert.equal(r.level, "good");
  assert.equal(r.baseline, 5);
  // belowBaseline never lowers a 'low'
  r = assessReadiness([E(TODAY, 5, { pain: true }), ...history(5, 5)], TODAY);
  assert.equal(r.level, "low");
  // baseline is rounded to 1 decimal
  r = assessReadiness([E(TODAY, 5), E("2026-06-09", 4), E("2026-06-08", 4), E("2026-06-07", 4), E("2026-06-06", 4), E("2026-06-05", 5)], TODAY);
  assert.equal(r.baseline, 4.2);
});

test("readiness: declining", () => {
  // 4.4 -> 3.8 -> 3.2 : strictly decreasing (oldest first), drop 1.2
  let r = assessReadiness([E(TODAY, [3, 3, 3, 3, 4]), E("2026-06-09", [4, 4, 4, 4, 3]), E("2026-06-08", [5, 4, 4, 4, 4])], TODAY);
  assert.equal(r.average, 3.2);
  // avgs: 3.2, 3.8, 4.2 -> drop 1.0
  assert.deepEqual(r.reasons, ["declining"]);
  assert.equal(r.level, "reduced");
  // drop too small
  r = assessReadiness([E(TODAY, 4), E("2026-06-09", 4.4), E("2026-06-08", 4.6)], TODAY);
  assert.ok(!r.reasons.includes("declining"));
  // not strictly decreasing
  r = assessReadiness([E(TODAY, 3), E("2026-06-09", 3), E("2026-06-08", 5)], TODAY);
  assert.ok(!r.reasons.includes("declining"));
  // improving
  r = assessReadiness([E(TODAY, 5), E("2026-06-09", 4), E("2026-06-08", 3)], TODAY);
  assert.ok(!r.reasons.includes("declining"));
  // oldest of the three older than 4 days
  r = assessReadiness([E(TODAY, 3), E("2026-06-09", 4), E("2026-06-06", 5)], TODAY);
  assert.ok(!r.reasons.includes("declining"));
  // exactly 3 days back is still inside the window
  r = assessReadiness([E(TODAY, 3.4), E("2026-06-09", 4), E("2026-06-07", 4.5)], TODAY);
  assert.ok(r.reasons.includes("declining"));
  assert.equal(r.level, "reduced");
  // fewer than three entries
  r = assessReadiness([E(TODAY, 3), E("2026-06-09", 5)], TODAY);
  assert.ok(!r.reasons.includes("declining"));
});

test("readiness: declining raises good to reduced", () => {
  const r = assessReadiness([E(TODAY, [4, 4, 4, 3, 3]), E("2026-06-09", [5, 5, 4, 4, 4]), E("2026-06-08", 5)], TODAY);
  // avgs 3.6, 4.4, 5 -> drop 1.4 ; latest watch? min 3, avg 3.6 -> ok
  assert.deepEqual(r.reasons, ["declining"]);
  assert.equal(r.level, "reduced");
});

test("reason order and dedupe", () => {
  const r = assessReadiness(
    [E(TODAY, [2, 4, 4, 4, 2], { pain: true }), ...history(5, 5)],
    TODAY,
  );
  assert.deepEqual(r.reasons, ["pain", "sleepLow", "moodLow", "belowBaseline"]);
  assert.equal(new Set(r.reasons).size, r.reasons.length);
});

const rd = (level: string, reasons: string[] = []) => ({ level, reasons, average: null, baseline: null, painLocation: null });
const C = (o = {}) => ({ training: 0, gym: 0, match: 0, total: 0, restDays: 7, ...o });

test("assessWeek status", () => {
  // @ts-expect-error loose test helper
  const a = (c, r, rr) => assessWeek(c, r, rr);
  assert.equal(a(C(), NO_RULES, rd("unknown")).status, "unknown");
  assert.equal(a(C(), NO_RULES, rd("good")).status, "ok");
  assert.equal(a(C(), NO_RULES, rd("reduced")).status, "watch");
  assert.equal(a(C(), R({ maxGym: 2 }), rd("unknown")).status, "ok");
  assert.equal(a(C({ gym: 2, total: 2 }), R({ maxGym: 2 }), rd("good")).status, "watch");
  assert.equal(a(C({ gym: 3, total: 3 }), R({ maxGym: 2 }), rd("good")).status, "over");
  assert.equal(a(C({ gym: 3, total: 3 }), R({ maxGym: 2 }), rd("low")).status, "over");
  assert.equal(a(C({ gym: 1, total: 1 }), R({ maxGym: 2 }), rd("low")).status, "over"); // low + planned sessions
  assert.equal(a(C(), R({ maxGym: 2 }), rd("low")).status, "ok"); // low but nothing planned
  assert.equal(a(C(), NO_RULES, rd("low")).status, "ok");
  assert.equal(a(C({ restDays: 0, training: 7, total: 7 }), R({ minRestDays: 1 }), rd("good")).status, "over");
});

test("assessWeek advice and passthrough", () => {
  // @ts-expect-error loose test helper
  const a = (c, r, rr) => assessWeek(c, r, rr);
  const painful = rd("low", ["pain"]);
  const tired = rd("low", ["sleepLow"]);
  assert.equal(a(C({ training: 1, total: 1 }), NO_RULES, painful).advice, "considerRest");
  assert.equal(a(C({ training: 1, total: 1 }), NO_RULES, tired).advice, "reduceOne");
  assert.equal(a(C(), NO_RULES, painful).advice, "none");
  const red = rd("reduced", ["sleepLow"]);
  assert.equal(a(C({ gym: 2, total: 2 }), R({ maxGym: 2 }), red).advice, "reduceOne"); // at
  assert.equal(a(C({ gym: 3, total: 3 }), R({ maxGym: 2 }), red).advice, "reduceOne"); // over
  assert.equal(a(C({ gym: 1, total: 1 }), R({ maxGym: 2 }), red).advice, "none"); // ok
  assert.equal(a(C({ gym: 1, total: 1 }), NO_RULES, red).advice, "none");
  assert.equal(a(C({ gym: 3, total: 3 }), R({ maxGym: 2 }), rd("good")).advice, "none");
  const res = a(C({ gym: 3, total: 3 }), R({ maxGym: 2 }), painful);
  assert.equal(res.readiness, painful);
  assert.equal(res.checks.length, 1);
});
