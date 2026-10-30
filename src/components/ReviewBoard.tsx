"use client";

import { useState, useTransition } from "react";
import {
  ArrowDown, ArrowUp, BedDouble, ChevronDown, ClipboardPen, Pencil, Plus, Tablet, User,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { ConfirmButton } from "@/components/ConfirmButton";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";
import type { ExerciseKind } from "@/lib/exercises";
import {
  addRunSet, correctLog, createRunForAthlete, deleteRunSet, updateRunSet,
  type ReviewResult, type SetValues,
} from "@/app/team/[id]/review/actions";

export type SetType = "warmup" | "normal" | "failure" | "drop";
export type Side = "left" | "right" | null;
export type Status = "inProgress" | "finished" | "notStarted" | "resting";
export type Via = "self" | "kiosk" | "coach";

export type LoggedVM = { id: string; weight: number | null; reps: number | null; rpe: number | null; setType: SetType };
export type RowVM = {
  key: string;
  exerciseId: string;
  setIndex: number;
  side: Side;
  /** Round without a planned set. */
  extra: boolean;
  setType: SetType;
  plan: { reps: number | null; rpe: number | null; kg: number | null } | null;
  logged: LoggedVM | null;
  /** Logged weight far from the prescribed fixed weight. */
  dev: "up" | "down" | null;
};
export type BlockVM = {
  key: string;
  letter: string;
  exerciseId: string;
  name: string;
  kind: ExerciseKind;
  perSide: boolean;
  /** Last block of its exercise: extra rounds live here. */
  last: boolean;
  nextIndex: number;
  rows: RowVM[];
};
export type AthleteVM = {
  id: string;
  name: string;
  status: Status;
  runId: string | null;
  via: Via | null;
  durationMin: number | null;
  rpe: number | null;
  suggestedMin: number | null;
  workingDone: number;
  workingPlanned: number;
  tonnage: number;
  blocks: BlockVM[];
};

type Pending = { exerciseId: string; setIndex: number; side: Side };

const STATUS_BADGE: Record<Status, string> = {
  inProgress: "badge badge-watch",
  finished: "badge badge-ok",
  notStarted: "badge badge-none",
  resting: "badge badge-none",
};
const VIA_ICON = { self: User, kiosk: Tablet, coach: ClipboardPen } as const;
const TYPE_LETTER: Record<SetType, string | null> = { warmup: "W", failure: "F", drop: "D", normal: null };
const TYPE_STYLE: Record<SetType, { bg: string; fg: string }> = {
  warmup: { bg: "var(--warn-bg)", fg: "var(--warn)" },
  failure: { bg: "var(--danger-bg)", fg: "var(--danger)" },
  drop: { bg: "var(--accent-soft)", fg: "var(--accent)" },
  normal: { bg: "var(--surface-3)", fg: "var(--foreground)" },
};
const SET_TYPES: SetType[] = ["normal", "warmup", "failure", "drop"];
const RPE_STEPS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

/** Accepts "62,5" and "62.5"; empty is null; anything else is NaN. */
function parseNum(s: string): number | null {
  const v = s.trim().replace(",", ".");
  if (v === "") return null;
  return /^\d+(\.\d+)?$/.test(v) ? Number(v) : NaN;
}

const showsWeight = (k: ExerciseKind) => k === "weight_reps" || k === "weighted_bodyweight";
const hasRpe = (k: ExerciseKind) => k !== "height_cm" && k !== "duration_s";

export function ReviewBoard({ teamId, sessionId, athletes }: { teamId: string; sessionId: string; athletes: AthleteVM[] }) {
  return (
    <ul className="stagger flex flex-col gap-3">
      {athletes.map((a) => (
        <AthleteCard key={a.id} teamId={teamId} sessionId={sessionId} athlete={a} />
      ))}
    </ul>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="eyebrow">{label}</dt>
      <dd className="num text-xl">{children}</dd>
    </div>
  );
}

function AthleteCard({ teamId, sessionId, athlete: a }: { teamId: string; sessionId: string; athlete: AthleteVM }) {
  const { t, locale } = useT();
  const [open, setOpen] = useState(a.status === "inProgress");
  const [correcting, setCorrecting] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, startTransition] = useTransition();

  const nf = (n: number) => n.toLocaleString(locale === "nl" ? "nl-NL" : "en-GB", { maximumFractionDigits: 0 });
  const hasRun = a.runId !== null;
  const hasStats = hasRun || a.durationMin !== null;
  const contentId = `review-${a.id}`;

  function startRun() {
    setError(null);
    startTransition(async () => {
      const res = await createRunForAthlete(teamId, sessionId, a.id);
      if (!res.ok) setError(res.error ?? "run.error.save");
      else setOpen(true);
    });
  }

  function addExtra(b: BlockVM) {
    const top = Math.max(b.nextIndex, ...pending.filter((p) => p.exerciseId === b.exerciseId).map((p) => p.setIndex + 1));
    const sides: Side[] = b.perSide ? ["left", "right"] : [null];
    setPending((p) => [...p, ...sides.map((side) => ({ exerciseId: b.exerciseId, setIndex: top, side }))]);
  }

  const dropPending = (p: Pending) =>
    setPending((list) => list.filter((x) => !(x.exerciseId === p.exerciseId && x.setIndex === p.setIndex && x.side === p.side)));

  return (
    <li className="card flex flex-col gap-4 text-sm">
      {hasRun ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={contentId}
          aria-label={t(open ? "review.card.hide" : "review.card.show", { name: a.name })}
          className="-m-1 flex min-h-12 items-center gap-3 rounded-2xl p-1 text-left"
        >
          <Avatar name={a.name} size={44} />
          <Heading a={a} />
          <ChevronDown size={20} aria-hidden className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      ) : (
        <div className="flex min-h-12 items-center gap-3">
          <Avatar name={a.name} size={44} />
          <Heading a={a} />
        </div>
      )}

      {a.status === "resting" && !hasRun && (
        <p className="flex items-center gap-2 text-muted"><BedDouble size={16} aria-hidden />{t("review.card.restNote")}</p>
      )}

      {hasStats ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Stat label={t("review.card.duration")}>
            {a.durationMin !== null ? <>{a.durationMin}<span className="ml-1 text-xs font-semibold text-muted">{t("common.min")}</span></> : "–"}
          </Stat>
          <Stat label={t("review.card.rpe")}>{a.rpe !== null ? a.rpe : "–"}</Stat>
          <Stat label={t("review.card.sets")}>
            {t("review.card.setsValue", { done: a.workingDone, planned: a.workingPlanned })}
          </Stat>
          <Stat label={t("review.card.tonnage")}>
            {nf(a.tonnage)}<span className="ml-1 text-xs font-semibold text-muted">{t("review.unit.kg")}</span>
          </Stat>
        </dl>
      ) : a.status === "notStarted" ? (
        <p className="text-muted">{t("review.card.noData")}</p>
      ) : null}

      {error && <p role="alert" className="text-danger">{t(error)}</p>}

      {hasRun && open && (
        <div id={contentId} className="flex flex-col gap-5">
          <hr className="hairline" />
          {a.blocks.map((b) => (
            <BlockSection
              key={b.key}
              teamId={teamId}
              runId={a.runId!}
              athleteName={a.name}
              block={b}
              pending={pending.filter((p) => p.exerciseId === b.exerciseId)}
              onAddExtra={() => addExtra(b)}
              onDropPending={dropPending}
            />
          ))}
        </div>
      )}

      {hasRun && (
        correcting ? (
          <CorrectForm
            teamId={teamId}
            runId={a.runId!}
            athlete={a}
            onDone={() => setCorrecting(false)}
          />
        ) : (
          <button type="button" onClick={() => setCorrecting(true)} className="btn inline-flex min-h-11 w-fit items-center gap-2">
            <Pencil size={16} aria-hidden />
            {t(a.status === "finished" ? "review.correct.button" : "review.correct.finish")}
          </button>
        )
      )}

      {!hasRun && a.status !== "resting" && (
        <button type="button" onClick={startRun} disabled={busy} className="btn btn-primary inline-flex min-h-11 w-fit items-center gap-2">
          <ClipboardPen size={16} aria-hidden />
          {busy ? t("review.logFor.busy") : t("review.logFor.button")}
        </button>
      )}

    </li>
  );
}

