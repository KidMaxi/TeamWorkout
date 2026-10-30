"use client";

import { useActionState, useRef, useState } from "react";
import { Check, Pencil, Plus, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import {
  EQUIPMENT, EXERCISE_KINDS, MUSCLES,
  type ExerciseKind, type ExerciseRow, type Muscle,
} from "@/lib/exercises";
import {
  createExercise, updateExercise,
  type ExerciseResult,
} from "@/app/team/[id]/strength/exercises/actions";

const label = "eyebrow flex items-center gap-1.5";
const WEIGHT_KINDS: ExerciseKind[] = ["weight_reps", "weighted_bodyweight"];
type MediaKind = "none" | "image" | "video";

/** Trigger button plus a sheet-style dialog with the create/edit form. */
export function ExerciseForm({ teamId, exercise }: { teamId: string; exercise?: ExerciseRow }) {
  const { t } = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const editing = !!exercise;

  function show() {
    setOpen(true);
    // The form mounts on open, so every opening starts from the saved values.
    requestAnimationFrame(() => ref.current?.showModal());
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        className={`${editing ? "btn" : "btn btn-primary"} inline-flex min-h-11 items-center justify-center gap-2`}
      >
        {editing ? <Pencil size={16} aria-hidden /> : <Plus size={18} aria-hidden />}
        {editing ? t("exercises.edit") : t("exercises.add")}
      </button>
      <dialog
        ref={ref}
        className="confirm !w-[min(94vw,36rem)] !max-h-[92dvh] overflow-y-auto !rounded-3xl !p-5"
        onClose={() => setOpen(false)}
        aria-label={editing ? t("exercises.form.editTitle") : t("exercises.form.addTitle")}
      >
        {open && <FormBody teamId={teamId} exercise={exercise} onDone={() => ref.current?.close()} />}
      </dialog>
    </>
  );
}

function FormBody({ teamId, exercise, onDone }: { teamId: string; exercise?: ExerciseRow; onDone: () => void }) {
  const { t } = useT();
  const editing = !!exercise;
  const [kind, setKind] = useState<ExerciseKind>(exercise?.kind ?? "weight_reps");
  const [primary, setPrimary] = useState<string>(exercise?.primary_muscle ?? "");
  const [others, setOthers] = useState<Muscle[]>(exercise?.other_muscles ?? []);
  const [mediaKind, setMediaKind] = useState<MediaKind>(exercise?.media_kind ?? "none");
  const weightKind = WEIGHT_KINDS.includes(kind);

  const [state, formAction, pending] = useActionState<ExerciseResult, FormData>(async (_prev, fd) => {
    const res = editing ? await updateExercise(teamId, exercise.id, fd) : await createExercise(teamId, fd);
    if (res.ok) onDone();
    return res;
  }, { ok: false });

  function toggle(m: Muscle) {
    setOthers((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <h2 className="display text-2xl leading-tight">
          {editing ? t("exercises.form.editTitle") : t("exercises.form.addTitle")}
        </h2>
        <button
          type="button"
          onClick={onDone}
          aria-label={t("exercises.form.close")}
          title={t("exercises.form.close")}
          className="-mr-2 -mt-1 inline-grid size-11 shrink-0 place-items-center rounded-full text-muted transition-colors hover:text-[var(--foreground)]"
        >
          <X size={20} aria-hidden />
        </button>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={label}>{t("exercises.form.name")}</span>
        <input name="name" required maxLength={80} defaultValue={exercise?.name ?? ""} autoComplete="off" className="input min-h-11 w-full" />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={label}>{t("exercises.form.instructions")}</span>
        <textarea
          name="instructions" required maxLength={4000} rows={5}
          defaultValue={exercise?.instructions ?? ""}
          placeholder={t("exercises.form.instructionsPh")}
          className="input w-full resize-y leading-relaxed"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={label}>{t("exercises.form.equipment")}</span>
          <select name="equipment" defaultValue={exercise?.equipment ?? "barbell"} className="input min-h-11 w-full">
            {EQUIPMENT.map((e) => <option key={e} value={e}>{t(`exercises.equipment.${e}`)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>{t("exercises.form.primary")}</span>
          <select
            name="primary_muscle" value={primary}
            onChange={(e) => { setPrimary(e.target.value); setOthers((cur) => cur.filter((m) => m !== e.target.value)); }}
            className="input min-h-11 w-full"
          >
            <option value="">{t("exercises.form.primaryNone")}</option>
            {MUSCLES.map((m) => <option key={m} value={m}>{t(`exercises.muscle.${m}`)}</option>)}
          </select>
        </label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${label} mb-1`}>{t("exercises.form.other")}</legend>
        <div className="flex flex-wrap gap-2">
          {MUSCLES.map((m) => {
            const isPrimary = m === primary;
            return (
              <label key={m} className={`group/chip ${isPrimary ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}>
                <input
                  type="checkbox" name="other_muscles" value={m}
                  checked={others.includes(m)} disabled={isPrimary}
                  onChange={() => toggle(m)}
                  className="peer sr-only"
                />
                <span className="chip min-h-11 !px-4 text-sm peer-checked:!border-[var(--accent)] peer-checked:!bg-[var(--accent-soft)] peer-checked:!text-[var(--foreground)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)]">
                  {t(`exercises.muscle.${m}`)}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className={label}>{t("exercises.form.kind")}</span>
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as ExerciseKind)} className="input min-h-11 w-full">
          {EXERCISE_KINDS.map((k) => <option key={k} value={k}>{t(`exercises.kind.${k}`)}</option>)}
        </select>
        <span className="text-xs text-muted">{t(`exercises.kindHelp.${kind}`)}</span>
      </label>

      <div className="flex flex-col gap-2">
        <Check2 name="per_side" defaultChecked={exercise?.per_side ?? false} text={t("exercises.form.perSide")} />
        <Check2 name="track_pr" defaultChecked={exercise?.track_pr ?? false} text={t("exercises.form.trackPr")} />
        <Check2
          key={weightKind ? "w" : "x"}
          name="track_5rm" defaultChecked={weightKind && (exercise?.track_5rm ?? false)}
          disabled={!weightKind} text={t("exercises.form.track5rm")} hint={t("exercises.form.track5rmHint")}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${label} mb-1`}>{t("exercises.form.media")}</legend>
        <div className="grid grid-cols-3 gap-1 rounded-2xl border p-1" style={{ background: "var(--surface-2)" }}>
          {(["none", "image", "video"] as const).map((k) => (
            <label key={k} className="cursor-pointer">
              <input
                type="radio" name="media_kind" value={k} checked={mediaKind === k}
                onChange={() => setMediaKind(k)} className="peer sr-only"
              />
              <span className="flex min-h-11 items-center justify-center rounded-xl px-1 text-center text-xs font-semibold text-muted peer-checked:bg-[var(--primary)] peer-checked:text-[var(--on-primary)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)]">
                {t(k === "none" ? "exercises.form.mediaNone" : k === "image" ? "exercises.form.mediaImage" : "exercises.form.mediaVideo")}
              </span>
            </label>
          ))}
        </div>
        {mediaKind !== "none" && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">{t("exercises.form.mediaUrl")}</span>
            <input
              name="media_url" type="url" inputMode="url" required pattern="https://.*" maxLength={2000}
              defaultValue={exercise?.media_url ?? ""} placeholder="https://" className="input min-h-11 w-full"
            />
            <span className="text-xs text-muted">{t("exercises.form.mediaHint")}</span>
          </label>
        )}
      </fieldset>

      {state.error && <p role="alert" className="text-sm text-danger">{t(state.error)}</p>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onDone} className="btn min-h-11 sm:min-w-28">{t("common.cancel")}</button>
        <button disabled={pending} className="btn btn-primary inline-flex min-h-11 items-center justify-center gap-2 sm:min-w-32">
          <Check size={18} aria-hidden />{pending ? t("exercises.form.saving") : t("exercises.form.save")}
        </button>
      </div>
    </form>
  );
}

function Check2({ name, text, hint, defaultChecked, disabled }: {
  name: string; text: string; hint?: string; defaultChecked?: boolean; disabled?: boolean;
}) {
  return (
    <label
      className={`flex min-h-12 items-center gap-3 rounded-2xl border px-4 py-2 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
      style={{ background: "var(--surface-2)" }}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{text}</span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} disabled={disabled} className="size-5 shrink-0 accent-[var(--primary)]" />
    </label>
  );
}
