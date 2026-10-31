"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, ChevronRight, Minus, Plus, MessageSquare, X } from "lucide-react";
import { RpePicker } from "@/components/RpePicker";
import { SessionTypeIcon } from "@/components/icons";
import { useT } from "@/lib/i18n/client";
import { SESSION_TYPE_KEY, dateLocale, type Locale, type MessageKey } from "@/lib/i18n";
import type { SessionType } from "@/lib/load";
import { TEAM_TIME_ZONE } from "@/lib/wellness";
import { logSession } from "@/app/actions";

export type QuickLogItem = {
  id: string;
  type: SessionType;
  title: string;
  startsAt: string;
  plannedDurationMin: number;
  plannedRpe: number | null;
};

const NOTE_MAX = 300;
const MIN_MINUTES = 1;
const MAX_MINUTES = 600;
const SAVED_MS = 800;

const ring = { boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent)" } as const;

const parseMinutes = (raw: string): number | null => {
  if (!/^\d{1,3}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= MIN_MINUTES && n <= MAX_MINUTES ? n : null;
};

/** Minutes with -5 / +5 steppers. Typing is allowed. Works in plain forms (named input) and controlled. */
export function MinutesStepper({
  value, defaultValue = 60, onChange, name = "duration_min", disabled,
}: { value?: string; defaultValue?: number | string; onChange?: (v: string) => void; name?: string; disabled?: boolean }) {
  const { t } = useT();
  const [inner, setInner] = useState(String(defaultValue));
  const raw = value ?? inner;
  const set = (v: string) => {
    if (value === undefined) setInner(v);
    onChange?.(v);
  };
  const step = (d: number) => {
    const cur = parseMinutes(raw) ?? 0;
    set(String(Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, cur + d))));
  };
  const btn =
    "btn grid size-[3.25rem] shrink-0 place-items-center !p-0 disabled:cursor-not-allowed";
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={btn} onClick={() => step(-5)} disabled={disabled} aria-label={t("quicklog.minutes.less")}>
        <Minus size={20} aria-hidden />
      </button>
      <input
        name={name}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={3}
        value={raw}
        disabled={disabled}
        aria-label={t("quicklog.minutes.label")}
        onChange={(e) => set(e.target.value.replace(/\D/g, ""))}
        onBlur={() => {
          const n = Number(raw);
          if (raw !== "" && Number.isFinite(n)) set(String(Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, n))));
        }}
        className="input num h-[3.25rem] min-w-0 flex-1 text-center text-2xl"
      />
      <button type="button" className={btn} onClick={() => step(5)} disabled={disabled} aria-label={t("quicklog.minutes.more")}>
        <Plus size={20} aria-hidden />
      </button>
    </div>
  );
}

type Draft = { attended: boolean; rpe: number | null; minutes: string; note: string };

const initialDraft = (i: QuickLogItem): Draft => ({
  attended: true, rpe: null, minutes: String(i.plannedDurationMin || 60), note: "",
});

const when = (iso: string, locale: Locale) =>
  new Date(iso).toLocaleString(dateLocale(locale), {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TEAM_TIME_ZONE,
  });

