import test from "node:test";
import assert from "node:assert/strict";
import type { DaySession, ActualLog } from "./workload-day.ts";
// @ts-expect-error node needs the .ts extension; tsconfig does not allow it
import { plannedLoad, buildDays, dayWarnings, baselineDeviation, planVsActual, topContributors, DEFAULT_SETTINGS, settingsFromRow } from "./workload-day.ts";

const S = (id: string, startsAt: string, o: Partial<DaySession> = {}): DaySession => ({
  id, type: "academy", startsAt, durationMin: 60, plannedRpe: 5, status: "planned", excluded: false, ...o,
});
const L = (sessionId: string, rpe: number, durationMin: number, o: Partial<ActualLog> = {}): ActualLog => ({
  sessionId, attended: true, durationMin, rpe, load: rpe * durationMin, ...o,
});
const WEEK = ["2026-06-08", "2026-06-09", "2026-06-10", "2026-06-11", "2026-06-12", "2026-06-13", "2026-06-14"];
const SET = DEFAULT_SETTINGS;
const ctx = (o: Record<string, unknown> = {}) => ({ weeklyActual: 0, previousWeeks: [] as number[], missingCheckin: false, pain: false, ...o });

test("plannedLoad: rpe x minutes, null without rpe, nothing when cancelled or excluded", () => {
  assert.equal(plannedLoad(S("a", "2026-06-09T16:00:00Z", { plannedRpe: 6, durationMin: 90 })), 540);
  assert.equal(plannedLoad(S("a", "2026-06-09T16:00:00Z", { plannedRpe: null })), null);
  assert.equal(plannedLoad(S("a", "2026-06-09T16:00:00Z", { status: "cancelled" })), null);
  assert.equal(plannedLoad(S("a", "2026-06-09T16:00:00Z", { excluded: true })), null);
  assert.equal(plannedLoad(S("a", "2026-06-09T16:00:00Z", { status: "adjusted" })), 300);
});

test("buildDays: planned and actual stay separate, multiple sessions per day are summed", () => {
  const sessions = [
    S("a", "2026-06-09T08:00:00Z", { plannedRpe: 6, durationMin: 60 }),
    S("b", "2026-06-09T16:00:00Z", { plannedRpe: 4, durationMin: 30 }),
    S("c", "2026-06-11T16:00:00Z", { plannedRpe: null }),
  ];
  const logs = [L("a", 8, 70)];
  const days = buildDays(WEEK, sessions, logs, SET);
  assert.equal(days.length, 7);
  const tue = days[1];
  assert.equal(tue.sessions, 2);
  assert.equal(tue.planned, 360 + 120);
  assert.equal(tue.actual, 560);
  assert.equal(tue.entries[0].planned, 360);
  assert.equal(tue.entries[0].actual, 560);
  assert.equal(tue.entries[1].actual, null);
  assert.equal(tue.entries[0].share, 1); // only logged session carries the actual
  const thu = days[3];
  assert.equal(thu.sessions, 1);
  assert.equal(thu.planned, 0);
  assert.equal(thu.actual, 0);
  assert.equal(days[0].sessions, 0);
});

test("buildDays: share falls back to planned when nothing is logged", () => {
  const days = buildDays(WEEK, [S("a", "2026-06-09T08:00:00Z", { plannedRpe: 6 }), S("b", "2026-06-09T12:00:00Z", { plannedRpe: 2 })], [], SET);
  assert.equal(days[1].entries[0].share, 0.75);
  assert.equal(days[1].entries[1].share, 0.25);
});

test("buildDays: cancelled and excluded sessions contribute nothing", () => {
  const sessions = [
    S("a", "2026-06-09T08:00:00Z", { status: "cancelled", plannedRpe: 9 }),
    S("b", "2026-06-09T12:00:00Z", { excluded: true, plannedRpe: 9 }),
    S("c", "2026-06-09T16:00:00Z"),
  ];
  const d = buildDays(WEEK, sessions, [L("a", 9, 60), L("b", 9, 60)], SET)[1];
  assert.equal(d.sessions, 1);
  assert.equal(d.actual, 0);
  assert.equal(d.heavySessions, 0);
});