function Heading({ a }: { a: AthleteVM }) {
  const { t } = useT();
  const ViaIcon = a.via ? VIA_ICON[a.via] : null;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <p className="truncate text-base font-semibold">{a.name}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={STATUS_BADGE[a.status]}>{t(`review.status.${a.status}`)}</span>
        {ViaIcon && a.via && (
          <span className="chip" title={t("review.via.label", { via: t(`review.via.${a.via}`) })}>
            <ViaIcon size={12} aria-hidden />{t(`review.via.${a.via}`)}
          </span>
        )}
      </div>
    </div>
  );
}

function BlockSection({
  teamId, runId, athleteName, block: b, pending, onAddExtra, onDropPending,
}: {
  teamId: string; runId: string; athleteName: string; block: BlockVM; pending: Pending[];
  onAddExtra: () => void; onDropPending: (p: Pending) => void;
}) {
  const { t } = useT();
  const known = new Set(b.rows.map((r) => r.key));
  const ghosts: RowVM[] = b.last
    ? pending
        .map((p) => ({
          key: `${p.exerciseId}:${p.setIndex}:${p.side ?? ""}`, exerciseId: p.exerciseId, setIndex: p.setIndex, side: p.side,
          extra: true, setType: "normal" as SetType, plan: null, logged: null, dev: null,
        }))
        .filter((r) => !known.has(r.key))
    : [];

  return (
    <section className="flex flex-col gap-2" aria-label={b.name}>
      <h3 className="flex items-baseline gap-2 text-base font-bold">
        <span className="eyebrow">{t("review.block.label", { letter: b.letter })}</span>
        <span className="min-w-0 truncate">{b.name}</span>
      </h3>
      <ul className="flex flex-col gap-2">
        {[...b.rows, ...ghosts].map((r) => (
          <SetRow
            key={r.key}
            teamId={teamId}
            runId={runId}
            athleteName={athleteName}
            block={b}
            row={r}
            ghost={ghosts.includes(r)}
            onDiscard={() => onDropPending({ exerciseId: r.exerciseId, setIndex: r.setIndex, side: r.side })}
          />
        ))}
      </ul>
      {b.last && (
        <button type="button" onClick={onAddExtra} className="btn inline-flex min-h-11 w-fit items-center gap-2">
          <Plus size={16} aria-hidden />{t("review.add.extra")}
        </button>
      )}
    </section>
  );
}

