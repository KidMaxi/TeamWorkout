import test from "node:test";
import assert from "node:assert/strict";
import type { AcademyRow } from "./academy.ts";
// @ts-expect-error node needs the .ts extension; tsconfig does not allow it
import { kpis, dailyTotals, teamSummaries, parseWeekParam, weekNav, currentWeekStart, normalizeDays, avgRound } from "./academy.ts";

const R = (team: string, name: string, days: number[], o: Partial<AcademyRow> = {}): AcademyRow => ({
  team_id: team, team_name: `Team ${team}`, user_id: `${team}-${name}`, full_name: name, jersey_number: null, position: null,
  day_au: days, week_au: days.reduce((a, b) => a + b, 0), sessions: 1, gym_sessions: 0, avg_28d: 0, ...o,
});
const rows = [
  R("b", "Bo", [100, 0, 200, 0, 0, 0, 0], { sessions: 2, gym_sessions: 1 }),
  R("a", "Al", [0, 50, 0, 0, 0, 0, 25]),
  R("b", "Cy", [0, 0, 100, 0, 0, 0, 0]),
];

test("kpis sums and handles empty input", () => {
  assert.deepEqual(kpis(rows), { players: 3, weekAu: 475, sessions: 4, gymSessions: 1 });
  assert.deepEqual(kpis([]), { players: 0, weekAu: 0, sessions: 0, gymSessions: 0 });
});

test("dailyTotals sums per weekday and copes with short arrays", () => {
  assert.deepEqual(dailyTotals(rows), [100, 50, 300, 0, 0, 0, 25]);
  assert.deepEqual(dailyTotals([]), [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(normalizeDays([1.4, 2.6]), [1, 3, 0, 0, 0, 0, 0]);
  assert.deepEqual(normalizeDays(null), [0, 0, 0, 0, 0, 0, 0]);
});

test("teamSummaries: totals, rounded averages, sorted by name", () => {
  const s = teamSummaries(rows);
  assert.deepEqual(s.map((x: { teamId: string }) => x.teamId), ["a", "b"]);
  assert.deepEqual(s[0], { teamId: "a", teamName: "Team a", players: 1, totalAu: 75, avgAu: 75 });
  assert.deepEqual(s[1], { teamId: "b", teamName: "Team b", players: 2, totalAu: 400, avgAu: 200 });
  assert.equal(teamSummaries([R("a", "x", [1, 0, 0, 0, 0, 0, 0]), R("a", "y", [0, 0, 0, 0, 0, 0, 0], { week_au: 0 })])[0].avgAu, 1); // 0.5 rounds up
  assert.deepEqual(teamSummaries([]), []);
  assert.equal(avgRound(5, 0), 0);
});

test("parseWeekParam snaps to Monday and rejects junk", () => {
  assert.equal(parseWeekParam("2026-11-18"), "2026-11-16");
  assert.equal(parseWeekParam("2026-11-16"), "2026-11-16");
  assert.equal(parseWeekParam("2026-11-22"), "2026-11-16");
  assert.equal(parseWeekParam(["2026-11-18", "x"]), "2026-11-16");
  for (const bad of ["2026-02-30", "2026-13-01", "abc", "", undefined, null, 5, "2026-1-1", "1999-01-04"]) assert.equal(parseWeekParam(bad), null);
});

test("weekNav: prev/next, current week and today index in Europe/Amsterdam", () => {
  // Sunday 2026-11-22 23:30 UTC is already Monday 23 Nov in Amsterdam.
  const n = weekNav("2026-11-18", new Date("2026-11-18T10:00:00Z"));
  assert.equal(n.start, "2026-11-16");
  assert.equal(n.end, "2026-11-22");
  assert.equal(n.prev, "2026-11-09");
  assert.equal(n.next, "2026-11-23");
  assert.equal(n.isCurrent, true);
  assert.equal(n.todayIndex, 2);
  const late = weekNav("2026-11-16", new Date("2026-11-22T23:30:00Z"));
  assert.equal(late.isCurrent, false);
  assert.equal(late.thisWeek, "2026-11-23");
  assert.equal(late.todayIndex, -1);
  assert.equal(currentWeekStart(new Date("2026-11-22T23:30:00Z")), "2026-11-23");
  assert.equal(weekNav("2026-03-23", new Date("2026-01-01T12:00:00Z")).next, "2026-03-30"); // across DST
});
