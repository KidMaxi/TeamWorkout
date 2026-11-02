import test from "node:test";
import assert from "node:assert/strict";
import type { QueueOp, QueueApi } from "./sync-queue.ts";
// @ts-expect-error node needs the .ts extension; tsconfig does not allow it
import { enqueue, flush } from "./sync-queue.ts";

const save = (key: string, reps = 5): QueueOp => ({
  kind: "save", key, display: { weight: "60", reps: String(reps), rpe: "8" },
  payload: { exerciseId: "e", setId: null, setIndex: 1, side: null, weight: 60, reps, rpe: 8 },
});
const del = (key: string): QueueOp => ({ kind: "delete", key, exerciseId: "e", setIndex: 1, side: null });
const fin: QueueOp = { kind: "finish", durationMin: 50, rpe: 7 };

test("enqueue: newest write per row wins", () => {
  const q = enqueue(enqueue([], save("a", 5)), save("a", 8));
  assert.equal(q.length, 1);
  assert.equal((q[0] as Extract<QueueOp, { kind: "save" }>).payload.reps, 8);
});
test("enqueue: delete replaces an earlier save of the same row", () => {
  const q = enqueue(enqueue([], save("a")), del("a"));
  assert.deepEqual(q.map((o) => o.kind), ["delete"]);
});
test("enqueue: finish stays last and is not duplicated", () => {
  let q = enqueue([], save("a"));
  q = enqueue(q, fin);
  q = enqueue(q, save("b"));
  q = enqueue(q, { ...fin, durationMin: 60 });
  assert.deepEqual(q.map((o) => o.kind), ["save", "save", "finish"]);
  assert.equal((q[2] as Extract<QueueOp, { kind: "finish" }>).durationMin, 60);
});

const okApi = (log: string[]): QueueApi => ({
  saveSet: async (p) => (log.push(`save${p.reps}`), { ok: true }),
  deleteSet: async () => (log.push("del"), { ok: true }),
  finish: async () => (log.push("fin"), { ok: true }),
});

test("flush: sends everything in order", async () => {
  const log: string[] = [];
  const r = await flush([save("a", 1), save("b", 2), fin], okApi(log));
  assert.deepEqual(log, ["save1", "save2", "fin"]);
  assert.equal(r.remaining.length, 0);
  assert.equal(r.applied.length, 3);
});
test("flush: stops at the first network failure and keeps the rest", async () => {
  let n = 0;
  const api: QueueApi = { ...okApi([]), saveSet: async () => { if (++n === 2) throw new Error("offline"); return { ok: true }; } };
  const r = await flush([save("a"), save("b"), save("c"), fin], api);
  assert.equal(r.applied.length, 1);
  assert.deepEqual(r.remaining.map((o) => o.kind), ["save", "save", "finish"]);
});
test("flush: a server refusal is dropped and reported, the rest continues", async () => {
  const api: QueueApi = { ...okApi([]), saveSet: async (p) => (p.reps === 1 ? { ok: false, error: "run.error.reps" } : { ok: true }) };
  const r = await flush([save("a", 1), save("b", 2)], api);
  assert.equal(r.rejected.length, 1);
  assert.equal(r.rejected[0].error, "run.error.reps");
  assert.equal(r.applied.length, 1);
  assert.equal(r.remaining.length, 0);
});
test("flush: finish that was already finished counts as delivered", async () => {
  const api: QueueApi = { ...okApi([]), finish: async () => ({ ok: false, error: "run.error.finished" }) };
  const r = await flush([fin], api);
  assert.equal(r.applied.length, 1);
  assert.equal(r.rejected.length, 0);
});
