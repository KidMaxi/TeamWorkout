/**
 * Offline queue for the workout runner. Pure logic plus a tiny storage wrapper, so it can be
 * tested without a browser. A call that THROWS (no connection, 5xx) stays queued and is retried;
 * a call that returns { ok: false } was understood and refused by the server, so retrying
 * cannot help and the operation is dropped and reported.
 */
import type { RunResult, RunSetPayload } from "./run-writes.ts";

export type Side = "left" | "right" | null;
/** What the row showed when it was saved, so a reload can restore it. */
export type RowDisplay = { weight: string; reps: string; rpe: string };

export type QueueOp =
  | { kind: "save"; key: string; payload: RunSetPayload; display: RowDisplay }
  | { kind: "delete"; key: string; exerciseId: string; setIndex: number; side: Side }
  | { kind: "finish"; durationMin: number; rpe: number };

export type QueueApi = {
  saveSet: (payload: RunSetPayload) => Promise<RunResult>;
  deleteSet: (exerciseId: string, setIndex: number, side: Side) => Promise<RunResult>;
  finish: (durationMin: number, rpe: number) => Promise<RunResult>;
};

/**
 * Adds an operation. A newer save or delete for the same row replaces the older one (last write wins),
 * a second finish replaces the first, and the finish always stays last.
 */
export function enqueue(queue: readonly QueueOp[], op: QueueOp): QueueOp[] {
  const same = (o: QueueOp) =>
    op.kind === "finish" ? o.kind === "finish" : o.kind !== "finish" && o.key === op.key;
  const rest = queue.filter((o) => !same(o));
  if (op.kind === "finish") return [...rest, op];
  const finish = rest.filter((o) => o.kind === "finish");
  return [...rest.filter((o) => o.kind !== "finish"), op, ...finish];
}

export type FlushResult = {
  /** Still to send; non-empty when the connection dropped again. */
  remaining: QueueOp[];
  /** Delivered (or already present on the server). */
  applied: QueueOp[];
  /** Refused by the server. Dropped from the queue. */
  rejected: { op: QueueOp; error: NonNullable<RunResult["error"]> | "run.error.save" }[];
};

async function send(op: QueueOp, api: QueueApi): Promise<RunResult> {
  if (op.kind === "save") return api.saveSet(op.payload);
  if (op.kind === "delete") return api.deleteSet(op.exerciseId, op.setIndex, op.side);
  return api.finish(op.durationMin, op.rpe);
}

/** Sends in order and stops at the first network failure. */
export async function flush(queue: readonly QueueOp[], api: QueueApi): Promise<FlushResult> {
  const applied: QueueOp[] = [];
  const rejected: FlushResult["rejected"] = [];
  for (let i = 0; i < queue.length; i++) {
    const op = queue[i];
    let res: RunResult;
    try {
      res = await send(op, api);
    } catch {
      return { remaining: queue.slice(i), applied, rejected };
    }
    // A finish whose answer got lost on the way is already finished server side: that is success.
    if (res.ok || (op.kind === "finish" && res.error === "run.error.finished")) applied.push(op);
    else rejected.push({ op, error: res.error ?? "run.error.save" });
  }
  return { remaining: [], applied, rejected };
}

// ---- persistence (self-service only; iPad mode keeps the queue in memory because it needs the PIN) ----

const PREFIX = "tw-runq:";
const isOp = (v: unknown): v is QueueOp =>
  !!v && typeof v === "object" && ["save", "delete", "finish"].includes((v as { kind?: string }).kind ?? "");

export function loadQueue(scope: string): QueueOp[] {
  try {
    const raw = window.localStorage.getItem(PREFIX + scope);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isOp) : [];
  } catch {
    return [];
  }
}

export function saveQueue(scope: string, queue: readonly QueueOp[]): void {
  try {
    if (queue.length) window.localStorage.setItem(PREFIX + scope, JSON.stringify(queue));
    else window.localStorage.removeItem(PREFIX + scope);
  } catch {
    /* storage blocked or full: the queue still works for this visit */
  }
}
