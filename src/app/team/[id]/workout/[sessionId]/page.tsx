import Link from "next/link";
import { notFound } from "next/navigation";
import { BedDouble, ClipboardX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Hint } from "@/components/Hint";
import { getT } from "@/lib/i18n/server";
import type { ExerciseKind } from "@/lib/exercises";
import {
  WorkoutRunner,
  type PrevSet, type RunBlock, type RunExercise, type SavedSet, type SetType,
} from "@/components/WorkoutRunner";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREV_RUNS = 30;
const asSetType = (v: unknown): SetType => (v === "warmup" || v === "failure" || v === "drop" ? v : "normal");

function Calm({ icon: Icon, title, body, href, back }: {
  icon: typeof ClipboardX; title: string; body: string; href: string; back: string;
}) {
  return (
    <section className="rise flex flex-col gap-4">
      <div className="card card-hero flex flex-col items-start gap-3">
        <span aria-hidden className="grid size-11 place-items-center rounded-full text-[var(--accent)]" style={{ background: "var(--surface-2)" }}>
          <Icon size={20} />
        </span>
        <h2 className="display text-2xl leading-tight">{title}</h2>
        <p className="text-muted">{body}</p>
        <Link href={href} className="link inline-flex min-h-11 items-center">{back}</Link>
      </div>
    </section>
  );
}

