"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Ban, Calendar, Check, ChevronDown, ClipboardList, Clock, Gauge, MapPin, MoreHorizontal, NotebookPen, Pencil, Plus, Repeat, RotateCcw, Tag, Trash2, TriangleAlert, Wrench } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { SESSION_TYPE_KEY, type MessageKey } from "@/lib/i18n";
import type { SessionType } from "@/lib/load";
import { FOCUS_LIST, MAX_LOCATION, MAX_NOTE, MAX_OCCURRENCES, RPE_BANDS, addDays, seriesDays, type SessionStatus } from "@/lib/session-plan";
import { createSessions, deleteSession, setSessionStatus, updateSession, type Scope, type SessionResult } from "@/app/team/[id]/sessions/actions";

const label = "eyebrow flex items-center gap-1.5";
const focusRing = "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)]";

export type PlannerSession = {
  id: string;
  type: SessionType;
  day: string; // YYYY-MM-DD Europe/Amsterdam
  time: string; // HH:MM Europe/Amsterdam
  duration: number;
  rpe: number | null;
  focus: string[];
  location: string | null;
  note: string | null;
  workoutId: string | null;
  status: SessionStatus;
  inSeries: boolean;
};
export type WorkoutOption = { id: string; name: string };

function Field({ icon: Icon, text, children }: { icon: typeof Tag; text: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={label}><Icon size={12} aria-hidden />{text}</span>
      {children}
    </label>
  );
}