test("buildDays: heavy uses logged RPE over planned; not attended is never heavy", () => {
  const sessions = [
    S("a", "2026-06-09T08:00:00Z", { plannedRpe: 5 }), // planned light, logged 8 -> heavy
    S("b", "2026-06-10T08:00:00Z", { plannedRpe: 8 }), // planned heavy, logged 5 -> not heavy
    S("c", "2026-06-11T08:00:00Z", { plannedRpe: 9 }), // not attended
    S("d", "2026-06-12T08:00:00Z", { plannedRpe: 7 }), // boundary, no log -> heavy
    S("e", "2026-06-13T08:00:00Z", { plannedRpe: 6.9 }),
  ];
  const logs = [L("a", 8, 60), L("b", 5, 60), L("c", 0, 0, { attended: false, rpe: null, durationMin: null, load: 0 })];
  const d = buildDays(WEEK, sessions, logs, SET);
  assert.deepEqual(d.map((x) => x.heavySessions), [0, 1, 0, 0, 1, 0, 0]);
  assert.equal(d[3].actual, 0);
  assert.equal(d[3].sessions, 1);
});

test("buildDays: Amsterdam local days across the DST change (29 March 2026)", () => {
  const days = ["2026-03-27", "2026-03-28", "2026-03-29", "2026-03-30"];
  const sessions = [
    S("a", "2026-03-28T23:30:00Z"), // 00:30 CET on the 29th
    S("b", "2026-03-29T21:30:00Z"), // 23:30 CEST on the 29th
    S("c", "2026-03-29T22:30:00Z"), // 00:30 CEST on the 30th
    S("d", "2026-03-28T22:30:00Z"), // 23:30 CET on the 28th
  ];
  const d = buildDays(days, sessions, [], SET);
  assert.deepEqual(d.map((x) => x.sessions), [0, 1, 2, 1]);
  assert.equal(d[2].entries.map((e) => e.sessionId).join(), "a,b");
});

test("buildDays: autumn DST change (25 October 2026)", () => {
  const days = ["2026-10-24", "2026-10-25", "2026-10-26"];
  const d = buildDays(days, [S("a", "2026-10-24T22:30:00Z"), S("b", "2026-10-25T22:30:00Z"), S("c", "2026-10-25T23:30:00Z")], [], SET);
  // 00:30 CEST on the 25th; 23:30 CET on the 25th; 00:30 CET on the 26th
  assert.deepEqual(d.map((x) => x.sessions), [0, 2, 1]);
});

test("stackedHeavyDay at the heavyPerDay boundary", () => {
  const two = [S("a", "2026-06-09T08:00:00Z", { plannedRpe: 7 }), S("b", "2026-06-09T16:00:00Z", { plannedRpe: 8 })];
  const days = buildDays(WEEK, two, [], SET);
  const w = dayWarnings(days, two, SET, ctx());
  assert.deepEqual(w.filter((x) => x.kind === "stackedHeavyDay"), [{ kind: "stackedHeavyDay", day: "2026-06-09", detail: 2 }]);
  const one = two.slice(0, 1);
  assert.equal(dayWarnings(buildDays(WEEK, one, [], SET), one, SET, ctx()).length, 0);
  const set3 = { ...SET, heavyPerDay: 3 };
  assert.equal(dayWarnings(buildDays(WEEK, two, [], set3), two, set3, ctx()).length, 0);
});

test("consecutiveHeavyDays: runs, boundary and gaps", () => {
  const heavy = (id: string, day: string) => S(id, `${day}T16:00:00Z`, { plannedRpe: 8 });
  const run3 = [heavy("a", "2026-06-08"), heavy("b", "2026-06-09"), heavy("c", "2026-06-10")];
  let w = dayWarnings(buildDays(WEEK, run3, [], SET), run3, SET, ctx());
  assert.deepEqual(w, [{ kind: "consecutiveHeavyDays", day: "2026-06-08", detail: 3 }]);
  const run2 = run3.slice(0, 2);
  assert.equal(dayWarnings(buildDays(WEEK, run2, [], SET), run2, SET, ctx()).length, 0);
  const gap = [heavy("a", "2026-06-08"), heavy("b", "2026-06-09"), heavy("c", "2026-06-11")];
  assert.equal(dayWarnings(buildDays(WEEK, gap, [], SET), gap, SET, ctx()).length, 0);
  const long = [8, 9, 10, 11, 12].map((d) => heavy(`s${d}`, `2026-06-${String(d).padStart(2, "0")}`));
  w = dayWarnings(buildDays(WEEK, long, [], SET), long, SET, ctx());
  assert.deepEqual(w, [{ kind: "consecutiveHeavyDays", day: "2026-06-08", detail: 5 }]);
  // two separate runs, a light day in between breaks the run
  const light = [heavy("a", "2026-06-08"), heavy("b", "2026-06-09"), S("x", "2026-06-10T16:00:00Z", { plannedRpe: 3 }), heavy("c", "2026-06-11"), heavy("d", "2026-06-12")];
  assert.equal(dayWarnings(buildDays(WEEK, light, [], SET), light, SET, ctx()).length, 0);
  const set2 = { ...SET, consecutiveHeavyDays: 2 };
  w = dayWarnings(buildDays(WEEK, light, [], set2), light, set2, ctx());
  assert.equal(w.length, 2);
});