function valueText(t: ReturnType<typeof useT>["t"], locale: string, kind: ExerciseKind, weight: number | null, reps: number | null) {
  const kg = (n: number) => n.toLocaleString(locale === "nl" ? "nl-NL" : "en-GB", { maximumFractionDigits: 2 });
  if (reps === null) return "–";
  if (kind === "height_cm") return t("review.logged.cm", { n: reps });
  if (kind === "duration_s") return t("review.logged.sec", { n: reps });
  if (showsWeight(kind) && weight !== null) {
    return `${kind === "weighted_bodyweight" ? "+" : ""}${kg(weight)} ${t("review.unit.kg")} × ${reps}`;
  }
  return t("review.plan.reps", { reps });
}

function SetRow({
  teamId, runId, athleteName, block, row, ghost, onDiscard,
}: {
  teamId: string; runId: string; athleteName: string; block: BlockVM; row: RowVM; ghost: boolean; onDiscard: () => void;
}) {
  const { t, locale } = useT();
  const [editing, setEditing] = useState(ghost);
  const l = row.logged;
  const type = l?.setType ?? row.setType;
  const letter = TYPE_LETTER[type];
  const style = TYPE_STYLE[type];
  const label = t("review.set.label", { n: row.setIndex });
  const aria = t("review.edit.aria", { exercise: block.name, n: row.setIndex });

  const planParts: string[] = [];
  if (row.plan) {
    if (row.plan.reps !== null) planParts.push(valueText(t, locale, block.kind, null, row.plan.reps));
    if (row.plan.rpe !== null && hasRpe(block.kind)) planParts.push(t("review.plan.rpe", { rpe: row.plan.rpe }));
    if (row.plan.kg !== null) planParts.push(t("review.plan.kg", { kg: row.plan.kg }));
  }

  async function save(values: SetValues): Promise<ReviewResult> {
    const res = l
      ? await updateRunSet(teamId, runId, l.id, row.extra ? values : { weight: values.weight, reps: values.reps, rpe: values.rpe })
      : await addRunSet(teamId, runId, {
          ...values, exerciseId: row.exerciseId, setIndex: row.setIndex, side: row.side,
          setType: row.extra ? values.setType : undefined,
        });
    if (res.ok) {
      setEditing(false);
      if (ghost) onDiscard();
    }
    return res;
  }

  function cancel() {
    setEditing(false);
    if (ghost) onDiscard();
  }

  return (
    <li
      className="flex flex-col gap-2 rounded-2xl border p-3"
      style={{
        background: row.dev ? "color-mix(in srgb, var(--warn-bg) 55%, transparent)" : "color-mix(in srgb, var(--surface-2) 45%, transparent)",
        boxShadow: row.dev ? "inset 3px 0 0 var(--warn)" : undefined,
      }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span
          className="inline-grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold"
          style={{ background: style.bg, color: style.fg }}
          title={t(`review.type.${type}`)}
        >
          {letter ?? row.setIndex}
          <span className="sr-only"> {t(`review.type.${type}`)}</span>
        </span>
        <span className="font-semibold">{label}</span>
        {row.side && <span className="chip">{t(row.side === "left" ? "review.set.left" : "review.set.right")}</span>}
        {row.extra && <span className="chip">{t("review.set.extra")}</span>}
      </div>

      {!editing && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <dl className="grid min-w-0 flex-1 grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {row.plan && (
              <>
                <dt className="eyebrow self-center">{t("review.plan.label")}</dt>
                <dd className="text-muted">{planParts.length ? planParts.join(" · ") : t("review.plan.free")}</dd>
              </>
            )}
            <dt className="eyebrow self-center">{t("review.logged.label")}</dt>
            <dd className="flex flex-wrap items-center gap-1.5 font-semibold">
              {l ? (
                <>
                  <span>{valueText(t, locale, block.kind, l.weight, l.reps)}</span>
                  {l.rpe !== null && hasRpe(block.kind) && <span className="text-muted">{t("review.plan.rpe", { rpe: l.rpe })}</span>}
                  {row.dev && (
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--warn)]" title={t(`review.dev.${row.dev}`)}>
                      {row.dev === "up" ? <ArrowUp size={14} aria-hidden /> : <ArrowDown size={14} aria-hidden />}
                      <span className="sr-only">{t(`review.dev.${row.dev}`)}</span>
                    </span>
                  )}
                </>
              ) : (
                <span className="font-normal text-muted">{t("review.logged.none")}</span>
              )}
            </dd>
          </dl>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => setEditing(true)} aria-label={`${t(l ? "review.edit.button" : "review.edit.fill")}: ${aria}`} className="btn inline-flex min-h-11 items-center gap-2">
              <Pencil size={16} aria-hidden />{t(l ? "review.edit.button" : "review.edit.fill")}
            </button>
            {l && (
              <ConfirmButton
                action={deleteRunSet.bind(null, teamId, runId, l.id)}
                icon="trash"
                iconOnly
                className="!size-11"
                label={`${t("review.delete.label")}: ${aria}`}
                title={t("review.delete.title")}
                body={t("review.delete.body", { name: athleteName })}
              />
            )}
          </div>
        </div>
      )}

      {editing && (
        <SetEditor
          kind={block.kind}
          initial={l}
          extra={row.extra}
          initialType={type}
          ariaLabel={aria}
          onSave={save}
          onCancel={cancel}
        />
      )}
    </li>
  );
}

