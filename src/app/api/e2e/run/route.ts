/**
 * Fake "server" for the offline end-to-end test (e2e/offline-runner.mjs). It only exists when
 * E2E_HARNESS=1; in every normal environment it answers 404. State lives in memory.
 */
import { NextResponse } from "next/server";

type Store = { sets: Record<string, unknown>; finished: unknown; log: string[] };
const g = globalThis as unknown as { __e2eRun?: Store };
const store = (): Store => (g.__e2eRun ??= { sets: {}, finished: null, log: [] });
const off = () => process.env.E2E_HARNESS !== "1";
const key = (ex: string, i: number, side: string | null) => `${ex}:${i}:${side ?? "-"}`;

export async function GET() {
  if (off()) return new NextResponse(null, { status: 404 });
  const s = store();
  return NextResponse.json({ sets: Object.values(s.sets), finished: s.finished, log: s.log });
}

export async function DELETE() {
  if (off()) return new NextResponse(null, { status: 404 });
  g.__e2eRun = { sets: {}, finished: null, log: [] };
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  if (off()) return new NextResponse(null, { status: 404 });
  const s = store();
  const b = (await req.json()) as {
    op: "save" | "delete" | "finish";
    payload?: { exerciseId: string; setIndex: number; side: string | null; reps: number };
    exerciseId?: string; setIndex?: number; side?: string | null;
    durationMin?: number; rpe?: number;
  };
  if (b.op === "save" && b.payload) {
    // reps 99 stands in for "the server refuses this value": a definite answer, not a network error.
    if (b.payload.reps === 99) return NextResponse.json({ ok: false, error: "run.error.reps" });
    s.sets[key(b.payload.exerciseId, b.payload.setIndex, b.payload.side)] = b.payload;
    s.log.push(`save:${b.payload.setIndex}`);
  } else if (b.op === "delete" && b.exerciseId && b.setIndex) {
    delete s.sets[key(b.exerciseId, b.setIndex, b.side ?? null)];
    s.log.push(`delete:${b.setIndex}`);
  } else if (b.op === "finish") {
    if (s.finished) return NextResponse.json({ ok: false, error: "run.error.finished" });
    s.finished = { durationMin: b.durationMin, rpe: b.rpe };
    s.log.push("finish");
  } else return NextResponse.json({ ok: false, error: "run.error.save" });
  return NextResponse.json({ ok: true });
}
