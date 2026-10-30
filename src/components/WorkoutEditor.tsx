"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Copy, Dumbbell, Info, Plus, Search, StickyNote, Trash2, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";
import type { Equipment, ExerciseKind, Muscle } from "@/lib/exercises";
import { ConfirmButton } from "@/components/ConfirmButton";
import { duplicateWorkout, saveWorkout, type WorkoutPayload } from "@/app/team/[id]/strength/workouts/actions";

export type SetType = "warmup" | "normal" | "failure" | "drop";
export type EditorExercise = {
  id: string;
  name: string;
  equipment: Equipment;
  primary_muscle: Muscle | null;
  kind: ExerciseKind;
  per_side: boolean;
  archived: boolean;
};
export type EditorWorkout = {
  id: string;
  name: string;
  description: string;
  blocks: {
    exerciseId: string;
    notes: string;
    sets: { type: SetType; reps: number | null; rpe: number | null; weight: number | null; rest: number }[];
  }[];
};

// Limits mirror the server action (src/app/team/[id]/strength/workouts/actions.ts).
const MAX_BLOCKS = 20;
const MAX_SETS = 30;
const REST_PRESETS = [60, 90, 120, 180];
const RPE_OPTIONS = Array.from({ length: 9 }, (_, i) => String(6 + i / 2));
const WEIGHT_KINDS: ExerciseKind[] = ["weight_reps", "weighted_bodyweight"];
const REP_KINDS: ExerciseKind[] = ["weight_reps", "bodyweight_reps", "weighted_bodyweight"];

const SET_TYPES: SetType[] = ["warmup", "normal", "failure", "drop"];
const MAX_NOTES = 500;

type Field = "reps" | "rpe" | "weight";
/** `touched` marks fields edited by hand; those no longer follow edits on earlier sets. */
type SetDraft = {
  key: string; type: SetType; reps: string; rpe: string; weight: string; rest: string; custom: boolean;
  touched: Record<Field, boolean>;
};
type BlockDraft = { key: string; exerciseId: string | null; notes: string; sets: SetDraft[] };

let seq = 0;
const nextKey = () => `k${++seq}`;
const untouched = (): SetDraft["touched"] => ({ reps: false, rpe: false, weight: false });
const newSet = (): SetDraft => ({ key: nextKey(), type: "normal", reps: "", rpe: "", weight: "", rest: "90", custom: false, touched: untouched() });
const newBlock = (): BlockDraft => ({ key: nextKey(), exerciseId: null, notes: "", sets: [newSet()] });
/** Quick fill: a new set copies the previous one; warm-up and failure continue as normal sets. */
const followUp = (prev: SetDraft): SetDraft => ({
  ...prev, key: nextKey(), touched: untouched(),
  type: prev.type === "drop" ? "drop" : "normal",
});
/** Warm-ups do not consume a number; every other set counts up. */
function setNumbers(sets: SetDraft[]): (number | null)[] {
  let n = 0;
  return sets.map((s) => (s.type === "warmup" ? null : ++n));
}
const letter = (i: number) => String.fromCharCode(65 + i);

function fromWorkout(w: EditorWorkout | null): BlockDraft[] {
  if (!w) return [];
  return w.blocks.map((b) => ({
    key: nextKey(),
    exerciseId: b.exerciseId,
    notes: b.notes,
    sets: b.sets.map((s) => ({
      key: nextKey(),
      type: s.type,
      touched: untouched(),
      reps: s.reps === null ? "" : String(s.reps),
      rpe: s.rpe === null ? "" : String(s.rpe),
      weight: s.weight === null ? "" : String(s.weight),
      rest: String(s.rest),
      custom: !REST_PRESETS.includes(s.rest),
    })),
  }));
}

const parseWeight = (v: string) => (v.trim() === "" ? null : Number(v.trim().replace(",", ".")));
const parseReps = (v: string) => (v.trim() === "" ? null : /^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN);

type FieldErrors = { id: string; where: { block?: string; set?: number }; key: MessageKey }[];