test("consecutiveHeavyDays: a non-adjacent day list is not treated as a run", () => {
  const sessions = [S("a", "2026-06-08T16:00:00Z", { plannedRpe: 8 }), S("b", "2026-06-10T16:00:00Z", { plannedRpe: 8 })];
  const d = buildDays(["2026-06-08", "2026-06-10"], sessions, [], { ...SET, consecutiveHeavyDays: 2 });
  assert.equal(dayWarnings(d, sessions, { ...SET, consecutiveHeavyDays: 2 }, ctx()).length, 0);
});

test("overlap: partial, contained, touching and cancelled/excluded", () => {
  const warn = (ss: DaySession[]) => dayWarnings(buildDays(WEEK, ss, [], SET), ss, SET, ctx()).filter((x) => x.kind === "overlap");
  const partial = warn([S("a", "2026-06-10T16:00:00Z"), S("b", "2026-06-10T16:30:00Z")]);
  assert.equal(partial.length, 1);
  assert.equal(partial[0].day, "2026-06-10");
  assert.equal(partial[0].detail, Date.parse("2026-06-10T16:30:00Z"));
  assert.equal(warn([S("a", "2026-06-10T16:00:00Z", { durationMin: 120 }), S("b", "2026-06-10T16:30:00Z", { durationMin: 15 })]).length, 1);
  assert.equal(warn([S("a", "2026-06-10T16:00:00Z"), S("b", "2026-06-10T17:00:00Z")]).length, 0); // touching
  assert.equal(warn([S("a", "2026-06-10T16:00:00Z"), S("b", "2026-06-10T16:30:00Z", { status: "cancelled" })]).length, 0);
  assert.equal(warn([S("a", "2026-06-10T16:00:00Z"), S("b", "2026-06-10T16:30:00Z", { excluded: true })]).length, 0);
  // three at once: one warning per overlapping start
  assert.equal(warn([S("a", "2026-06-10T16:00:00Z", { durationMin: 120 }), S("b", "2026-06-10T16:30:00Z"), S("c", "2026-06-10T17:00:00Z")]).length, 2);
});

test("baselineDeviation: mean of previous weeks with load, needs two, flags at the threshold", () => {
  assert.deepEqual(baselineDeviation(100, [], SET), { baseline: null, deviationPct: null, flagged: false });
  assert.deepEqual(baselineDeviation(100, [100], SET), { baseline: null, deviationPct: null, flagged: false });
  assert.deepEqual(baselineDeviation(100, [100, 0, 0, 0], SET), { baseline: null, deviationPct: null, flagged: false }); // zero weeks ignored
  assert.deepEqual(baselineDeviation(142, [100, 100, 100, 100], SET), { baseline: 100, deviationPct: 42, flagged: true });
  assert.deepEqual(baselineDeviation(130, [100, 100], SET), { baseline: 100, deviationPct: 30, flagged: true }); // boundary
  assert.equal(baselineDeviation(129, [100, 100], SET).flagged, false);
  assert.deepEqual(baselineDeviation(70, [100, 100], SET), { baseline: 100, deviationPct: -30, flagged: true }); // lower counts too
  assert.equal(baselineDeviation(110, [100, 100, 0, 100], SET).baseline, 100);
  // only the newest baselineWeeks are used (newest first)
  assert.equal(baselineDeviation(100, [100, 100, 400, 400], { ...SET, baselineWeeks: 2 }).baseline, 100);
  assert.equal(baselineDeviation(100, [100, 100, 400, 400], SET).baseline, 250);
  assert.equal(baselineDeviation(100, [100, 100], { ...SET, deviationPct: 10, baselineWeeks: 4 }).flagged, false);
});