function LogCard({
  teamId, item, draft, setDraft, onDone, focusOnMount,
}: {
  teamId: string;
  item: QuickLogItem;
  draft: Draft;
  setDraft: (d: Draft) => void;
  onDone: () => void;
  focusOnMount: boolean;
}) {
  const { t, locale } = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<MessageKey | null>(null);
  const [saved, setSaved] = useState(false);
  const [noteOpen, setNoteOpen] = useState(draft.note.length > 0);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteId = `note-${item.id}`;
  const name = `${t(SESSION_TYPE_KEY[item.type])}${item.title ? ` ${item.title}` : ""}`;

  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [focusOnMount]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || saved) return;
    const minutes = parseMinutes(draft.minutes);
    if (draft.attended && draft.rpe === null) { setError("quicklog.error.rpe"); return; }
    if (draft.attended && minutes === null) { setError("quicklog.error.minutes"); return; }
    const fd = new FormData();
    if (draft.attended) {
      fd.set("attended", "on");
      fd.set("duration_min", String(minutes));
      fd.set("rpe", String(draft.rpe));
    }
    fd.set("note", draft.note);
    setError(null);
    start(async () => {
      try {
        await logSession(teamId, item.id, fd);
      } catch {
        setError("quicklog.error.save");
        return;
      }
      setSaved(true);
      timer.current = setTimeout(onDone, SAVED_MS);
    });
  }

  return (
    <div ref={ref} tabIndex={-1} aria-label={name} className="card rise flex flex-col gap-4 focus:outline-none">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full text-[var(--accent)]" style={ring}>
          <SessionTypeIcon type={item.type} size={20} />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold leading-tight">{name}</h3>
          <p className="text-sm text-muted">{when(item.startsAt, locale)}</p>
        </div>
      </div>

      {saved ? (
        <div className="grid min-h-40 place-items-center" role="status">
          <div className="flex flex-col items-center gap-3">
            <span className="ql-pop grid size-14 place-items-center rounded-full bg-[var(--ok-bg)] text-[var(--ok)]">
              <Check size={28} aria-hidden />
            </span>
            <p className="font-semibold">{t("quicklog.saved")}</p>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" aria-busy={pending}>
          <fieldset className="m-0 min-w-0 border-0 p-0" disabled={pending}>
            <legend className="sr-only">{t("quicklog.attendance.group")}</legend>
            <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-2xl border bg-[var(--surface-2)] p-1">
              {([[true, "quicklog.attendance.present", Check], [false, "quicklog.attendance.absent", X]] as const).map(([val, key, Icon]) => (
                <label key={key} className="relative block">
                  <input
                    type="radio"
                    name={`att-${item.id}`}
                    checked={draft.attended === val}
                    onChange={() => { setDraft({ ...draft, attended: val }); setError(null); }}
                    className="peer sr-only"
                  />
                  <span className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold text-muted transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)] ${val ? "peer-checked:bg-[var(--primary)] peer-checked:text-[var(--on-primary)]" : "peer-checked:bg-[var(--surface-3)] peer-checked:text-foreground"}`}>
                    <Icon size={16} aria-hidden />{t(key)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {draft.attended ? (
            <>
              <RpePicker
                value={draft.rpe}
                onChange={(rpe) => { setDraft({ ...draft, rpe }); setError(null); }}
                plannedRpe={item.plannedRpe}
                disabled={pending}
              />
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">{t("quicklog.minutes.label")}</p>
                <MinutesStepper
                  value={draft.minutes}
                  onChange={(minutes) => { setDraft({ ...draft, minutes }); setError(null); }}
                  disabled={pending}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">{t("quicklog.absent.hint")}</p>
          )}

          {noteOpen ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={noteId} className="text-sm font-medium">{t("quicklog.note.label")}</label>
              <textarea
                id={noteId}
                rows={3}
                maxLength={NOTE_MAX}
                value={draft.note}
                disabled={pending}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                placeholder={t("quicklog.note.placeholder")}
                aria-describedby={`${noteId}-help`}
                className="input w-full resize-none"
              />
              <p id={`${noteId}-help`} className="flex justify-between gap-3 text-xs text-muted">
                <span>{t("quicklog.note.help")}</span>
                <span className="num shrink-0 !text-xs !font-semibold" aria-hidden>{t("quicklog.note.count", { n: draft.note.length, max: NOTE_MAX })}</span>
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setNoteOpen(true)}
              className="link inline-flex min-h-11 w-fit items-center gap-2 text-sm"
            >
              <MessageSquare size={16} aria-hidden />{t("quicklog.note.add")}
            </button>
          )}

          {error && <p role="alert" className="text-sm text-danger">{t(error)}</p>}

          <button type="submit" disabled={pending} className="btn btn-primary inline-flex min-h-14 w-full items-center justify-center gap-2 text-lg">
            <Check size={20} aria-hidden />{pending ? t("quicklog.saving") : t("quicklog.save")}
          </button>
        </form>
      )}
    </div>
  );
}

export function QuickLog({ teamId, items }: { teamId: string; items: QuickLogItem[] }) {
  const { t, locale } = useT();
  // Sessions that were open when the card was shown stay until saved, even when the server list
  // already dropped them after the save; sessions that appear later are appended.
  const [snapshot] = useState(items);
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);

  const remaining = useMemo(() => {
    const known = new Set(snapshot.map((i) => i.id));
    return [...snapshot, ...items.filter((i) => !known.has(i.id))].filter((i) => !done.has(i.id));
  }, [snapshot, items, done]);

  const active = remaining.find((i) => i.id === openId) ?? remaining[0];
  const others = remaining.filter((i) => i !== active);

  return (
    <section className="flex flex-col gap-2" aria-label={t("quicklog.title")}>
      <style>{`
        @keyframes ql-pop { from { transform: scale(0.6); opacity: 0; } to { transform: none; opacity: 1; } }
        .ql-pop { animation: ql-pop 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.2) both; }
        @media (prefers-reduced-motion: reduce) { .ql-pop { animation: none; } }
      `}</style>
      <p className="eyebrow px-1">{t("quicklog.title")}</p>

      {active ? (
        <>
          <LogCard
            key={active.id}
            teamId={teamId}
            item={active}
            draft={drafts[active.id] ?? initialDraft(active)}
            setDraft={(d) => setDrafts((all) => ({ ...all, [active.id]: d }))}
            onDone={() => {
              setDone((s) => new Set(s).add(active.id));
              setOpenId(null);
              setAdvanced(true);
            }}
            focusOnMount={advanced}
          />
          {others.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="px-1 text-sm text-muted">
                {others.length === 1 ? t("quicklog.moreOne") : t("quicklog.more", { n: others.length })}
              </p>
              <ul className="card flex flex-col !p-1">
                {others.map((i) => {
                  const name = `${t(SESSION_TYPE_KEY[i.type])}${i.title ? ` ${i.title}` : ""}`;
                  return (
                    <li key={i.id} className="border-b border-[var(--line)] last:border-b-0">
                      <button
                        type="button"
                        onClick={() => { setOpenId(i.id); setAdvanced(true); }}
                        aria-label={t("quicklog.openRow", { name })}
                        className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl px-2 text-left text-sm transition-colors hover:bg-[var(--surface-2)]"
                      >
                        <SessionTypeIcon type={i.type} size={18} className="shrink-0 text-[var(--accent)]" />
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-medium">{name}</span>{" "}
                          <span className="text-muted">{when(i.startsAt, locale)}</span>
                        </span>
                        <ChevronRight size={16} aria-hidden className="shrink-0 text-muted" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="flex items-center gap-2 px-1 text-sm text-muted" role="status">
          <Check size={16} aria-hidden className="text-[var(--accent)]" />{t("quicklog.done")}
        </p>
      )}
    </section>
  );
}