function SetEditor({
  kind, initial, extra, initialType, ariaLabel, onSave, onCancel,
}: {
  kind: ExerciseKind; initial: LoggedVM | null; extra: boolean; initialType: SetType; ariaLabel: string;
  onSave: (v: SetValues) => Promise<ReviewResult>; onCancel: () => void;
}) {
  const { t, locale } = useT();
  const fmt = (n: number | null) =>
    n === null ? "" : n.toLocaleString(locale === "nl" ? "nl-NL" : "en-GB", { maximumFractionDigits: 2, useGrouping: false });
  const [weight, setWeight] = useState(fmt(initial?.weight ?? null));
  const [reps, setReps] = useState(initial?.reps != null ? String(initial.reps) : "");
  const [rpe, setRpe] = useState(initial?.rpe != null ? String(initial.rpe) : "");
  const [setType, setSetType] = useState<SetType>(initialType);
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, startTransition] = useTransition();

  const repsLabel = kind === "height_cm" ? "review.edit.cm" : kind === "duration_s" ? "review.edit.sec" : "review.edit.reps";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const w = parseNum(weight);
    const r = parseNum(reps);
    const p = rpe === "" ? null : Number(rpe);
    if (Number.isNaN(w)) return setError("run.error.weight");
    if (r === null || Number.isNaN(r) || !Number.isInteger(r)) return setError("run.error.reps");
    setError(null);
    startTransition(async () => {
      const res = await onSave({
        weight: showsWeight(kind) ? w : null,
        reps: r,
        rpe: hasRpe(kind) && setType !== "failure" ? p : null,
        setType,
      });
      if (!res.ok) setError(res.error ?? "run.error.save");
    });
  }

  return (
    <form onSubmit={submit} aria-label={ariaLabel} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {showsWeight(kind) && (
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">{t(kind === "weighted_bodyweight" ? "review.edit.addedWeight" : "review.edit.weight")}</span>
            <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" autoComplete="off" className="input min-h-11" />
          </label>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">{t(repsLabel)}</span>
          <input value={reps} onChange={(e) => setReps(e.target.value)} inputMode="numeric" autoComplete="off" className="input min-h-11" />
        </label>
        {hasRpe(kind) && setType !== "failure" && (
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">{t("review.edit.rpe")}</span>
            <select value={rpe} onChange={(e) => setRpe(e.target.value)} className="input min-h-11">
              <option value="">{t("review.edit.rpeNone")}</option>
              {RPE_STEPS.map((v) => (
                <option key={v} value={String(v)}>{v.toLocaleString(locale === "nl" ? "nl-NL" : "en-GB")}</option>
              ))}
            </select>
          </label>
        )}
        {extra && (
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">{t("review.edit.type")}</span>
            <select value={setType} onChange={(e) => setSetType(e.target.value as SetType)} className="input min-h-11">
              {SET_TYPES.map((ty) => (
                <option key={ty} value={ty}>{t(`review.type.${ty}`)}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      {error && <p role="alert" className="text-danger">{t(error)}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="btn min-h-11 sm:min-w-28">{t("common.cancel")}</button>
        <button disabled={busy} className="btn btn-primary min-h-11 sm:min-w-28">
          {busy ? t("review.edit.saving") : t("review.edit.save")}
        </button>
      </div>
    </form>
  );
}

function CorrectForm({
  teamId, runId, athlete: a, onDone,
}: {
  teamId: string; runId: string; athlete: AthleteVM; onDone: () => void;
}) {
  const { t } = useT();
  const [duration, setDuration] = useState(String(a.durationMin ?? a.suggestedMin ?? ""));
  const [rpe, setRpe] = useState(a.rpe !== null ? String(Math.round(a.rpe)) : "");
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const d = Number(duration);
    const r = Number(rpe);
    if (!/^\d+$/.test(duration.trim()) || d < 1 || d > 600) return setError("run.error.duration");
    if (!/^\d+$/.test(rpe) || r < 1 || r > 10) return setError("run.error.rpeLog");
    setError(null);
    startTransition(async () => {
      const res = await correctLog(teamId, runId, d, r);
      if (!res.ok) setError(res.error ?? "run.error.save");
      else onDone();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border p-3">
      <p className="font-semibold">{t("review.correct.title", { name: a.name })}</p>
      <p className="text-muted">{t("review.correct.hint")}</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">{t("review.correct.duration")}</span>
          <input value={duration} onChange={(e) => setDuration(e.target.value)} inputMode="numeric" autoComplete="off" className="input min-h-11" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">{t("review.correct.rpe")}</span>
          <select value={rpe} onChange={(e) => setRpe(e.target.value)} className="input min-h-11">
            <option value="" disabled>–</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
              <option key={v} value={String(v)}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      {error && <p role="alert" className="text-danger">{t(error)}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onDone} className="btn min-h-11 sm:min-w-28">{t("common.cancel")}</button>
        <button disabled={busy} className="btn btn-primary min-h-11 sm:min-w-28">
          {busy ? t("review.edit.saving") : t("review.correct.save")}
        </button>
      </div>
    </form>
  );
}