function ScopeRadios({ value, onChange }: { value: Scope; onChange: (s: Scope) => void }) {
  const { t } = useT();
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className={`${label} mb-1.5`}>{t("sessions.scope")}</legend>
      {(["this", "series"] as const).map((s) => (
        <label key={s} className="relative block cursor-pointer">
          <input type="radio" name="scope" checked={value === s} onChange={() => onChange(s)} className="peer sr-only" />
          <span className={`flex min-h-11 items-center gap-2.5 rounded-md border px-3 text-sm peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent-soft)] ${focusRing}`}>
            <span aria-hidden className={`grid size-4 shrink-0 place-items-center rounded-full border ${value === s ? "border-[var(--accent)]" : ""}`}>
              {value === s && <span className="size-2 rounded-full bg-[var(--accent)]" />}
            </span>
            {t(s === "this" ? "sessions.scope.this" : "sessions.scope.series")}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function SessionForm({
  teamId, session, allowedTypes, workouts, today, onDone,
}: {
  teamId: string;
  session?: PlannerSession;
  allowedTypes: SessionType[];
  workouts: WorkoutOption[];
  today: string;
  onDone: () => void;
}) {
  const { t } = useT();
  const [type, setType] = useState<SessionType>(session?.type ?? allowedTypes[0]);
  const [rpe, setRpe] = useState(session?.rpe ? String(session.rpe) : "");
  const [date, setDate] = useState(session?.day ?? today);
  const [repeat, setRepeat] = useState<"none" | "weekly">("none");
  const [until, setUntil] = useState(addDays(session?.day ?? today, 35));
  const [scope, setScope] = useState<Scope>("this");
  const [error, setError] = useState<MessageKey | null>(null);
  const [pending, start] = useTransition();
  const isGym = type === "gym";
  const occurrences = repeat === "weekly" && until >= date ? seriesDays(date, until).length : 1;
  const tooMany = occurrences > MAX_OCCURRENCES;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const r: SessionResult = session ? await updateSession(session.id, session.inSeries ? scope : "this", fd) : await createSessions(teamId, fd);
      if (r.ok) onDone();
      else setError(r.error ?? "danger.error.generic");
    });
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3 text-sm">
      <div className="col-span-2">
        <Field icon={Tag} text={t("sessions.type")}>
          <select name="type" value={type} onChange={(e) => setType(e.target.value as SessionType)} className="input min-h-11 w-full">
            {allowedTypes.map((k) => <option key={k} value={k}>{t(SESSION_TYPE_KEY[k])}</option>)}
          </select>
        </Field>
      </div>
      <div className="col-span-2 sm:col-span-1">
        <Field icon={Calendar} text={t("sessions.date")}>
          <input name="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="input min-h-11 w-full" />
        </Field>
      </div>
      <Field icon={Clock} text={t("sessions.time")}>
        <input name="time" type="time" required defaultValue={session?.time ?? "18:00"} className="input min-h-11 w-full" />
      </Field>
      <Field icon={Clock} text={t("sessions.duration")}>
        <input name="duration" type="number" inputMode="numeric" min={1} max={600} required defaultValue={session?.duration ?? 90} className="input min-h-11 w-full" />
      </Field>
      <Field icon={Gauge} text={t("sessions.intensity")}>
        <select name="rpe" value={rpe} onChange={(e) => setRpe(e.target.value)} required={!isGym} className="input min-h-11 w-full">
          {isGym && <option value="">{t("sessions.intensityNone")}</option>}
          {!isGym && !rpe && <option value="" />}
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </Field>
      <div className="col-span-2 flex flex-wrap gap-1.5" role="group" aria-label={t("sessions.intensity")}>
        {RPE_BANDS.map((b) => {
          const n = Number(rpe);
          const active = n >= b.min && n <= b.max;
          return (
            <button
              key={b.key}
              type="button"
              aria-pressed={active}
              onClick={() => setRpe(String(b.pick))}
              className={`chip min-h-11 px-3.5 text-sm ${active ? "!border-[var(--accent)] !bg-[var(--accent-soft)] !text-[var(--foreground)]" : ""}`}
            >
              {t(`sessions.band.${b.key}` as MessageKey)}
            </button>
          );
        })}
      </div>

      <fieldset className={`col-span-2 flex flex-col gap-1.5 ${isGym ? "hidden" : ""}`}>
        <legend className={`${label} mb-1.5`}>{t("sessions.focus")} ({t("common.optional")})</legend>
        <div className="flex flex-wrap gap-1.5">
          {FOCUS_LIST.map((f) => (
            <label key={f} className="relative cursor-pointer">
              <input type="checkbox" name="focus" value={f} defaultChecked={session?.focus.includes(f)} className="peer sr-only" />
              <span className={`chip min-h-11 px-3.5 text-sm peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent-soft)] peer-checked:text-[var(--foreground)] ${focusRing}`}>
                {t(`sessions.focus.${f}` as MessageKey)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {isGym && workouts.length > 0 && (
        <div className="col-span-2">
          <Field icon={ClipboardList} text={`${t("sessions.workout")} (${t("common.optional")})`}>
            <select name="workout_id" defaultValue={session?.workoutId ?? ""} className="input min-h-11 w-full">
              <option value="">{t("sessions.workoutNone")}</option>
              {workouts.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Field>
        </div>
      )}
      <div className="col-span-2 sm:col-span-1">
        <Field icon={MapPin} text={`${t("sessions.location")} (${t("common.optional")})`}>
          <input name="location" maxLength={MAX_LOCATION} defaultValue={session?.location ?? ""} className="input min-h-11 w-full" />
        </Field>
      </div>
      <div className="col-span-2">
        <Field icon={NotebookPen} text={`${t("sessions.coachNote")} (${t("common.optional")})`}>
          <textarea name="note" rows={2} maxLength={MAX_NOTE} defaultValue={session?.note ?? ""} className="input w-full" />
        </Field>
      </div>

      {!session && (
        <>
          <div className="col-span-2 sm:col-span-1">
            <Field icon={Repeat} text={t("sessions.repeat")}>
              <select name="repeat" value={repeat} onChange={(e) => setRepeat(e.target.value as "none" | "weekly")} className="input min-h-11 w-full">
                <option value="none">{t("sessions.repeat.none")}</option>
                <option value="weekly">{t("sessions.repeat.weekly")}</option>
              </select>
            </Field>
          </div>
          {repeat === "weekly" && (
            <div className="col-span-2 flex flex-col gap-2 sm:col-span-1">
              <Field icon={Calendar} text={t("sessions.repeat.until")}>
                <input name="until" type="date" required value={until} min={date} onChange={(e) => setUntil(e.target.value)} className="input min-h-11 w-full" />
              </Field>
              <p className={`text-xs ${tooMany || until < date ? "text-danger" : "text-muted"}`}>
                {tooMany || until < date ? t("sessions.error.repeat") : t("sessions.repeat.count", { n: occurrences })}
              </p>
            </div>
          )}
        </>
      )}

      {session?.inSeries && (
        <div className="col-span-2"><ScopeRadios value={scope} onChange={setScope} /></div>
      )}

      {error && <p role="alert" className="col-span-2 text-sm text-danger">{t(error)}</p>}
      <div className={`col-span-2 mt-1 ${session ? "sticky bottom-0 z-10 -mx-5 -mb-2 border-t bg-[var(--surface)] px-5 py-3" : "action-bar glass rounded-md p-2"}`}>
        <button disabled={pending || (repeat === "weekly" && !session && (tooMany || until < date))} className="btn btn-primary inline-flex min-h-12 w-full items-center justify-center gap-2">
          {session ? <Check size={18} aria-hidden /> : <Plus size={18} aria-hidden />}
          {pending ? t("common.loading") : session ? t("common.save") : t("sessions.plan")}
        </button>
      </div>
    </form>
  );
}

/** Collapsible "Plan session" card for staff who may plan at least one type. */
export function PlanSessionCard({ teamId, allowedTypes, workouts, today }: { teamId: string; allowedTypes: SessionType[]; workouts: WorkoutOption[]; today: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [nonce, setNonce] = useState(0);
  return (
    <details className="card group !p-0" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-2 px-4 font-semibold [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2"><Plus size={18} aria-hidden className="text-[var(--accent)]" />{t("sessions.planTitle")}</span>
        <span className="flex items-center gap-2">
          <span role="status" className="text-xs font-normal text-[var(--ok)]">{saved && !open ? t("common.saved") : ""}</span>
          <ChevronDown size={16} aria-hidden className="text-muted transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="border-t p-4">
        <SessionForm
          key={nonce}
          teamId={teamId}
          allowedTypes={allowedTypes}
          workouts={workouts}
          today={today}
          onDone={() => { setSaved(true); setNonce((n) => n + 1); setOpen(false); }}
        />
      </div>
    </details>
  );
}

type Kind = "edit" | "status" | "delete";

/** Edit / cancel / adjust / restore / delete controls of one session. Rendered only for staff who may plan its type. */
export function SessionManage({ teamId, session, allowedTypes, workouts, today, lead, links = [] }: {
  teamId: string; session: PlannerSession; allowedTypes: SessionType[]; workouts: WorkoutOption[]; today: string;
  /** Primary action of the row (e.g. "Logged sets"). Without it "Manage" is the primary action; with it manage collapses to a "..." button. */
  lead?: React.ReactNode;
  /** Secondary links (iPad mode, review, ...) shown inside the opened panel. */
  links?: { href: string; label: string }[];
}) {
  const { t } = useT();
  const refs = { edit: useRef<HTMLDialogElement>(null), status: useRef<HTMLDialogElement>(null), delete: useRef<HTMLDialogElement>(null) };
  const [target, setTarget] = useState<SessionStatus>("cancelled");
  const [scope, setScope] = useState<Scope>("this");
  const [note, setNote] = useState("");
  const [error, setError] = useState<MessageKey | null>(null);
  const [pending, start] = useTransition();
  const [formKey, setFormKey] = useState(0);
  const [panel, setPanel] = useState(false);
  const panelId = `manage-${session.id}`;

  const open = (k: Kind) => { setError(null); setScope("this"); refs[k].current?.showModal(); };
  const close = (k: Kind) => refs[k].current?.close();

  function openStatus(s: SessionStatus) {
    setTarget(s);
    setNote(s === "planned" ? "" : session.note ?? "");
    open("status");
  }
  function run(k: Kind, fn: () => Promise<SessionResult>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (r.ok) close(k);
      else setError(r.error ?? "danger.error.generic");
    });
  }
  const effScope: Scope = session.inSeries ? scope : "this";
  const cancelled = session.status === "cancelled";
  const btn = "btn inline-flex min-h-11 items-center gap-2 text-sm";
  const dlg = "confirm !rounded-md !p-5 max-h-[90dvh] overflow-y-auto";
  const title = target === "cancelled" ? "sessions.dialog.cancel" : target === "planned" ? "sessions.dialog.restore" : "sessions.dialog.adjusted";
  const body = target === "cancelled" ? "sessions.dialog.cancelBody" : target === "planned" ? "sessions.dialog.restoreBody" : "sessions.dialog.adjustedBody";

  return (
    <div className="border-t pt-1">
      <div className="flex items-center justify-between gap-2">
        {lead}
        <button
          type="button"
          aria-expanded={panel}
          aria-controls={panelId}
          aria-label={lead ? t("sessions.manage") : undefined}
          title={lead ? t("sessions.moreActions") : undefined}
          onClick={() => setPanel((v) => !v)}
          className={lead
            ? "ml-auto grid size-11 shrink-0 place-items-center rounded-md text-muted hover:text-[var(--foreground)]"
            : "flex min-h-11 flex-1 cursor-pointer items-center justify-between gap-2 text-sm text-muted"}
        >
          {lead ? <MoreHorizontal size={18} aria-hidden /> : (
            <>
              <span className="flex items-center gap-2"><Wrench size={14} aria-hidden />{t("sessions.manage")}</span>
              <ChevronDown size={16} aria-hidden className={`transition-transform ${panel ? "rotate-180" : ""}`} />
            </>
          )}
        </button>
      </div>
      <div id={panelId} hidden={!panel}>
        {links.length > 0 && (
          <div className="flex flex-wrap gap-x-4 pt-1">
            {links.map((l) => <Link key={l.href} href={l.href} className="link inline-flex min-h-11 items-center text-sm">{l.label}</Link>)}
          </div>
        )}
        <div className="flex flex-wrap gap-2 pb-1 pt-1">
          <button type="button" className={btn} onClick={() => open("edit")}><Pencil size={16} aria-hidden />{t("sessions.edit")}</button>
          {cancelled ? (
            <button type="button" className={btn} onClick={() => openStatus("planned")}><RotateCcw size={16} aria-hidden />{t("sessions.restore")}</button>
          ) : (
            <>
              <button type="button" className={btn} onClick={() => openStatus("adjusted")}><NotebookPen size={16} aria-hidden />{t("sessions.markAdjusted")}</button>
              <button type="button" className={btn} onClick={() => openStatus("cancelled")}><Ban size={16} aria-hidden />{t("sessions.cancelSession")}</button>
            </>
          )}
        </div>
        {/* destructive action on its own row, away from the edit / cancel buttons */}
        <div className="mt-1 flex justify-end border-t pb-1 pt-2">
          <button type="button" className={`${btn} btn-danger`} onClick={() => open("delete")}><Trash2 size={16} aria-hidden />{t("sessions.deleteSession")}</button>
        </div>
      </div>

      <dialog ref={refs.edit} className={dlg} onClose={() => setFormKey((n) => n + 1)}>
        <h2 className="display mb-4 text-2xl leading-tight">{t("sessions.dialog.edit")}</h2>
        <SessionForm key={formKey} teamId={teamId} session={session} allowedTypes={allowedTypes} workouts={workouts} today={today} onDone={() => close("edit")} />
        <button type="button" onClick={() => close("edit")} className="btn mt-2 min-h-11 w-full">{t("common.cancel")}</button>
      </dialog>

      <dialog ref={refs.status} className={dlg}>
        <form
          onSubmit={(e) => { e.preventDefault(); run("status", () => setSessionStatus(session.id, target, effScope, target === "planned" ? null : note)); }}
          className="flex flex-col gap-4"
        >
          <h2 className="display text-2xl leading-tight">{t(title)}</h2>
          <p className="text-sm text-muted">{t(body)}</p>
          {target !== "planned" && (
            <Field icon={NotebookPen} text={t("sessions.reason")}>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={MAX_NOTE} placeholder={t("sessions.reasonPh")} className="input w-full" />
            </Field>
          )}
          {session.inSeries && <ScopeRadios value={scope} onChange={setScope} />}
          {error && <p role="alert" className="text-sm text-danger">{t(error)}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => close("status")} className="btn min-h-11 sm:min-w-28">{t("common.cancel")}</button>
            <button disabled={pending} className="btn btn-primary inline-flex min-h-11 items-center justify-center gap-2">
              <Check size={16} aria-hidden />{pending ? t("common.loading") : t("sessions.dialog.confirm")}
            </button>
          </div>
        </form>
      </dialog>

      <dialog ref={refs.delete} className={dlg}>
        <form onSubmit={(e) => { e.preventDefault(); run("delete", () => deleteSession(session.id, effScope)); }} className="flex flex-col gap-4">
          <span aria-hidden className="grid size-12 place-items-center rounded-md border text-danger" style={{ background: "var(--danger-bg)", borderColor: "color-mix(in srgb, var(--danger) 35%, transparent)" }}>
            <TriangleAlert size={22} />
          </span>
          <h2 className="display text-2xl leading-tight">{t("sessions.dialog.delete")}</h2>
          <p className="text-sm text-muted">{t("sessions.dialog.deleteBody")}</p>
          {session.inSeries && <ScopeRadios value={scope} onChange={setScope} />}
          {error && <p role="alert" className="text-sm text-danger">{t(error)}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => close("delete")} className="btn min-h-11 sm:min-w-28">{t("common.cancel")}</button>
            <button disabled={pending} className="btn btn-danger inline-flex min-h-11 items-center justify-center gap-2 !bg-[var(--danger)] !text-[var(--background)]">
              <Trash2 size={16} aria-hidden />{pending ? t("common.loading") : t("sessions.deleteSession")}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
