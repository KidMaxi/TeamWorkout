"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Flag, Pause, Play, Plus, SkipForward } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";
import type { ExerciseKind } from "@/lib/exercises";
import { roundToStep, weightFor } from "@/lib/strength";
import { deleteRunSet, finishRun, saveRunSet, startRun } from "@/app/team/[id]/workout/actions";

export type RunExercise = {
  id: string;
  name: string;
  kind: ExerciseKind;
  perSide: boolean;
  instructions: string;
  /** Athlete's current 5RM (latest test), if any. */
  fiveRmKg: number | null;
};
export type SetType = "warmup" | "normal" | "failure" | "drop";
const SET_TYPES: SetType[] = ["warmup", "normal", "failure", "drop"];
export type RunSetPlan = {
  id: string;
  setType: SetType;
  reps: number | null;
  targetRpe: number | null;
  fixedWeightKg: number | null;
  restSeconds: number | null;
};
export type RunBlock = {
  id: string;
  exercise: RunExercise;
  sets: RunSetPlan[];
  /** set_index offset when the same exercise appears in an earlier block. */
  indexOffset: number;
  /** The coach's note for this exercise. */
  notes: string | null;
};
export type SavedSet = {
  exerciseId: string;
  setIndex: number;
  side: "left" | "right" | null;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
  setType: SetType;
};
export type PrevSet = SavedSet;
export type FinishedRun = { durationMin: number; rpe: number | null; sets: number };

type Side = "left" | "right" | null;
type RowDef = {
  key: string;
  exerciseId: string;
  setId: string | null;
  setIndex: number;
  side: Side;
  /** 0-based position within the block (planned sets first, then extra rounds). */
  pos: number;
  extra: boolean;
};
type RowState = { weight: string; reps: string; rpe: string; done: boolean; dirty: boolean; busy: boolean; error: MessageKey | null };

const EMPTY: RowState = { weight: "", reps: "", rpe: "", done: false, dirty: false, busy: false, error: null };
const MAX_EXTRA = 30;
const PLATE_STEP_KG = 2.5;

const typeKey = (exerciseId: string, setIndex: number) => `${exerciseId}:${setIndex}`;
const isWorking = (t: SetType) => t !== "warmup";
const keyOf = (exerciseId: string, setIndex: number, side: Side) => `${exerciseId}:${setIndex}:${side ?? ""}`;
const hasWeight = (k: ExerciseKind) => k === "weight_reps" || k === "weighted_bodyweight";
const hasRpe = (k: ExerciseKind) => k !== "height_cm" && k !== "duration_s";

/** "" -> null (empty), invalid -> NaN, accepts comma or dot. */
function parseNum(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (s === "") return null;
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}
const validWeight = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1000 && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
const validReps = (n: number) => Number.isInteger(n) && n >= 0 && n <= 1000;
const validRpe = (n: number) => Number.isFinite(n) && n >= 5 && n <= 10 && Math.abs(n * 2 - Math.round(n * 2)) < 1e-9;

function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Plan that extra rounds copy: the last working set, else the last set. */
function extraPlan(block: RunBlock): RunSetPlan | null {
  for (let i = block.sets.length - 1; i >= 0; i--) if (isWorking(block.sets[i].setType)) return block.sets[i];
  return block.sets[block.sets.length - 1] ?? null;
}

function buildRows(block: RunBlock, extras: number): RowDef[] {
  const sides: Side[] = block.exercise.perSide ? ["left", "right"] : [null];
  const rows: RowDef[] = [];
  for (let i = 0; i < block.sets.length + extras; i++) {
    const planned = block.sets[i];
    const setIndex = block.indexOffset + i + 1;
    for (const side of sides) {
      rows.push({
        key: keyOf(block.exercise.id, setIndex, side),
        exerciseId: block.exercise.id,
        setId: planned?.id ?? null,
        setIndex,
        side,
        pos: i,
        extra: !planned,
      });
    }
  }
  return rows;
}

const BADGE: Record<SetType, { letter: string | null; bg: string; fg: string }> = {
  warmup: { letter: "W", bg: "var(--warn-bg)", fg: "var(--warn)" },
  failure: { letter: "F", bg: "var(--danger-bg)", fg: "var(--danger)" },
  drop: { letter: "D", bg: "var(--accent-soft)", fg: "var(--accent)" },
  normal: { letter: null, bg: "var(--surface-3)", fg: "var(--foreground)" },
};

