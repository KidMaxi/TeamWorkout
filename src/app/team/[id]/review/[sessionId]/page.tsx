import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ClipboardX, Users, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { dateLocale } from "@/lib/i18n";
import type { ExerciseKind } from "@/lib/exercises";
import {
  ReviewBoard,
  type AthleteVM, type BlockVM, type LoggedVM, type RowVM, type SetType, type Side, type Status, type Via,
} from "@/components/ReviewBoard";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEVIATION = 0.15;
const RANK: Record<Status, number> = { inProgress: 0, finished: 1, notStarted: 2, resting: 3 };

const asSetType = (v: unknown): SetType => (v === "warmup" || v === "failure" || v === "drop" ? v : "normal");
const asNum = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const asVia = (v: unknown): Via => (v === "kiosk" || v === "coach" ? v : "self");

type RunSetRow = {
  id: string; run_id: string; exercise_id: string; set_index: number; side: Side;
  weight_kg: number | null; reps: number | null; rpe: number | null; set_type: string;
};

function Calm({ icon: Icon, title, body }: { icon: typeof ClipboardX; title: string; body: string }) {
  return (
    <div className="card card-hero flex flex-col items-start gap-3">
      <span aria-hidden className="grid size-11 place-items-center rounded-full text-[var(--accent)]" style={{ background: "var(--surface-2)" }}>
        <Icon size={20} />
      </span>
      <h2 className="display text-2xl leading-tight">{title}</h2>
      <p className="text-muted">{body}</p>
    </div>
  );
}