export default async function WorkoutPage({ params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const { id, sessionId } = await params;
  if (!UUID.test(id) || !UUID.test(sessionId)) notFound();
  const { t } = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: me } = await supabase
    .from("team_members").select("role").eq("team_id", id).eq("user_id", user.id).maybeSingle();
  if (!me) notFound();

  const sessionsHref = `/team/${id}/sessions`;
  const { data: session } = await supabase
    .from("sessions").select("id, type, title, workout_id").eq("id", sessionId).eq("team_id", id).maybeSingle();
  if (!session) notFound();

  if (session.type !== "gym" || !session.workout_id) {
    return <Calm icon={ClipboardX} title={t("run.noWorkout.title")} body={t("run.noWorkout.body")} href={sessionsHref} back={t("run.back")} />;
  }

  const { data: excluded } = await supabase
    .from("session_exclusions").select("user_id").eq("session_id", sessionId).eq("user_id", user.id).maybeSingle();
  if (excluded) {
    return <Calm icon={BedDouble} title={t("run.excluded.title")} body={t("run.excluded.body")} href={sessionsHref} back={t("run.back")} />;
  }

  const [{ data: workout }, { data: blockRows }, { data: run }] = await Promise.all([
    supabase.from("workouts").select("*").eq("id", session.workout_id).maybeSingle(),
    supabase.from("workout_blocks").select("id, position, exercise_id, notes").eq("workout_id", session.workout_id).order("position"),
    supabase.from("workout_runs").select("id, started_at, finished_at, active_seconds")
      .eq("session_id", sessionId).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!workout) {
    return <Calm icon={ClipboardX} title={t("run.noWorkout.title")} body={t("run.noWorkout.body")} href={sessionsHref} back={t("run.back")} />;
  }

  const blocksRaw = blockRows ?? [];
  const exerciseIds = [...new Set(blocksRaw.map((b) => b.exercise_id as string))];
  const blockIds = blocksRaw.map((b) => b.id as string);

  const [{ data: setRows }, { data: exerciseRows }, { data: tests }, { data: savedRows }, { data: prevRuns }, { data: log }] =
    await Promise.all([
      blockIds.length
        ? supabase.from("workout_sets").select("id, block_id, position, reps, target_rpe, fixed_weight_kg, rest_seconds, set_type")
            .in("block_id", blockIds).order("position")
        : Promise.resolve({ data: [] }),
      exerciseIds.length
        ? supabase.from("exercises").select("id, name, kind, per_side, instructions").in("id", exerciseIds)
        : Promise.resolve({ data: [] }),
      exerciseIds.length
        ? supabase.from("strength_tests").select("exercise_id, five_rm_kg")
            .eq("user_id", user.id).in("exercise_id", exerciseIds)
            .order("tested_at", { ascending: false }).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      run
        ? supabase.from("run_sets").select("exercise_id, set_index, side, set_id, weight_kg, reps, rpe, set_type").eq("run_id", run.id)
        : Promise.resolve({ data: [] }),
      exerciseIds.length
        ? supabase.from("workout_runs").select("id, finished_at")
            .eq("user_id", user.id).neq("session_id", sessionId).not("finished_at", "is", null)
            .order("finished_at", { ascending: false }).limit(PREV_RUNS)
        : Promise.resolve({ data: [] }),
      run?.finished_at
        ? supabase.from("session_logs").select("duration_min, rpe").eq("session_id", sessionId).eq("user_id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  // Current 5RM = first (latest) test per exercise.
  const fiveRm = new Map<string, number>();
  for (const r of tests ?? []) if (!fiveRm.has(r.exercise_id as string)) fiveRm.set(r.exercise_id as string, Number(r.five_rm_kg));

  const exercises = new Map<string, RunExercise>();
  for (const e of exerciseRows ?? []) {
    exercises.set(e.id as string, {
      id: e.id as string,
      name: e.name as string,
      kind: e.kind as ExerciseKind,
      perSide: !!e.per_side,
      instructions: ((e.instructions as string | null) ?? "").trim(),
      fiveRmKg: fiveRm.get(e.id as string) ?? null,
    });
  }

  const blocks: RunBlock[] = [];
  const planned = new Map<string, number>(); // exercise -> planned sets in earlier blocks (set_index offset)
  for (const b of blocksRaw) {
    const exercise = exercises.get(b.exercise_id as string);
    if (!exercise) continue;
    const sets = (setRows ?? [])
      .filter((s) => s.block_id === b.id)
      .map((s) => ({
        id: s.id as string,
        setType: asSetType(s.set_type),
        reps: s.reps as number | null,
        targetRpe: s.target_rpe === null || s.target_rpe === undefined ? null : Number(s.target_rpe),
        fixedWeightKg: s.fixed_weight_kg === null || s.fixed_weight_kg === undefined ? null : Number(s.fixed_weight_kg),
        restSeconds: s.rest_seconds as number | null,
      }));
    const offset = planned.get(exercise.id) ?? 0;
    planned.set(exercise.id, offset + sets.length);
    const notes = ((b.notes as string | null) ?? "").trim();
    blocks.push({ id: b.id as string, exercise, sets, indexOffset: offset, notes: notes || null });
  }

  const saved: SavedSet[] = (savedRows ?? []).map((r) => ({
    exerciseId: r.exercise_id as string,
    setIndex: r.set_index as number,
    side: (r.side as "left" | "right" | null) ?? null,
    weightKg: r.weight_kg === null ? null : Number(r.weight_kg),
    reps: r.reps === null ? null : Number(r.reps),
    rpe: r.rpe === null ? null : Number(r.rpe),
    setType: asSetType(r.set_type),
  }));

  // Previous values: per exercise/set/side the value from the most recent earlier finished run that has it.
  const prev: PrevSet[] = [];
  const prevRunIds = (prevRuns ?? []).map((r) => r.id as string);
  if (prevRunIds.length) {
    const { data: prevSets } = await supabase
      .from("run_sets").select("run_id, exercise_id, set_index, side, weight_kg, reps, rpe, set_type")
      .in("run_id", prevRunIds).in("exercise_id", exerciseIds);
    const rank = new Map(prevRunIds.map((rid, i) => [rid, i]));
    const best = new Map<string, { rank: number; row: PrevSet }>();
    for (const r of prevSets ?? []) {
      const key = `${r.exercise_id}:${r.set_index}:${r.side ?? ""}`;
      const rk = rank.get(r.run_id as string) ?? Infinity;
      const cur = best.get(key);
      if (cur && cur.rank <= rk) continue;
      best.set(key, {
        rank: rk,
        row: {
          exerciseId: r.exercise_id as string,
          setIndex: r.set_index as number,
          side: (r.side as "left" | "right" | null) ?? null,
          weightKg: r.weight_kg === null ? null : Number(r.weight_kg),
          reps: r.reps === null ? null : Number(r.reps),
          rpe: r.rpe === null ? null : Number(r.rpe),
          setType: asSetType(r.set_type),
        },
      });
    }
    for (const v of best.values()) prev.push(v.row);
  }

  const w = workout as { name?: string | null; title?: string | null };
  const workoutName = (w.name ?? w.title ?? session.title ?? "").toString();

  return (
    <div className="flex flex-col gap-4">
    <Hint id="workout-run" text={t("run.hint.text")} />
    <WorkoutRunner
      teamId={id}
      sessionId={sessionId}
      sessionsHref={sessionsHref}
      workoutName={workoutName}
      blocks={blocks}
      saved={saved}
      prev={prev}
      startedAt={(run?.started_at as string | undefined) ?? null}
      finished={
        run?.finished_at
          ? {
              durationMin: log?.duration_min ?? Math.max(1, Math.round(Number(run.active_seconds ?? 0) / 60)),
              rpe: log?.rpe ?? null,
              sets: saved.filter((s) => s.setType !== "warmup").length,
            }
          : null
      }
    />
    </div>
  );
}