function SetBadge({ type, n }: { type: SetType; n: number | undefined }) {
  const b = BADGE[type];
  return (
    <span aria-hidden className="num grid size-9 place-items-center rounded-full text-base" style={{ background: b.bg, color: b.fg }}>
      {type === "normal" ? (n ?? "·") : b.letter}
    </span>
  );
}

/** Coach note under the exercise name; collapsed when long. */
function CoachNote({ text, label, more, less }: { text: string; label: string; more: string; less: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 120 || text.includes("\n");
  return (
    <div className="rounded-2xl border p-3 text-sm" style={{ background: "var(--accent-soft)" }}>
      <p className={`whitespace-pre-line ${long && !expanded ? "line-clamp-2" : ""}`}>
        <span className="font-semibold">{label}</span> {text}
      </p>
      {long && (
        <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="link mt-1 inline-flex min-h-11 items-center">
          {expanded ? less : more}
        </button>
      )}
    </div>
  );
}

export function WorkoutRunner({
  teamId, sessionId, sessionsHref, workoutName, blocks, saved, prev, startedAt: startedAtInit, finished: finishedInit,
}: {
  teamId: string;
  sessionId: string;
  sessionsHref: string;
  workoutName: string;
  blocks: RunBlock[];
  saved: SavedSet[];
  prev: PrevSet[];
  startedAt: string | null;
  finished: FinishedRun | null;
}) {
  const { t, locale } = useT();
  const dec = locale === "nl" ? "," : ".";
  const fmt = (n: number) => String(Math.round(n * 100) / 100).replace(".", dec);

  const [startedAt, setStartedAt] = useState(startedAtInit);
  const [finished, setFinished] = useState(finishedInit);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<MessageKey | null>(null);

  // ---- per-set state, restored from the saved sets ----
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const m: Record<string, RowState> = {};
    for (const s of saved) {
      m[keyOf(s.exerciseId, s.setIndex, s.side)] = {
        ...EMPTY,
        done: true,
        weight: s.weightKg === null ? "" : fmt(s.weightKg),
        reps: s.reps === null ? "" : String(s.reps),
        rpe: s.rpe === null ? "" : fmt(s.rpe),
      };
    }
    return m;
  });
  const [extras, setExtras] = useState<Record<string, number>>(() => {
    // Extra rounds saved earlier belong to the last block of an exercise.
    const m: Record<string, number> = {};
    blocks.forEach((b, i) => {
      if (blocks.slice(i + 1).some((o) => o.exercise.id === b.exercise.id)) return;
      const top = Math.max(0, ...saved.filter((s) => s.exerciseId === b.exercise.id).map((s) => s.setIndex));
      const n = top - (b.indexOffset + b.sets.length);
      if (n > 0) m[b.id] = Math.min(n, MAX_EXTRA);
    });
    return m;
  });
  // Type of extra rounds (planned sets take their type from the plan).
  const [extraTypes, setExtraTypes] = useState<Record<string, SetType>>(() => {
    const planned = new Map<string, number>();
    for (const b of blocks) planned.set(b.exercise.id, (planned.get(b.exercise.id) ?? 0) + b.sets.length);
    const m: Record<string, SetType> = {};
    for (const s of saved) if (s.setIndex > (planned.get(s.exerciseId) ?? 0)) m[typeKey(s.exerciseId, s.setIndex)] = s.setType;
    return m;
  });
  const prevMap = useMemo(() => new Map(prev.map((p) => [keyOf(p.exerciseId, p.setIndex, p.side), p])), [prev]);

  const blockRows = useMemo(() => blocks.map((b) => buildRows(b, extras[b.id] ?? 0)), [blocks, extras]);
  function typeAt(block: RunBlock, pos: number): SetType {
    return block.sets[pos]?.setType ?? extraTypes[typeKey(block.exercise.id, block.indexOffset + pos + 1)] ?? "normal";
  }
  /** Working sets only: warm-ups are shown but never counted. */
  const workingRows = (bi: number) => blockRows[bi].filter((d) => isWorking(typeAt(blocks[bi], d.pos)));
  const totalSets = blocks.reduce((n, _b, bi) => n + workingRows(bi).length, 0);
  const doneSets = blocks.reduce((n, _b, bi) => n + workingRows(bi).filter((d) => rows[d.key]?.done).length, 0);

  const [open, setOpen] = useState(() => {
    const savedKeys = new Set(saved.map((s) => keyOf(s.exerciseId, s.setIndex, s.side)));
    const i = blocks.findIndex((b) => buildRows(b, 0).some((d) => !savedKeys.has(d.key)));
    return i < 0 ? 0 : i;
  });

  // ---- clock: elapsed counts from the stored start; pause only shapes the proposal ----
  const [now, setNow] = useState<number | null>(null);
  const live = !!startedAt && !finished;
  useEffect(() => {
    if (!live) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [live]);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [pausedMs, setPausedMs] = useState(0);
  const startMs = startedAt ? Date.parse(startedAt) : null;
  const elapsedMs = now !== null && startMs !== null ? Math.max(0, now - startMs) : 0;

  function togglePause() {
    const at = Date.now();
    if (pausedAt === null) {
      setPausedAt(at);
    } else {
      setPausedMs((ms) => ms + (at - pausedAt));
      setPausedAt(null);
    }
  }

  // ---- rest timer ----
  const [rest, setRest] = useState<{ end: number; total: number } | null>(null);
  const restLeft = rest && now !== null ? Math.max(0, Math.ceil((rest.end - now) / 1000)) : rest ? rest.total : 0;
  const restActive = !!rest && restLeft > 0;

  // ---- helpers per row ----
  function prescription(block: RunBlock, plan: RunSetPlan | null): number | null {
    const ex = block.exercise;
    if (!plan || !hasWeight(ex.kind)) return null;
    if (plan.fixedWeightKg !== null) return plan.fixedWeightKg;
    if (ex.kind === "weight_reps" && ex.fiveRmKg && plan.reps && plan.targetRpe) {
      return weightFor(ex.fiveRmKg, plan.reps, plan.targetRpe, PLATE_STEP_KG);
    }
    return null;
  }
  /** Plan for a position; failure sets always target RPE 10. */
  function planAt(block: RunBlock, pos: number): RunSetPlan | null {
    const raw = block.sets[pos] ?? extraPlan(block);
    if (!raw) return null;
    return typeAt(block, pos) === "failure" ? { ...raw, targetRpe: 10 } : raw;
  }
  /** Weight to show for a position. `suggested` = derived from another set, not from the plan itself. */
  function rxAt(block: RunBlock, pos: number): { kg: number | null; suggested: boolean } {
    const plan = planAt(block, pos);
    if (!plan || !hasWeight(block.exercise.kind)) return { kg: null, suggested: false };
    const type = typeAt(block, pos);
    const planned = pos < block.sets.length;
    if (type === "warmup" && planned && plan.fixedWeightKg === null && plan.targetRpe === null) {
      const j = block.sets.findIndex((s) => isWorking(s.setType));
      const w = j >= 0 ? prescription(block, planAt(block, j)) : null;
      const kg = w !== null ? roundToStep(w * 0.5, PLATE_STEP_KG) : 0;
      return kg > 0 ? { kg, suggested: true } : { kg: null, suggested: false };
    }
    if (type === "drop" && plan.fixedWeightKg === null && pos > 0) {
      const before = prescription(block, planAt(block, pos - 1));
      const kg = before !== null ? roundToStep(before * 0.8, PLATE_STEP_KG) : 0;
      if (kg > 0) return { kg, suggested: true };
    }
    return { kg: prescription(block, plan), suggested: false };
  }
  function placeholders(block: RunBlock, d: RowDef) {
    const type = typeAt(block, d.pos);
    const plan = planAt(block, d.pos);
    const p = prevMap.get(d.key);
    // Previous values only count for the same class (warm-up vs working).
    const pv = p && isWorking(p.setType) === isWorking(type) ? p : undefined;
    const rx = rxAt(block, d.pos).kg;
    return {
      weight: pv?.weightKg != null ? fmt(pv.weightKg) : rx !== null ? fmt(rx) : "",
      reps: pv?.reps != null ? String(pv.reps) : plan?.reps != null ? String(plan.reps) : "",
      rpe: plan?.targetRpe != null ? fmt(plan.targetRpe) : pv?.rpe != null ? fmt(pv.rpe) : "",
    };
  }
  const patch = (key: string, p: Partial<RowState>) =>
    setRows((r) => ({ ...r, [key]: { ...(r[key] ?? EMPTY), ...p } }));

  function edit(key: string, field: "weight" | "reps" | "rpe", value: string) {
    patch(key, { [field]: value, dirty: true, error: null });
  }

  async function saveRow(block: RunBlock, d: RowDef) {
    const st = rows[d.key] ?? EMPTY;
    if (st.busy) return;
    const kind = block.exercise.kind;
    const ph = placeholders(block, d);
    const eff = (v: string, p: string) => (v.trim() !== "" ? v : p);

    const weight = hasWeight(kind) ? parseNum(eff(st.weight, ph.weight)) : null;
    const reps = parseNum(eff(st.reps, ph.reps));
    const type = typeAt(block, d.pos);
    const rpe = hasRpe(kind) ? (type === "failure" ? 10 : parseNum(eff(st.rpe, ph.rpe))) : null;

    let error: MessageKey | null = null;
    if (hasWeight(kind) && ((weight === null && kind === "weight_reps") || (weight !== null && !validWeight(weight)))) error = "run.error.weight";
    else if (reps === null || !validReps(reps)) error = "run.error.reps";
    else if (rpe !== null && !validRpe(rpe)) error = "run.error.rpe";
    if (error) {
      patch(d.key, { error });
      return;
    }

    patch(d.key, { busy: true, error: null });
    let res: Awaited<ReturnType<typeof saveRunSet>>;
    try {
      res = await saveRunSet(teamId, sessionId, {
        exerciseId: d.exerciseId, setId: d.setId, setIndex: d.setIndex, side: d.side, weight, reps, rpe,
        setType: d.extra ? type : undefined,
      });
    } catch {
      res = { ok: false, error: "run.error.save" };
    }
    if (!res.ok) {
      patch(d.key, { busy: false, error: res.error ?? "run.error.save" });
      return;
    }
    patch(d.key, {
      busy: false, done: true, dirty: false, error: null,
      weight: weight === null ? "" : fmt(weight),
      reps: String(reps),
      rpe: rpe === null ? "" : fmt(rpe),
    });
    const secs = planAt(block, d.pos)?.restSeconds ?? 0;
    if (secs > 0 && d.side !== "left") setRest({ end: Date.now() + secs * 1000, total: secs });
  }

  async function undoRow(block: RunBlock, d: RowDef) {
    const st = rows[d.key];
    if (!st || st.busy) return;
    patch(d.key, { busy: true, error: null });
    let res: Awaited<ReturnType<typeof deleteRunSet>>;
    try {
      res = await deleteRunSet(teamId, sessionId, block.exercise.id, d.setIndex, d.side);
    } catch {
      res = { ok: false, error: "run.error.save" };
    }
    patch(d.key, res.ok ? { busy: false, done: false, dirty: false } : { busy: false, error: res.error ?? "run.error.save" });
  }

  async function begin() {
    if (starting) return;
    setStarting(true);
    setStartError(null);
    let res: Awaited<ReturnType<typeof startRun>>;
    try {
      res = await startRun(teamId, sessionId);
    } catch {
      res = { ok: false, error: "run.error.save" };
    }
    setStarting(false);
    if (!res.ok || !res.startedAt) {
      setStartError(res.error ?? "run.error.save");
      return;
    }
    setStartedAt(res.startedAt);
  }

  // ---- set type sheet (extra rounds only) ----
  const sheetRef = useRef<HTMLDialogElement>(null);
  const [sheet, setSheet] = useState<{ exerciseId: string; setIndex: number; keys: string[] } | null>(null);
  function openSheet(block: RunBlock, d: RowDef) {
    setSheet({
      exerciseId: d.exerciseId,
      setIndex: d.setIndex,
      keys: blockRows[blocks.indexOf(block)].filter((r) => r.setIndex === d.setIndex).map((r) => r.key),
    });
    sheetRef.current?.showModal();
  }
  function pickType(type: SetType) {
    if (sheet) {
      setExtraTypes((m) => ({ ...m, [typeKey(sheet.exerciseId, sheet.setIndex)]: type }));
      // A saved row needs saving again to store the new type.
      setRows((r) => {
        const next = { ...r };
        for (const k of sheet.keys) if (next[k]?.done) next[k] = { ...next[k], dirty: true };
        return next;
      });
    }
    sheetRef.current?.close();
  }

  // ---- finish dialog ----
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [duration, setDuration] = useState("");
  const [rpeLog, setRpeLog] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<MessageKey | null>(null);

  function openFinish() {
    const at = Date.now();
    const active = elapsedMsAt(at) - pausedMs - (pausedAt !== null ? at - pausedAt : 0);
    setDuration(String(Math.min(600, Math.max(1, Math.round(active / 60000)))));
    const rpes = blocks
      .flatMap((b, bi) => workingRows(bi).map((d) => ({ d, type: typeAt(b, d.pos) })))
      .filter(({ d }) => rows[d.key]?.done)
      .map(({ d, type }) => (type === "failure" ? 10 : parseNum(rows[d.key]!.rpe)))
      .filter((n): n is number => n !== null && Number.isFinite(n));
    const mean = rpes.length ? Math.round(rpes.reduce((a, b) => a + b, 0) / rpes.length) : 7;
    setRpeLog(String(Math.min(10, Math.max(1, mean))));
    setFinishError(null);
    dialogRef.current?.showModal();
  }
  function elapsedMsAt(at: number) {
    return startMs === null ? 0 : Math.max(0, at - startMs);
  }

  async function submitFinish(e: React.FormEvent) {
    e.preventDefault();
    if (finishing) return;
    const dur = /^\d{1,3}$/.test(duration.trim()) ? Number(duration.trim()) : NaN;
    const r = /^\d{1,2}$/.test(rpeLog.trim()) ? Number(rpeLog.trim()) : NaN;
    if (!(dur >= 1 && dur <= 600)) return setFinishError("run.error.duration");
    if (!(r >= 1 && r <= 10)) return setFinishError("run.error.rpeLog");
    setFinishing(true);
    setFinishError(null);
    let res: Awaited<ReturnType<typeof finishRun>>;
    try {
      res = await finishRun(teamId, sessionId, dur, r);
    } catch {
      res = { ok: false, error: "run.error.save" };
    }
    setFinishing(false);
    if (!res.ok) return setFinishError(res.error ?? "run.error.save");
    dialogRef.current?.close();
    setFinished({ durationMin: dur, rpe: r, sets: doneSets });
  }

  // ================= render =================
  const header = (
    <div>
      <p className="eyebrow">{t("run.title")}</p>
      <h2 className="display mt-1 text-2xl leading-tight">{workoutName || t("run.title")}</h2>
    </div>
  );

  if (finished) {
    const load = finished.rpe !== null ? finished.durationMin * finished.rpe : null;
    return (
      <section className="rise flex flex-col gap-4">
        {header}
        <div className="card card-hero flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid size-11 place-items-center rounded-full" style={{ background: "var(--ok-bg)", color: "var(--ok)" }}>
              <Check size={22} />
            </span>
            <h3 className="display text-2xl">{t("run.summary.title")}</h3>
          </div>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="eyebrow">{t("run.summary.duration")}</dt>
              <dd className="num mt-1 text-4xl">{finished.durationMin}<span className="ml-1 text-base font-semibold text-muted">{t("run.summary.minutes")}</span></dd>
            </div>
            <div>
              <dt className="eyebrow">{t("run.summary.rpe")}</dt>
              <dd className="num mt-1 text-4xl">{finished.rpe ?? "–"}</dd>
            </div>
            <div>
              <dt className="eyebrow">{t("run.summary.load")}</dt>
              <dd className="num mt-1 text-4xl">{load ?? "–"}</dd>
            </div>
            <div>
              <dt className="eyebrow">{t("run.summary.sets")}</dt>
              <dd className="num mt-1 text-4xl">{finished.sets}</dd>
            </div>
          </dl>
          <p className="text-sm text-muted">{t("run.summary.edit")}</p>
          <Link href={sessionsHref} className="btn btn-primary inline-flex min-h-12 items-center justify-center">{t("run.back")}</Link>
        </div>
      </section>
    );
  }

  if (!startedAt) {
    return (
      <section className="rise flex flex-col gap-4">
        {header}
        <div className="card card-hero flex flex-col gap-4">
          <h3 className="display text-2xl leading-tight">{t("run.start.title")}</h3>
          <p className="text-muted">{t("run.start.body")}</p>
          <ol className="flex flex-col gap-2 text-sm">
            {blocks.map((b, i) => (
              <li key={b.id} className="flex items-center gap-3">
                <span aria-hidden className="num grid size-8 shrink-0 place-items-center rounded-full text-sm" style={{ background: "var(--surface-3)" }}>
                  {String.fromCharCode(65 + (i % 26))}
                </span>
                <span className="min-w-0 truncate">{b.exercise.name}</span>
                <span className="ml-auto shrink-0 text-muted">{b.sets.length}×</span>
              </li>
            ))}
          </ol>
          {startError && <p role="alert" className="text-danger">{t(startError)}</p>}
          <button type="button" onClick={begin} disabled={starting || blocks.length === 0} className="btn btn-primary inline-flex min-h-14 items-center justify-center gap-2 text-lg">
            <Play size={20} aria-hidden />{starting ? t("run.saving") : t("run.start.button")}
          </button>
          <Link href={sessionsHref} className="link inline-flex min-h-11 items-center justify-center">{t("run.back")}</Link>
        </div>
      </section>
    );
  }

  const paused = pausedAt !== null;
  const openSets = totalSets - doneSets;

  return (
    <section className="flex flex-col gap-4">
      {header}

      {/* sticky timer bar */}
      <div className="glass sticky top-2 z-20 flex flex-col gap-2 rounded-3xl p-3">
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <p className="eyebrow">{paused ? t("run.timer.paused") : t("run.timer.label")}</p>
            <p role="timer" aria-label={t("run.timer.label")} className="num mt-1 whitespace-nowrap text-3xl">{now === null ? "–:––" : clock(elapsedMs / 1000)}</p>
          </div>
          <button
            type="button"
            onClick={togglePause}
            aria-pressed={paused}
            aria-label={paused ? t("run.timer.resume") : t("run.timer.pause")}
            title={paused ? t("run.timer.resume") : t("run.timer.pause")}
            className="btn grid size-12 shrink-0 place-items-center !p-0"
          >
            {paused ? <Play size={18} aria-hidden /> : <Pause size={18} aria-hidden />}
          </button>
          <button type="button" onClick={openFinish} className="btn btn-primary inline-flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap">
            <Flag size={16} aria-hidden />{t("run.finish.button")}
          </button>
        </div>
        <p className="text-xs text-muted">{t("run.progress", { done: doneSets, total: totalSets })}</p>
        {restActive && rest && (
          <div className="flex flex-col gap-1.5 border-t pt-2" role="status">
            <div className="flex items-center justify-between gap-2">
              <span className="eyebrow">{t("run.rest.label")}</span>
              <span className="num text-xl">{clock(restLeft)}</span>
              <button type="button" onClick={() => setRest(null)} className="btn inline-flex min-h-11 items-center gap-1.5 text-sm">
                <SkipForward size={14} aria-hidden />{t("run.rest.skip")}
              </button>
            </div>
            <div aria-hidden className="h-1 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (restLeft / rest.total) * 100)}%`, background: "var(--accent)" }} />
            </div>
          </div>
        )}
      </div>

      {/* blocks */}
      <ol className="flex flex-col gap-3">
        {blocks.map((block, bi) => {
          const list = blockRows[bi];
          const working = workingRows(bi);
          const done = working.filter((d) => rows[d.key]?.done).length;
          const complete = list.length > 0 && list.every((d) => rows[d.key]?.done);
          // Numbering skips warm-ups: the first working set is 1.
          const numbers = new Map<number, number>();
          for (const d of list) {
            if (isWorking(typeAt(block, d.pos)) && !numbers.has(d.pos)) numbers.set(d.pos, numbers.size + 1);
          }
          const isOpen = open === bi;
          const letter = String.fromCharCode(65 + (bi % 26));
          const ex = block.exercise;
          const extraCount = extras[block.id] ?? 0;
          const canAdd = extraCount < MAX_EXTRA && !blocks.slice(bi + 1).some((o) => o.exercise.id === ex.id);
          const unit = ex.kind === "height_cm" ? "run.field.cm" : ex.kind === "duration_s" ? "run.field.sec" : "run.field.reps";
          return (
            <li key={block.id} className="card !p-0">
              <h3>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? -1 : bi)}
                  aria-expanded={isOpen}
                  aria-controls={`block-${block.id}`}
                  className="flex min-h-16 w-full items-center gap-3 rounded-[inherit] px-4 py-3 text-left"
                >
                  <span
                    aria-hidden
                    className="num grid size-10 shrink-0 place-items-center rounded-full text-lg"
                    style={complete ? { background: "var(--ok-bg)", color: "var(--ok)" } : { background: "var(--surface-3)" }}
                  >
                    {complete ? <Check size={18} /> : letter}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="eyebrow block">{t("run.block.label", { letter })}</span>
                    <span className="block truncate font-semibold">{ex.name}</span>
                  </span>
                  <span className="num shrink-0 text-lg" aria-label={t("run.progress", { done, total: working.length })}>{done}/{working.length}</span>
                  <ChevronDown size={18} aria-hidden className={`shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
              </h3>

              {isOpen && (
                <div id={`block-${block.id}`} className="flex flex-col gap-3 border-t p-3">
                  {block.notes && <CoachNote text={block.notes} label={t("run.note.label")} more={t("run.note.more")} less={t("run.note.less")} />}

                  <details className="group">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm text-muted [&::-webkit-details-marker]:hidden">
                      {t("run.block.how")}
                      <ChevronDown size={16} aria-hidden className="transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="flex flex-col gap-2 pb-2 text-sm">
                      <p className="whitespace-pre-line">{ex.instructions || t("run.block.noHow")}</p>
                      <p className="text-muted">{t(`exercises.kindHelp.${ex.kind}` as MessageKey)}</p>
                    </div>
                  </details>

                  <ul className="flex flex-col gap-2">
                    {list.map((d) => {
                      const st = rows[d.key] ?? EMPTY;
                      const ph = placeholders(block, d);
                      const type = typeAt(block, d.pos);
                      const { kg: rx, suggested } = rxAt(block, d.pos);
                      const plan = planAt(block, d.pos);
                      const lockRpe = type === "failure";
                      const n = numbers.get(d.pos);
                      const rxText = !plan
                        ? t("run.rx.enter")
                        : ex.kind === "height_cm"
                          ? plan.reps != null ? t("run.rx.cm", { n: plan.reps }) : t("run.rx.enter")
                          : ex.kind === "duration_s"
                            ? plan.reps != null ? t("run.rx.sec", { n: plan.reps }) : t("run.rx.enter")
                            : plan.reps != null && plan.targetRpe != null
                              ? t("run.rx.repsRpe", { reps: plan.reps, rpe: fmt(plan.targetRpe) })
                              : plan.reps != null
                                ? t("run.rx.reps", { reps: plan.reps })
                                : plan.targetRpe != null
                                  ? t("run.rx.rpe", { rpe: fmt(plan.targetRpe) })
                                  : t("run.rx.enter");
                      const typeLabel = t(`run.type.${type}` as MessageKey);
                      const num = t("run.set.label", { n: n ?? 0 });
                      const title = type === "warmup" ? typeLabel : type === "normal" ? num : `${num} · ${typeLabel}`;
                      const setLabel = [
                        title,
                        d.side ? t(d.side === "left" ? "run.set.left" : "run.set.right") : null,
                      ].filter(Boolean).join(" · ");
                      const clean = st.done && !st.dirty;
                      const fields: { name: "weight" | "reps" | "rpe"; label: MessageKey; mode: "decimal" | "numeric" }[] = [];
                      if (hasWeight(ex.kind)) fields.push({ name: "weight", label: ex.kind === "weighted_bodyweight" ? "run.field.addedKg" : "run.field.kg", mode: "decimal" });
                      fields.push({ name: "reps", label: unit, mode: ex.kind === "height_cm" ? "decimal" : "numeric" });
                      if (hasRpe(ex.kind)) fields.push({ name: "rpe", label: lockRpe ? "run.type.failure" : "run.field.rpe", mode: "decimal" });
                      return (
                        <li
                          key={d.key}
                          role="group"
                          aria-label={setLabel}
                          className="flex flex-col gap-2 rounded-2xl border p-3"
                          style={{ background: clean ? "color-mix(in srgb, var(--ok-bg) 45%, var(--surface))" : "var(--surface-2)" }}
                        >
                          <div className="flex items-center gap-2">
                            {d.extra && !st.busy ? (
                              <button
                                type="button"
                                onClick={() => openSheet(block, d)}
                                aria-label={`${t("run.type.change")}: ${typeLabel}`}
                                title={t("run.type.change")}
                                className="grid size-11 shrink-0 place-items-center rounded-full"
                              >
                                <SetBadge type={type} n={n} />
                              </button>
                            ) : (
                              <span className="grid size-11 shrink-0 place-items-center"><SetBadge type={type} n={n} /></span>
                            )}
                            <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
                              <p className="min-w-0 text-sm font-semibold">
                                {setLabel}
                                {d.extra && <span className="chip ml-2">{t("run.set.extra")}</span>}
                              </p>
                              <p className="shrink-0 text-right text-sm text-muted">
                                {rxText}
                                {rx !== null && (
                                  <span className="block">
                                    {suggested && <span className="mr-1 text-xs">{t("run.rx.suggested")}</span>}
                                    <span className="num text-base text-[var(--foreground)]">{t("run.rx.kg", { kg: fmt(rx) })}</span>
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-end gap-2">
                            {fields.map((f) => (
                              <label key={f.name} className="flex min-w-0 flex-1 flex-col gap-1">
                                <span className="eyebrow truncate">{t(f.label)}</span>
                                <input
                                  value={f.name === "rpe" && lockRpe ? "10" : st[f.name]}
                                  onChange={(e) => edit(d.key, f.name, e.target.value)}
                                  readOnly={f.name === "rpe" && lockRpe}
                                  aria-readonly={f.name === "rpe" && lockRpe}
                                  placeholder={ph[f.name]}
                                  inputMode={f.mode}
                                  autoComplete="off"
                                  enterKeyHint="done"
                                  maxLength={7}
                                  aria-label={`${t(f.label)}, ${setLabel}`}
                                  aria-invalid={st.error !== null}
                                  className={`input num min-h-12 w-full text-center text-xl ${f.name === "rpe" && lockRpe ? "opacity-70" : ""}`}
                                />
                              </label>
                            ))}
                            <button
                              type="button"
                              onClick={() => (clean ? undoRow(block, d) : saveRow(block, d))}
                              disabled={st.busy}
                              aria-busy={st.busy}
                              aria-label={clean ? t("run.undo") : st.done ? t("run.saveChanges") : t("run.save")}
                              title={clean ? t("run.undo") : st.done ? t("run.saveChanges") : t("run.save")}
                              className={`grid size-12 shrink-0 place-items-center rounded-full border transition-colors disabled:opacity-60 ${clean ? "" : "btn !p-0"}`}
                              style={clean ? { background: "var(--ok)", color: "var(--background)", borderColor: "transparent" } : undefined}
                            >
                              <Check size={22} aria-hidden className={clean ? "" : "text-[var(--accent)]"} />
                            </button>
                          </div>
                          {st.error && <p role="alert" className="text-sm text-danger">{t(st.error)}</p>}
                        </li>
                      );
                    })}
                  </ul>

                  {canAdd && (
                    <button
                      type="button"
                      onClick={() => setExtras((m) => ({ ...m, [block.id]: (m[block.id] ?? 0) + 1 }))}
                      className="btn inline-flex min-h-12 items-center justify-center gap-2"
                    >
                      <Plus size={16} aria-hidden className="text-[var(--accent)]" />{t("run.addRound")}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* set type sheet */}
      <dialog ref={sheetRef} className="confirm" aria-labelledby="type-title" onClose={() => setSheet(null)}>
        <div className="flex flex-col gap-3">
          <h2 id="type-title" className="display text-2xl leading-tight">{t("run.type.title")}</h2>
          <ul className="flex flex-col gap-2">
            {SET_TYPES.map((ty) => {
              const current = sheet ? (extraTypes[typeKey(sheet.exerciseId, sheet.setIndex)] ?? "normal") === ty : false;
              return (
                <li key={ty}>
                  <button
                    type="button"
                    onClick={() => pickType(ty)}
                    aria-pressed={current}
                    className="btn flex min-h-12 w-full items-center gap-3 text-left"
                    style={current ? { borderColor: "var(--accent)" } : undefined}
                  >
                    <SetBadge type={ty} n={undefined} />
                    <span>{t(`run.type.${ty}` as MessageKey)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={() => sheetRef.current?.close()} className="btn min-h-12">{t("common.cancel")}</button>
        </div>
      </dialog>

      {/* finish dialog */}
      <dialog ref={dialogRef} className="confirm" aria-labelledby="finish-title">
        <form onSubmit={submitFinish} className="flex flex-col gap-4">
          <h2 id="finish-title" className="display text-2xl leading-tight">{t("run.finish.title")}</h2>
          <p className="text-sm text-muted">{t("run.finish.explain")}</p>
          {openSets > 0 && <p className="text-sm" style={{ color: "var(--warn)" }}>{t("run.finish.open", { n: openSets })}</p>}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">{t("run.finish.duration")}</span>
              <input
                value={duration} onChange={(e) => setDuration(e.target.value)}
                inputMode="numeric" autoComplete="off" required maxLength={3}
                className="input num min-h-12 w-full text-center text-xl"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">{t("run.finish.rpe")}</span>
              <input
                value={rpeLog} onChange={(e) => setRpeLog(e.target.value)}
                inputMode="numeric" autoComplete="off" required maxLength={2}
                className="input num min-h-12 w-full text-center text-xl"
              />
            </label>
          </div>
          {finishError && <p role="alert" className="text-sm text-danger">{t(finishError)}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => dialogRef.current?.close()} className="btn min-h-12 sm:min-w-28">{t("common.cancel")}</button>
            <button disabled={finishing} className="btn btn-primary inline-flex min-h-12 items-center justify-center gap-2">
              <Check size={18} aria-hidden />{finishing ? t("common.loading") : t("run.finish.submit")}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