function validate(name: string, description: string, blocks: BlockDraft[], byId: Map<string, EditorExercise>): FieldErrors {
  const out: FieldErrors = [];
  const add = (id: string, key: MessageKey, block?: string, set?: number) => out.push({ id, key, where: { block, set } });
  if (name.trim().length < 1 || name.trim().length > 80) add("name", "workouts.error.name");
  if (description.trim().length > 1000) add("description", "workouts.error.description");
  if (blocks.length < 1) add("blocks", "workouts.error.blocksRequired");
  if (blocks.length > MAX_BLOCKS) add("blocks", "workouts.error.tooManyBlocks");
  blocks.forEach((b, bi) => {
    const L = letter(bi);
    const ex = b.exerciseId ? byId.get(b.exerciseId) : undefined;
    if (!ex) add(`b${bi}.ex`, "workouts.error.exercise", L);
    if (b.sets.length < 1) add(`b${bi}.sets`, "workouts.error.setsRequired", L);
    if (b.sets.length > MAX_SETS) add(`b${bi}.sets`, "workouts.error.tooManySets", L);
    if (b.notes.trim().length > MAX_NOTES) add(`b${bi}.notes`, "workouts.error.notes", L);
    b.sets.forEach((s, si) => {
      const reps = parseReps(s.reps);
      const needReps = !!ex && REP_KINDS.includes(ex.kind);
      if (Number.isNaN(reps) || (reps !== null && (reps < 1 || reps > 100)) || (reps === null && needReps)) {
        add(`b${bi}.s${si}.reps`, "workouts.error.reps", L, si + 1);
      }
      if (s.type === "failure" && s.rpe !== "10") add(`b${bi}.s${si}.rpe`, "workouts.error.rpe", L, si + 1);
      if (s.type !== "warmup" && s.rpe !== "") {
        const r = Number(s.rpe);
        if (!Number.isFinite(r) || r < 5 || r > 10 || (r * 2) % 1 !== 0) add(`b${bi}.s${si}.rpe`, "workouts.error.rpe", L, si + 1);
      }
      if (ex && WEIGHT_KINDS.includes(ex.kind)) {
        const w = parseWeight(s.weight);
        if (w !== null && (!Number.isFinite(w) || w <= 0 || w > 1000)) add(`b${bi}.s${si}.weight`, "workouts.error.weight", L, si + 1);
      }
      const rest = s.rest.trim();
      if (!/^\d+$/.test(rest) || Number(rest) > 600) add(`b${bi}.s${si}.rest`, "workouts.error.rest", L, si + 1);
    });
  });
  return out;
}

function toPayload(name: string, description: string, blocks: BlockDraft[], byId: Map<string, EditorExercise>): WorkoutPayload {
  return {
    name: name.trim(),
    description: description.trim(),
    blocks: blocks.map((b) => {
      const weighted = WEIGHT_KINDS.includes(byId.get(b.exerciseId ?? "")?.kind as ExerciseKind);
      return {
        exercise_id: b.exerciseId ?? "",
        notes: b.notes.trim() === "" ? null : b.notes.trim(),
        sets: b.sets.map((s) => ({
          set_type: s.type,
          reps: parseReps(s.reps),
          target_rpe: s.type === "warmup" ? null : s.type === "failure" ? 10 : s.rpe === "" ? null : Number(s.rpe),
          fixed_weight_kg: weighted ? parseWeight(s.weight) : null,
          rest_seconds: Number(s.rest.trim()),
        })),
      };
    }),
  };
}

const eyebrow = "eyebrow flex items-center gap-1.5";
const iconBtn =
  "inline-grid size-11 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";
const bad = "!border-[var(--danger)]";

