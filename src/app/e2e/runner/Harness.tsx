"use client";

import { useMemo, useState } from "react";
import { WorkoutRunner, type RunBlock, type RunnerApi } from "@/components/WorkoutRunner";

const EX = "11111111-1111-4111-8111-111111111111";
const BLOCKS: RunBlock[] = [{
  id: "b1",
  exercise: { id: EX, name: "Back squat", kind: "weight_reps", perSide: false, instructions: "", fiveRmKg: null },
  sets: [1, 2, 3].map((n) => ({ id: `s${n}`, setType: "normal" as const, reps: 5, targetRpe: null, fixedWeightKg: 60, restSeconds: null })),
  indexOffset: 0,
  notes: null,
}];

/** A network call that rejects offline (fetch throws) and on HTTP errors, like a real server action. */
async function call(body: unknown) {
  const r = await fetch("/api/e2e/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error("http " + r.status);
  return r.json();
}

export function Harness({ persist }: { persist: boolean }) {
  const [startedAt] = useState(() => new Date().toISOString());
  const api = useMemo<RunnerApi>(() => ({
    start: () => call({ op: "start" }),
    saveSet: (payload) => call({ op: "save", payload }),
    deleteSet: (exerciseId, setIndex, side) => call({ op: "delete", exerciseId, setIndex, side }),
    finish: (durationMin, rpe) => call({ op: "finish", durationMin, rpe }),
  }), []);
  return (
    <main className="mx-auto max-w-md p-4">
      <WorkoutRunner
        teamId="t" sessionId="e2e-session" sessionsHref="/" workoutName="E2E workout"
        blocks={BLOCKS} saved={[]} prev={[]} startedAt={startedAt} finished={null}
        api={api} queueScope={persist ? "e2e:session" : undefined}
      />
    </main>
  );
}