test("dayWarnings: deviation, check-in and pain are separate lines", () => {
  const w = dayWarnings(buildDays(WEEK, [], [], SET), [], SET, ctx({ weeklyActual: 142, previousWeeks: [100, 100, 100, 100], missingCheckin: true, pain: true }));
  assert.deepEqual(w, [
    { kind: "deviation", day: null, detail: 42 },
    { kind: "missingCheckin", day: null },
    { kind: "pain", day: null },
  ]);
  // nothing logged this week: no 'deviation' warning
  assert.equal(dayWarnings([], [], SET, ctx({ weeklyActual: 0, previousWeeks: [100, 100] })).length, 0);
  // not enough history: no deviation
  assert.equal(dayWarnings([], [], SET, ctx({ weeklyActual: 500, previousWeeks: [100] })).length, 0);
});

test("planVsActual", () => {
  const days = buildDays(WEEK, [S("a", "2026-06-09T08:00:00Z", { plannedRpe: 5 }), S("b", "2026-06-10T08:00:00Z", { plannedRpe: 5 })], [L("a", 6, 60)], SET);
  assert.deepEqual(planVsActual(days), { planned: 600, actual: 360, diffPct: -40 });
  assert.deepEqual(planVsActual(buildDays(WEEK, [], [], SET)), { planned: 0, actual: 0, diffPct: null });
  const none = buildDays(WEEK, [S("a", "2026-06-09T08:00:00Z", { plannedRpe: null })], [L("a", 5, 60)], SET);
  assert.deepEqual(planVsActual(none), { planned: 0, actual: 300, diffPct: null });
});

test("topContributors: by actual, else by planned, largest first, limited to n", () => {
  const ss = [
    S("a", "2026-06-09T08:00:00Z", { plannedRpe: 5 }), // 300
    S("b", "2026-06-10T08:00:00Z", { plannedRpe: 8 }), // 480
    S("c", "2026-06-11T08:00:00Z", { plannedRpe: 3 }), // 180
  ];
  const planned = topContributors(buildDays(WEEK, ss, [], SET), 2);
  assert.deepEqual(planned.map((e) => e.sessionId), ["b", "a"]);
  const logged = topContributors(buildDays(WEEK, ss, [L("c", 9, 60), L("a", 2, 30)], SET), 5);
  assert.deepEqual(logged.map((e) => e.sessionId), ["c", "a"]); // b has no actual
  assert.deepEqual(topContributors(buildDays(WEEK, [], [], SET), 3), []);
  assert.deepEqual(topContributors(buildDays(WEEK, ss, [], SET), 0), []);
});

test("DST week: seven local days, load stays on the right day", () => {
  const week = ["2026-03-23", "2026-03-24", "2026-03-25", "2026-03-26", "2026-03-27", "2026-03-28", "2026-03-29"];
  const ss = [S("a", "2026-03-28T23:30:00Z", { plannedRpe: 8 }), S("b", "2026-03-29T21:30:00Z", { plannedRpe: 8 }), S("n", "2026-03-29T22:30:00Z")];
  const d = buildDays(week, ss, [], SET);
  assert.equal(d[6].sessions, 2);
  assert.equal(d[6].heavySessions, 2);
  const w = dayWarnings(d, ss, SET, ctx());
  assert.ok(w.some((x) => x.kind === "stackedHeavyDay" && x.day === "2026-03-29"));
  assert.equal(planVsActual(d).planned, 480 * 2);
});

test("settingsFromRow: missing row means defaults", () => {
  assert.deepEqual(settingsFromRow(null), DEFAULT_SETTINGS);
  assert.deepEqual(settingsFromRow(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(settingsFromRow({ heavy_rpe: "6.5", heavy_per_day: 3, show_ratio: true, baseline_weeks: null }), {
    ...DEFAULT_SETTINGS, heavyRpe: 6.5, heavyPerDay: 3, showRatio: true,
  });
});