export default async function ReviewPage({ params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const { id, sessionId } = await params;
  if (!UUID.test(id) || !UUID.test(sessionId)) notFound();
  const { t, locale } = await getT();
  const loc = dateLocale(locale);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: me } = await supabase
    .from("team_members").select("role").eq("team_id", id).eq("user_id", user.id).maybeSingle();
  if (!me || me.role !== "staff") notFound();

  const { data: session } = await supabase
    .from("sessions").select("id, type, title, starts_at, workout_id").eq("id", sessionId).eq("team_id", id).maybeSingle();
  if (!session || session.type !== "gym") notFound();

  const sessionsHref = `/team/${id}/sessions`;
  const [{ data: workout }, { data: blockRows }, { data: memberRows }, { data: exclusionRows }] = await Promise.all([
    session.workout_id
      ? supabase.from("workouts").select("*").eq("id", session.workout_id).maybeSingle()
      : Promise.resolve({ data: null }),
    session.workout_id
      ? supabase.from("workout_blocks").select("id, position, exercise_id, notes").eq("workout_id", session.workout_id).order("position")
      : Promise.resolve({ data: [] }),
    supabase.from("team_members").select("user_id").eq("team_id", id).eq("role", "athlete"),
    supabase.from("session_exclusions").select("user_id").eq("session_id", sessionId),
  ]);

  const w = (workout ?? {}) as { name?: string | null; title?: string | null };
  const title = (w.name ?? w.title ?? session.title ?? t("review.title")).toString();
  const when = new Date(session.starts_at as string);
  const dateText = `${when.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" })} · ${when.toLocaleTimeString(loc, { timeStyle: "short" })}`;

  const header = (
    <header className="flex flex-col gap-3">
      <Link href={sessionsHref} className="link inline-flex min-h-11 w-fit items-center gap-1">
        <ChevronLeft size={16} aria-hidden />{t("review.back")}
      </Link>
      <div className="flex flex-col gap-1.5">
        <p className="eyebrow">{t("review.title")}</p>
        <h2 className="display text-3xl leading-tight">{title}</h2>
        <p className="text-sm text-muted">{dateText}</p>
      </div>
    </header>
  );

  const blocksRaw = blockRows ?? [];
  if (!workout || !blocksRaw.length) {
    return (
      <div className="stagger flex flex-col gap-4">
        {header}
        <Calm icon={ClipboardX} title={t("review.empty.noWorkout.title")} body={t("review.empty.noWorkout.body")} />
      </div>
    );
  }

  const athleteIds = (memberRows ?? []).map((m) => m.user_id as string);
  if (!athleteIds.length) {
    return (
      <div className="stagger flex flex-col gap-4">
        {header}
        <Calm icon={Users} title={t("review.empty.noAthletes.title")} body={t("review.empty.noAthletes.body")} />
      </div>
    );
  }

  const exerciseIds = [...new Set(blocksRaw.map((b) => b.exercise_id as string))];
  const blockIds = blocksRaw.map((b) => b.id as string);
  const [{ data: setRows }, { data: exerciseRows }, { data: profiles }, { data: runs }, { data: logs }] = await Promise.all([
    supabase.from("workout_sets").select("id, block_id, position, reps, target_rpe, fixed_weight_kg, rest_seconds, set_type")
      .in("block_id", blockIds).order("position"),
    supabase.from("exercises").select("id, name, kind, per_side").in("id", exerciseIds),
    supabase.from("profiles").select("id, full_name").in("id", athleteIds),
    supabase.from("workout_runs").select("id, session_id, user_id, started_at, finished_at, active_seconds, logged_via, logged_by")
      .eq("session_id", sessionId).in("user_id", athleteIds),
    supabase.from("session_logs").select("session_id, user_id, attended, duration_min, rpe, load")
      .eq("session_id", sessionId).in("user_id", athleteIds),
  ]);

  const runIds = (runs ?? []).map((r) => r.id as string);
  const { data: runSetRows } = runIds.length
    ? await supabase.from("run_sets")
        .select("id, run_id, exercise_id, set_index, side, weight_kg, reps, rpe, set_type").in("run_id", runIds)
    : { data: [] };

  const exercise = new Map((exerciseRows ?? []).map((e) => [e.id as string, e]));
  const name = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? ""]));
  const runOf = new Map((runs ?? []).map((r) => [r.user_id as string, r]));
  const logOf = new Map((logs ?? []).map((l) => [l.user_id as string, l]));
  const excluded = new Set((exclusionRows ?? []).map((e) => e.user_id as string));
  const setsOfRun = new Map<string, RunSetRow[]>();
  for (const r of (runSetRows ?? []) as RunSetRow[]) {
    const list = setsOfRun.get(r.run_id) ?? [];
    list.push(r);
    setsOfRun.set(r.run_id, list);
  }

  // The plan once: per block its sets, plus the set_index offset (the same exercise can occur in several blocks).
  type PlanSet = { id: string; type: SetType; reps: number | null; rpe: number | null; kg: number | null };
  type PlanBlock = {
    id: string; letter: string; exerciseId: string; name: string; kind: ExerciseKind; perSide: boolean;
    offset: number; sets: PlanSet[]; last: boolean;
  };
  const planned = new Map<string, number>();
  const plan: PlanBlock[] = [];
  for (const b of blocksRaw) {
    const ex = exercise.get(b.exercise_id as string);
    if (!ex) continue;
    const sets: PlanSet[] = (setRows ?? [])
      .filter((s) => s.block_id === b.id)
      .map((s) => ({
        id: s.id as string,
        type: asSetType(s.set_type),
        reps: asNum(s.reps),
        rpe: asNum(s.target_rpe),
        kg: asNum(s.fixed_weight_kg),
      }));
    const offset = planned.get(ex.id as string) ?? 0;
    planned.set(ex.id as string, offset + sets.length);
    plan.push({
      id: b.id as string, letter: String.fromCharCode(65 + (plan.length % 26)), exerciseId: ex.id as string,
      name: ex.name as string, kind: ex.kind as ExerciseKind, perSide: !!ex.per_side, offset, sets, last: false,
    });
  }
  const lastBlockOf = new Map<string, PlanBlock>();
  for (const b of plan) lastBlockOf.set(b.exerciseId, b);
  for (const b of lastBlockOf.values()) b.last = true;

  const unnamed = t("dashboard.athlete.unnamed");
  const athletes: AthleteVM[] = athleteIds.map((uid) => {
    const run = runOf.get(uid) ?? null;
    const log = logOf.get(uid) ?? null;
    const all = run ? (setsOfRun.get(run.id as string) ?? []) : [];
    const loggedAt = new Map(all.map((s) => [`${s.exercise_id}:${s.set_index}:${s.side ?? ""}`, s]));

    const status: Status = run
      ? (run.finished_at ? "finished" : "inProgress")
      : excluded.has(uid) ? "resting" : "notStarted";

    let plannedWorking = 0;
    const blocks: BlockVM[] = plan.map((b) => {
      const sides: Side[] = b.perSide ? ["left", "right"] : [null];
      const rows: RowVM[] = [];
      const toLogged = (s: RunSetRow): LoggedVM => ({
        id: s.id, weight: asNum(s.weight_kg), reps: asNum(s.reps), rpe: asNum(s.rpe), setType: asSetType(s.set_type),
      });
      b.sets.forEach((ps, i) => {
        const setIndex = b.offset + i + 1;
        for (const side of sides) {
          const hit = loggedAt.get(`${b.exerciseId}:${setIndex}:${side ?? ""}`);
          const logged = hit ? toLogged(hit) : null;
          let dev: RowVM["dev"] = null;
          if (logged && logged.weight !== null && ps.kg !== null && ps.kg > 0) {
            const ratio = (logged.weight - ps.kg) / ps.kg;
            if (ratio >= DEVIATION) dev = "up";
            else if (ratio <= -DEVIATION) dev = "down";
          }
          if (ps.type !== "warmup") plannedWorking += 1;
          rows.push({
            key: `${b.exerciseId}:${setIndex}:${side ?? ""}`, exerciseId: b.exerciseId, setIndex, side, extra: false,
            setType: ps.type, plan: { reps: ps.reps, rpe: ps.rpe, kg: ps.kg }, logged, dev,
          });
        }
      });
      // Extra rounds (no planned set) are shown under the last block of their exercise.
      let nextIndex = (planned.get(b.exerciseId) ?? 0) + 1;
      if (b.last) {
        const total = planned.get(b.exerciseId) ?? 0;
        const extras = all
          .filter((s) => s.exercise_id === b.exerciseId && s.set_index > total)
          .sort((a, c) => a.set_index - c.set_index || (a.side === "left" ? -1 : 1) - (c.side === "left" ? -1 : 1));
        for (const s of extras) {
          nextIndex = Math.max(nextIndex, s.set_index + 1);
          rows.push({
            key: `${b.exerciseId}:${s.set_index}:${s.side ?? ""}`, exerciseId: b.exerciseId, setIndex: s.set_index,
            side: s.side, extra: true, setType: asSetType(s.set_type), plan: null, logged: toLogged(s), dev: null,
          });
        }
      }
      return {
        key: b.id, letter: b.letter, exerciseId: b.exerciseId, name: b.name, kind: b.kind, perSide: b.perSide,
        last: b.last, nextIndex, rows,
      };
    });

    const working = all.filter((s) => asSetType(s.set_type) !== "warmup");
    const tonnage = working.reduce((sum, s) => sum + (asNum(s.weight_kg) ?? 0) * (asNum(s.reps) ?? 0), 0);
    const activeMin = run?.finished_at ? Math.max(1, Math.round(Number(run.active_seconds ?? 0) / 60)) : null;

    return {
      id: uid,
      name: name.get(uid) || unnamed,
      status,
      runId: (run?.id as string | undefined) ?? null,
      via: run ? asVia(run.logged_via) : null,
      durationMin: asNum(log?.duration_min),
      rpe: asNum(log?.rpe),
      suggestedMin: activeMin,
      workingDone: working.length,
      workingPlanned: plannedWorking,
      tonnage,
      blocks,
    };
  });

  athletes.sort((a, b) => RANK[a.status] - RANK[b.status] || a.name.localeCompare(b.name, loc));

  const count = (s: Status) => athletes.filter((a) => a.status === s).length;
  const teamTonnage = athletes.reduce((sum, a) => sum + a.tonnage, 0);
  const rpes = [...logOf.values()].map((l) => asNum(l.rpe)).filter((v): v is number => v !== null);
  const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
  const fmt = (n: number, digits = 0) => n.toLocaleString(loc, { maximumFractionDigits: digits, minimumFractionDigits: digits });
  const nobodyStarted = athletes.every((a) => a.runId === null);

  const tiles: { label: string; value: string; unit?: string; accent?: boolean }[] = [
    { label: t("review.summary.finished"), value: fmt(count("finished")) },
    { label: t("review.summary.inProgress"), value: fmt(count("inProgress")), accent: true },
    { label: t("review.summary.notStarted"), value: fmt(count("notStarted")) },
    { label: t("review.summary.resting"), value: fmt(count("resting")) },
    { label: t("review.summary.tonnage"), value: fmt(teamTonnage), unit: t("review.unit.kg") },
    { label: t("review.summary.rpe"), value: avgRpe === null ? "–" : fmt(avgRpe, 1) },
  ];

  return (
    <div className="stagger flex flex-col gap-4">
      {header}
      <section aria-label={t("review.summary.label")} className="card card-hero">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
          {tiles.map((x) => (
            <div key={x.label} className="flex min-w-0 flex-col gap-1.5">
              <dt className="eyebrow">{x.label}</dt>
              <dd className={`num text-3xl ${x.accent ? "text-[var(--primary)]" : ""}`}>
                {x.value}
                {x.unit && <span className="ml-1 text-sm font-semibold text-muted">{x.unit}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      {nobodyStarted && (
        <Calm icon={Zap} title={t("review.empty.nobody.title")} body={t("review.empty.nobody.body")} />
      )}
      <ReviewBoard teamId={id} sessionId={sessionId} athletes={athletes} />
    </div>
  );
}