export function WorkoutEditor({
  teamId, workout, exercises, hint,
}: { teamId: string; workout: EditorWorkout | null; exercises: EditorExercise[]; hint?: React.ReactNode }) {
  const { t } = useT();
  const router = useRouter();
  const uid = useId();
  const listHref = `/team/${teamId}/strength/workouts`;

  const [name, setName] = useState(workout?.name ?? "");
  const [description, setDescription] = useState(workout?.description ?? "");
  const [blocks, setBlocks] = useState<BlockDraft[]>(() => fromWorkout(workout));
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<MessageKey | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const pickable = useMemo(() => exercises.filter((e) => !e.archived), [exercises]);
  const errors = useMemo(() => validate(name, description, blocks, byId), [name, description, blocks, byId]);
  const errorIds = useMemo(() => new Set(attempted ? errors.map((e) => e.id) : []), [attempted, errors]);

  // Unsaved-changes guard: compare against what was last saved or loaded.
  const snapshot = useMemo(
    () => JSON.stringify([name, description, blocks.map((b) => [b.exerciseId, b.notes, b.sets.map((s) => [s.type, s.reps, s.rpe, s.weight, s.rest])])]),
    [name, description, blocks],
  );
  const baseline = useRef<string | null>(null);
  if (baseline.current === null) baseline.current = snapshot;
  const dirty = snapshot !== baseline.current;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const totalSets = blocks.reduce((n, b) => n + b.sets.length, 0);
  const plural = (key: "blocks" | "sets", n: number) => (n === 1 ? t(`workouts.${key}.one`) : t(`workouts.${key}.many`, { n }));

  function patchBlock(bi: number, fn: (b: BlockDraft) => BlockDraft) {
    setBlocks((cur) => cur.map((b, i) => (i === bi ? fn(b) : b)));
  }
  function move(bi: number, dir: -1 | 1) {
    setBlocks((cur) => {
      const to = bi + dir;
      if (to < 0 || to >= cur.length) return cur;
      const next = [...cur];
      [next[bi], next[to]] = [next[to], next[bi]];
      return next;
    });
  }
  const removeBlock = (bi: number) => setBlocks((cur) => cur.filter((_, i) => i !== bi));

  const summaryError = (e: FieldErrors[number]) => {
    const where = e.where.set
      ? t("workouts.error.where.set", { label: e.where.block ?? "", n: e.where.set })
      : e.where.block
        ? t("workouts.error.where.block", { label: e.where.block })
        : t("workouts.error.where.workout");
    return t("workouts.error.at", { where, msg: t(e.key) });
  };

  function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setAttempted(true);
    setServerError(null);
    if (errors.length) {
      document.getElementById(`${uid}-${errors[0].id}`)?.focus();
      return;
    }
    const payload = toPayload(name, description, blocks, byId);
    startTransition(async () => {
      const res = await saveWorkout(teamId, workout?.id ?? null, JSON.stringify(payload));
      if (!res.ok) {
        setServerError(res.error ?? "workouts.error.generic");
        if (res.error === "workouts.error.nameTaken") document.getElementById(`${uid}-name`)?.focus();
        return;
      }
      baseline.current = snapshot;
      // Everything saved counts as "not edited by hand" again.
      setBlocks((cur) => cur.map((b) => ({ ...b, sets: b.sets.map((s) => ({ ...s, touched: untouched() })) })));
      router.push(listHref);
      router.refresh();
    });
  }

  const shownError = serverError ? t(serverError) : attempted && errors.length ? summaryError(errors[0]) : null;
  const nameErr = errorIds.has("name") || serverError === "workouts.error.nameTaken";

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link href={listHref} className="link inline-flex min-h-11 w-fit items-center gap-1 text-sm no-underline">
          <ChevronLeft size={16} aria-hidden />{t("workouts.editor.back")}
        </Link>
        <h2 className="display text-2xl">{workout ? t("workouts.editor.editTitle") : t("workouts.editor.newTitle")}</h2>
        {hint}
      </div>

      <div className="card flex flex-col gap-4 text-sm">
        <label className="flex flex-col gap-1.5">
          <span className={eyebrow}>{t("workouts.editor.name")}</span>
          <input
            id={`${uid}-name`} value={name} onChange={(e) => { setName(e.target.value); setServerError(null); }}
            maxLength={80} required autoComplete="off" placeholder={t("workouts.editor.namePh")}
            aria-invalid={nameErr || undefined} className={`input min-h-11 w-full ${nameErr ? bad : ""}`}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={eyebrow}>{t("workouts.editor.description")} ({t("common.optional")})</span>
          <textarea
            id={`${uid}-description`} value={description} onChange={(e) => setDescription(e.target.value)}
            rows={3} maxLength={1000} placeholder={t("workouts.editor.descriptionPh")}
            aria-invalid={errorIds.has("description") || undefined} className={`input w-full ${errorIds.has("description") ? bad : ""}`}
          />
        </label>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="eyebrow !font-sans">{t("workouts.editor.blocks")}</h3>
          <p className="text-sm text-muted" aria-live="polite">
            {t("workouts.editor.summary", { blocks: plural("blocks", blocks.length), sets: plural("sets", totalSets) })}
          </p>
        </div>

        {pickable.length === 0 && (
          <div className="card flex flex-col items-start gap-3 text-sm">
            <p className="text-muted">{t("workouts.empty.noExercises")}</p>
            <Link href={`/team/${teamId}/strength/exercises`} className="btn inline-flex min-h-11 items-center gap-2">
              {t("workouts.empty.exercisesLink")}<ChevronRight size={16} aria-hidden />
            </Link>
          </div>
        )}

        {blocks.length === 0 && pickable.length > 0 && (
          <div className="card flex flex-col items-center gap-3 px-5 py-8 text-center text-sm">
            <span
              aria-hidden className="grid size-14 place-items-center rounded-full text-[var(--accent)]"
              style={{ background: "linear-gradient(145deg, var(--surface-3), var(--surface-2))", boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent)" }}
            >
              <Dumbbell size={24} />
            </span>
            <h4 className="display text-xl">{t("workouts.editor.emptyTitle")}</h4>
            <p className="max-w-xs text-muted">{t("workouts.editor.emptyBody")}</p>
            <button
              type="button" onClick={() => setBlocks((cur) => [...cur, newBlock()])}
              className="btn btn-primary inline-flex min-h-12 items-center justify-center gap-2 px-5"
            >
              <Plus size={18} aria-hidden />{t("workouts.editor.emptyAction")}
            </button>
          </div>
        )}

        <ol className="stagger flex flex-col gap-4">
          {blocks.map((b, bi) => (
            <BlockCard
              key={b.key} uid={uid} index={bi} count={blocks.length} block={b} exercises={pickable} byId={byId}
              errorIds={errorIds}
              onChange={(fn) => patchBlock(bi, fn)} onMove={(d) => move(bi, d)} onRemove={() => removeBlock(bi)}
            />
          ))}
        </ol>

        {blocks.length > 0 && (
        <button
          type="button" disabled={blocks.length >= MAX_BLOCKS || pickable.length === 0}
          onClick={() => setBlocks((cur) => [...cur, newBlock()])}
          className="btn inline-flex min-h-12 w-full items-center justify-center gap-2"
        >
          <Plus size={18} aria-hidden />{t("workouts.editor.addBlock")}
        </button>
        )}
      </div>

      <div className="glass sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] z-10 flex items-center gap-3 rounded-2xl p-3 md:bottom-4">
        <div className="min-w-0 flex-1 text-sm" aria-live="polite">
          {shownError ? (
            <p role="alert" className="text-danger">{shownError}</p>
          ) : (
            <p className="truncate text-muted">
              {dirty ? t("workouts.editor.unsaved") : t("workouts.editor.summary", { blocks: plural("blocks", blocks.length), sets: plural("sets", totalSets) })}
            </p>
          )}
        </div>
        <button disabled={pending} className="btn btn-primary inline-flex min-h-12 shrink-0 items-center gap-2 px-5">
          <Check size={18} aria-hidden />{pending ? t("workouts.editor.saving") : t("workouts.editor.save")}
        </button>
      </div>
    </form>
  );
}

const TYPE_STYLE: Record<SetType, { color: string; bg: string }> = {
  warmup: { color: "var(--warn)", bg: "var(--warn-bg)" },
  normal: { color: "var(--foreground)", bg: "var(--neutral-bg)" },
  failure: { color: "var(--danger)", bg: "var(--danger-bg)" },
  drop: { color: "var(--accent)", bg: "var(--accent-soft)" },
};

function BlockCard({
  uid, index, count, block, exercises, byId, errorIds, onChange, onMove, onRemove,
}: {
  uid: string;
  index: number;
  count: number;
  block: BlockDraft;
  exercises: EditorExercise[];
  byId: Map<string, EditorExercise>;
  errorIds: Set<string>;
  onChange: (fn: (b: BlockDraft) => BlockDraft) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { t } = useT();
  const [bulk, setBulk] = useState("3");
  const [sheetFor, setSheetFor] = useState<number | null>(null);
  const [noteOpen, setNoteOpen] = useState(block.notes !== "");
  const focusSet = useRef<number | null>(null);
  const L = letter(index);
  const ex = block.exerciseId ? byId.get(block.exerciseId) : undefined;
  const weighted = !!ex && WEIGHT_KINDS.includes(ex.kind);
  const room = MAX_SETS - block.sets.length;
  const touched = !!ex || block.sets.some((s) => s.reps || s.rpe || s.weight) || block.notes !== "";
  const numbers = setNumbers(block.sets);
  const noteId = `${uid}-b${index}.notes`;

  // After "Add set", move focus to the reps field of the new set.
  useEffect(() => {
    if (focusSet.current === null) return;
    document.getElementById(`${uid}-b${index}.s${focusSet.current}.reps`)?.focus();
    focusSet.current = null;
  });

  function setSets(fn: (sets: SetDraft[]) => SetDraft[]) {
    onChange((b) => ({ ...b, sets: fn(b.sets) }));
  }
  function patchSet(si: number, p: Partial<SetDraft>) {
    setSets((sets) => sets.map((s, i) => (i === si ? { ...s, ...p } : s)));
  }
  /** Edit one field and carry it to later normal sets that still match and were not edited by hand. */
  function editField(si: number, field: Field, value: string) {
    setSets((sets) => {
      const from = sets[si];
      const old = from[field];
      return sets.map((s, i) => {
        if (i === si) return { ...s, [field]: value, touched: { ...s.touched, [field]: true } };
        if (i > si && from.type !== "warmup" && s.type === "normal" && !s.touched[field] && s[field] === old) return { ...s, [field]: value };
        return s;
      });
    });
  }
  function changeType(si: number, type: SetType) {
    setSets((sets) => sets.map((s, i) => {
      if (i !== si) return s;
      const rpe = type === "failure" ? "10" : type === "warmup" ? "" : s.rpe;
      return { ...s, type, rpe };
    }));
  }
  function copies(from: SetDraft, n: number): SetDraft[] {
    return Array.from({ length: n }, () => followUp(from));
  }
  function addOne() {
    focusSet.current = block.sets.length;
    setSets((sets) => [...sets, ...copies(sets[sets.length - 1], 1)]);
  }
  function addBulk() {
    const n = Math.min(Math.max(1, Math.floor(Number(bulk)) || 1), room);
    if (n < 1) return;
    setSets((sets) => [...sets, ...copies(sets[sets.length - 1], n)]);
  }
  function openNote() {
    setNoteOpen((o) => !o);
    if (!noteOpen) requestAnimationFrame(() => document.getElementById(noteId)?.focus());
  }

  return (
    <li className="card flex flex-col gap-4 text-sm">
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-full text-[var(--accent)]"
          style={{
            background: "linear-gradient(145deg, var(--surface-3), var(--surface-2))",
            boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent)",
          }}
        >
          <span className="num text-lg">{L}</span>
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className={eyebrow}>{t("workouts.block.label", { label: L })}</span>
          <ExercisePicker
            id={`${uid}-b${index}.ex`} exercises={exercises} selected={ex} label={L}
            invalid={errorIds.has(`b${index}.ex`)}
            onPick={(e) => onChange((b) => ({ ...b, exerciseId: e.id }))}
          />
        </div>
        <div className="-mr-2 flex shrink-0 items-center">
          <button type="button" className={iconBtn} disabled={index === 0} onClick={() => onMove(-1)}
            aria-label={`${t("workouts.block.up")} (${L})`} title={t("workouts.block.up")}>
            <ArrowUp size={18} aria-hidden />
          </button>
          <button type="button" className={iconBtn} disabled={index === count - 1} onClick={() => onMove(1)}
            aria-label={`${t("workouts.block.down")} (${L})`} title={t("workouts.block.down")}>
            <ArrowDown size={18} aria-hidden />
          </button>
          {touched ? (
            <ConfirmButton
              action={async () => { onRemove(); }}
              icon="trash" iconOnly className="!size-11"
              label={`${t("workouts.block.remove")} (${L})`}
              title={t("workouts.block.removeTitle", { label: L })}
              body={t("workouts.block.removeBody")}
            />
          ) : (
            <button type="button" className={`${iconBtn} hover:!bg-[var(--danger-bg)] hover:!text-danger`} onClick={onRemove}
              aria-label={`${t("workouts.block.remove")} (${L})`} title={t("workouts.block.remove")}>
              <Trash2 size={18} aria-hidden />
            </button>
          )}
        </div>
      </div>

      {ex && (
        <div className="flex flex-col gap-1 text-xs text-muted">
          <p>{t(`workouts.hint.${ex.kind}`)}{ex.per_side ? ` ${t("workouts.hint.perSide")}` : ""}</p>
          {weighted && <p>{t("workouts.set.weightHint")}</p>}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="button" onClick={openNote} aria-expanded={noteOpen} aria-controls={`${noteId}-panel`}
          className="flex min-h-11 w-full items-center gap-2 rounded-xl px-1 text-left text-muted transition-colors hover:text-[var(--foreground)]"
        >
          <StickyNote size={16} aria-hidden className="shrink-0 text-[var(--accent)]" />
          <span className={`min-w-0 flex-1 truncate ${block.notes && !noteOpen ? "text-[var(--foreground)]" : ""}`}>
            {block.notes && !noteOpen ? block.notes : t("workouts.note.add")}
          </span>
        </button>
        {noteOpen && (
          <div id={`${noteId}-panel`} className="flex flex-col gap-1">
            <label htmlFor={noteId} className="sr-only">{t("workouts.note.label")} ({L})</label>
            <textarea
              id={noteId} value={block.notes} rows={2} maxLength={MAX_NOTES}
              onChange={(e) => onChange((b) => ({ ...b, notes: e.target.value }))}
              placeholder={t("workouts.note.ph")} aria-invalid={errorIds.has(`b${index}.notes`) || undefined}
              className={`input w-full ${errorIds.has(`b${index}.notes`) ? bad : ""}`}
            />
            <p className="text-right text-xs text-muted" aria-live="off">{t("workouts.note.count", { n: block.notes.length })}</p>
          </div>
        )}
      </div>

      <ol className="flex flex-col gap-3">
        {block.sets.map((s, si) => {
          const n = si + 1;
          const title = t("workouts.set.title", { n });
          const fid = (f: string) => `${uid}-b${index}.s${si}.${f}`;
          const rpeOptions = s.rpe !== "" && !RPE_OPTIONS.includes(s.rpe) ? [s.rpe, ...RPE_OPTIONS] : RPE_OPTIONS;
          const cols = weighted ? "sm:grid-cols-4" : "sm:grid-cols-3";
          const style = TYPE_STYLE[s.type];
          const num = numbers[si];
          const badge = s.type === "normal" ? String(num) : t(`workouts.type.${s.type}.badge`);
          const typeName = t(`workouts.type.${s.type}`);
          const rpeLocked = s.type === "warmup" || s.type === "failure";
          return (
            <li key={s.key} className="flex flex-col gap-2 rounded-2xl border p-3" style={{ background: "color-mix(in srgb, var(--surface-2) 55%, transparent)" }}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <button
                    type="button" onClick={() => setSheetFor(si)} aria-haspopup="dialog"
                    aria-label={`${t("workouts.type.change", { n, type: typeName })} (${L})`}
                    title={t("workouts.type.sheetTitle")}
                    className="num grid size-11 shrink-0 place-items-center rounded-full text-lg transition-transform active:scale-95"
                    style={{ color: style.color, background: style.bg, boxShadow: `0 0 0 1px color-mix(in srgb, ${style.color} 45%, transparent)` }}
                  >
                    {badge}
                  </button>
                  <span className={`${eyebrow} truncate`}>{title}{s.type === "normal" ? "" : ` · ${typeName}`}</span>
                </div>
                <div className="-mr-2 flex items-center">
                  <button type="button" className={iconBtn} disabled={room < 1} title={t("workouts.set.duplicate", { n })}
                    aria-label={`${t("workouts.set.duplicate", { n })} (${L})`}
                    onClick={() => setSets((sets) => [...sets.slice(0, si + 1), { ...s, key: nextKey(), touched: untouched() }, ...sets.slice(si + 1)])}>
                    <Copy size={16} aria-hidden />
                  </button>
                </div>
              </div>

              <div className={`grid grid-cols-2 gap-3 ${cols}`}>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted">{t("workouts.set.reps")}</span>
                  <input
                    id={fid("reps")} value={s.reps} onChange={(e) => editField(si, "reps", e.target.value)}
                    inputMode="numeric" enterKeyHint="next" autoComplete="off" aria-label={`${t("workouts.set.reps")}, ${title} (${L})`}
                    aria-invalid={errorIds.has(`b${index}.s${si}.reps`) || undefined}
                    className={`input num min-h-11 w-full text-center text-lg ${errorIds.has(`b${index}.s${si}.reps`) ? bad : ""}`}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted">{t("workouts.set.rpe")}</span>
                  <select
                    id={fid("rpe")} value={s.rpe} disabled={rpeLocked}
                    onChange={(e) => editField(si, "rpe", e.target.value)}
                    aria-label={`${t("workouts.set.rpe")}, ${title} (${L})`}
                    aria-invalid={errorIds.has(`b${index}.s${si}.rpe`) || undefined}
                    className={`input min-h-11 w-full disabled:cursor-not-allowed disabled:opacity-60 ${errorIds.has(`b${index}.s${si}.rpe`) ? bad : ""}`}
                  >
                    <option value="">{s.type === "warmup" ? "–" : t("workouts.set.rpeNone")}</option>
                    {rpeOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
                {weighted && (
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted">{t("workouts.set.weight")}</span>
                    <input
                      id={fid("weight")} value={s.weight} onChange={(e) => editField(si, "weight", e.target.value)}
                      inputMode="decimal" enterKeyHint="next" autoComplete="off" placeholder={t("workouts.set.weightPh")}
                      aria-label={`${t("workouts.set.weight")}, ${title} (${L})`}
                      aria-invalid={errorIds.has(`b${index}.s${si}.weight`) || undefined}
                      className={`input min-h-11 w-full ${errorIds.has(`b${index}.s${si}.weight`) ? bad : ""}`}
                    />
                  </label>
                )}
                <div className="flex flex-col gap-1">
                  <label htmlFor={fid("restSel")} className="text-xs text-muted">{t("workouts.set.rest")}</label>
                  <select
                    id={fid("restSel")} value={s.custom ? "custom" : s.rest}
                    aria-label={`${t("workouts.set.rest")}, ${title} (${L})`}
                    onChange={(e) => (e.target.value === "custom" ? patchSet(si, { custom: true }) : patchSet(si, { custom: false, rest: e.target.value }))}
                    className="input min-h-11 w-full"
                  >
                    {REST_PRESETS.map((r) => <option key={r} value={r}>{t("workouts.set.restOption", { n: r })}</option>)}
                    <option value="custom">{t("workouts.set.restCustom")}</option>
                  </select>
                  {s.custom && (
                    <input
                      id={fid("rest")} value={s.rest} onChange={(e) => patchSet(si, { rest: e.target.value })}
                      inputMode="numeric" enterKeyHint="next" autoComplete="off" aria-label={`${t("workouts.set.restSeconds")}, ${title} (${L})`}
                      aria-invalid={errorIds.has(`b${index}.s${si}.rest`) || undefined}
                      className={`input min-h-11 w-full ${errorIds.has(`b${index}.s${si}.rest`) ? bad : ""}`}
                    />
                  )}
                </div>
              </div>
              {s.type === "warmup" && <p className="text-xs text-muted">{t("workouts.type.warmupHint")}</p>}
              {s.type === "failure" && <p className="text-xs text-muted">{t("workouts.type.failureHint")}</p>}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-2 border-t pt-3">
        <button
          type="button" disabled={room < 1} className="btn inline-flex min-h-11 w-full items-center justify-center gap-2"
          onClick={addOne}
        >
          <Plus size={16} aria-hidden />{t("workouts.set.add")}
        </button>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2">
            <span className="sr-only">{t("workouts.block.bulkLabel")}</span>
            <input
              value={bulk} onChange={(e) => setBulk(e.target.value)} inputMode="numeric" enterKeyHint="done" autoComplete="off"
              aria-label={`${t("workouts.block.bulkLabel")} (${L})`}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBulk(); } }}
              className="input num min-h-11 w-16 text-center text-lg"
            />
          </label>
          <button type="button" disabled={room < 1} onClick={addBulk} className="btn inline-flex min-h-11 flex-1 items-center justify-center gap-2">
            <Copy size={16} aria-hidden />{t("workouts.block.bulkAdd")}
          </button>
        </div>
        <p className="text-xs text-muted">{t("workouts.block.bulkHint")}</p>
      </div>

      {sheetFor !== null && block.sets[sheetFor] && (
        <SetTypeSheet
          current={block.sets[sheetFor].type} canRemove={block.sets.length > 1} n={sheetFor + 1}
          onPick={(type) => changeType(sheetFor, type)}
          onRemove={() => setSets((sets) => sets.filter((_, i) => i !== sheetFor))}
          onClosed={() => setSheetFor(null)}
        />
      )}
    </li>
  );
}

/** Bottom sheet with large options for the type of one set, plus removing the set. */
function SetTypeSheet({
  current, canRemove, n, onPick, onRemove, onClosed,
}: {
  current: SetType;
  canRemove: boolean;
  n: number;
  onPick: (t: SetType) => void;
  onRemove: () => void;
  onClosed: () => void;
}) {
  const { t } = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const [legend, setLegend] = useState(false);
  const legendId = useId();

  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);
  const close = () => ref.current?.close();

  return (
    <dialog
      ref={ref} onClose={onClosed} aria-label={`${t("workouts.type.sheetTitle")} (${t("workouts.set.title", { n })})`}
      className="confirm !m-0 !mx-auto !mt-auto !max-h-[88dvh] !w-full !max-w-[32rem] overflow-y-auto !rounded-b-none !rounded-t-3xl !p-5 !pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]"
    >
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="display text-2xl leading-tight">{t("workouts.type.sheetTitle")}</h2>
          <div className="-mr-2 flex items-center">
            <button
              type="button" onClick={() => setLegend((v) => !v)} aria-expanded={legend} aria-controls={legendId}
              aria-label={t("workouts.type.info")} title={t("workouts.type.info")} className={iconBtn}
            >
              <Info size={20} aria-hidden />
            </button>
            <button type="button" onClick={close} aria-label={t("workouts.picker.close")} title={t("workouts.picker.close")} className={iconBtn}>
              <X size={20} aria-hidden />
            </button>
          </div>
        </div>
        {legend && (
          <ul id={legendId} className="flex flex-col gap-1 rounded-2xl border p-3 text-xs text-muted">
            {SET_TYPES.map((k) => <li key={k}>{t(`workouts.type.${k}.desc`)}</li>)}
          </ul>
        )}
        <ul className="flex flex-col gap-2">
          {SET_TYPES.map((k) => {
            const st = TYPE_STYLE[k];
            return (
              <li key={k}>
                <button
                  type="button" aria-current={k === current || undefined}
                  onClick={() => { onPick(k); close(); }}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 text-left font-semibold transition-colors hover:border-[var(--accent)] ${k === current ? "!border-[var(--accent)] bg-[var(--accent-soft)]" : ""}`}
                >
                  <span className="num grid size-9 shrink-0 place-items-center rounded-full text-base" style={{ color: st.color, background: st.bg }}>
                    {k === "normal" ? "1" : t(`workouts.type.${k}.badge`)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{t(`workouts.type.${k}`)}</span>
                  {k === current && <Check size={18} aria-hidden className="shrink-0 text-[var(--accent)]" />}
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button" disabled={!canRemove} onClick={() => { onRemove(); close(); }}
          className="btn btn-danger inline-flex min-h-14 w-full items-center justify-center gap-2"
        >
          <Trash2 size={18} aria-hidden />{t("workouts.set.remove", { n })}
        </button>
      </div>
    </dialog>
  );
}

/** Button that shows the chosen exercise and opens a searchable sheet to pick another. */
function ExercisePicker({
  id, exercises, selected, label, invalid, onPick,
}: {
  id: string;
  exercises: EditorExercise[];
  selected: EditorExercise | undefined;
  label: string;
  invalid: boolean;
  onPick: (e: EditorExercise) => void;
}) {
  const { t } = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  function show() {
    setOpen(true);
    // The sheet mounts on open, so every opening starts with an empty search.
    requestAnimationFrame(() => ref.current?.showModal());
  }
  const meta = (e: EditorExercise) =>
    [e.primary_muscle ? t(`exercises.muscle.${e.primary_muscle}`) : t("workouts.picker.noMuscle"), t(`exercises.equipment.${e.equipment}`)].join(" · ");

  return (
    <>
      <button
        id={id} type="button" onClick={show} aria-haspopup="dialog"
        className={`input flex min-h-12 w-full items-center justify-between gap-2 text-left ${invalid ? bad : ""}`}
      >
        <span className="flex min-w-0 flex-col">
          <span className={`truncate font-semibold ${selected ? "" : "text-muted"}`}>{selected ? selected.name : t("workouts.block.pick")}</span>
          {selected && (
            <span className="truncate text-xs text-muted">
              {meta(selected)}{selected.archived ? ` · ${t("workouts.block.archivedExercise")}` : ""}
            </span>
          )}
        </span>
        <span className="shrink-0 text-xs text-muted">{selected ? t("workouts.block.change") : ""}</span>
        <ChevronRight size={16} aria-hidden className="shrink-0 text-muted" />
      </button>
      <dialog
        ref={ref}
        className="confirm !w-[min(94vw,32rem)] !max-h-[88dvh] overflow-y-auto !rounded-3xl !p-5"
        onClose={() => setOpen(false)}
        aria-label={`${t("workouts.picker.title")} (${label})`}
      >
        {open && (
          <PickerBody
            exercises={exercises} selectedId={selected?.id} meta={meta}
            onPick={(e) => { onPick(e); ref.current?.close(); }} onClose={() => ref.current?.close()}
          />
        )}
      </dialog>
    </>
  );
}

function PickerBody({
  exercises, selectedId, meta, onPick, onClose,
}: {
  exercises: EditorExercise[];
  selectedId: string | undefined;
  meta: (e: EditorExercise) => string;
  onPick: (e: EditorExercise) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return exercises;
    return exercises.filter((e) => `${e.name} ${meta(e)}`.toLowerCase().includes(needle));
  }, [exercises, q, meta]);

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <h2 className="display text-2xl leading-tight">{t("workouts.picker.title")}</h2>
        <button
          type="button" onClick={onClose} aria-label={t("workouts.picker.close")} title={t("workouts.picker.close")}
          className="-mr-2 -mt-1 inline-grid size-11 shrink-0 place-items-center rounded-full text-muted transition-colors hover:text-[var(--foreground)]"
        >
          <X size={20} aria-hidden />
        </button>
      </div>
      <label className="relative block">
        <span className="sr-only">{t("workouts.picker.search")}</span>
        <Search size={18} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off"
          placeholder={t("workouts.picker.searchPh")} className="input min-h-12 w-full !pl-11"
        />
      </label>
      {list.length === 0 ? (
        <p className="py-4 text-center text-muted">{t("workouts.picker.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((e) => (
            <li key={e.id}>
              <button
                type="button" onClick={() => onPick(e)} aria-current={e.id === selectedId || undefined}
                className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-2 text-left transition-colors hover:border-[var(--accent)] ${e.id === selectedId ? "!border-[var(--accent)] bg-[var(--accent-soft)]" : ""}`}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold">{e.name}</span>
                  <span className="truncate text-xs text-muted">{meta(e)}</span>
                </span>
                {e.id === selectedId && <Check size={18} aria-hidden className="shrink-0 text-[var(--accent)]" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Duplicates a workout on the server; the list refreshes through revalidation. */
export function DuplicateWorkoutButton({ teamId, workoutId }: { teamId: string; workoutId: string }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<MessageKey | null>(null);
  return (
    <>
      <button
        type="button" disabled={pending} className="btn inline-flex min-h-11 items-center gap-2"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await duplicateWorkout(teamId, workoutId);
            if (!res.ok) setError(res.error ?? "workouts.error.generic");
            else router.refresh();
          });
        }}
      >
        <Copy size={16} aria-hidden />{pending ? t("workouts.duplicate.busy") : t("workouts.duplicate")}
      </button>
      {error && <p role="alert" className="w-full text-danger">{t(error)}</p>}
    </>
  );
}
