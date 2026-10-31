"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  CalendarClock, ChevronDown, ChevronRight, CircleCheck, CircleHelp, Flame, HeartPulse, Layers, Lock, Moon, Plus, Repeat, TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { SessionTypeIcon } from "@/components/icons";
import { ConfirmButton } from "@/components/ConfirmButton";
import { WeekRulesForm, type RulesValues } from "@/components/WeekRulesForm";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";
import type { SessionType } from "@/lib/load";
import type { ReadinessLevel, ReadinessReason, RuleKey, WeekAdvice, WeekStatus } from "@/lib/workload";
import type { WarningKind, WorkloadSettings } from "@/lib/workload-day";
import { addWorkloadNote, deleteWorkloadNote, toggleExclusion, type WorkloadResult } from "@/app/team/[id]/workload/actions";

export type BoardSession = { id: string; type: SessionType; title: string; day: string; time: string; ymd: string };
export type NoteReason = "load" | "pain" | "illness" | "schedule" | "tactics" | "other";
export type BoardNote = { id: string; reason: NoteReason; note: string; day: string; author: string; mine: boolean; session: string | null };
export type BoardDay = {
  ymd: string; weekday: string; num: number; label: string;
  planned: number; actual: number; sessions: number; heavy: number; flags: WarningKind[];
};
/** Pre-formatted pieces of a warning; the text itself is translated here. */
export type BoardWarning = { kind: WarningKind; day: string | null; time: string | null; n: number; up: boolean; weeks: number };
export type BoardTop = { sessionId: string; type: SessionType; title: string; day: string; value: number; kind: "actual" | "planned" };
export type BoardAthlete = {
  id: string;
  name: string;
  status: WeekStatus;
  total: number;
  checks: { key: RuleKey; limit: number; actual: number; state: "ok" | "at" | "over" }[];
  level: ReadinessLevel;
  reasons: ReadinessReason[];
  average: number | null;
  baseline: number | null;
  painLocation: string | null;
  pain: boolean;
  locked: boolean;
  advice: WeekAdvice;
  excluded: string[];
  override: RulesValues | null;
  days: BoardDay[];
  totals: { planned: number; actual: number; diffPct: number | null };
  /** Mean of the athlete's own previous weeks, null when there is not enough history. */
  ownAverage: number | null;
  ownAverageWeeks: number;
  top: BoardTop[];
  warnings: BoardWarning[];
  notes: BoardNote[];
};

const STATUS: Record<WeekStatus, { key: MessageKey; cls: string }> = {
  ok: { key: "workload.status.ok", cls: "badge badge-ok" },
  watch: { key: "workload.status.watch", cls: "badge badge-watch" },
  over: { key: "workload.status.over", cls: "badge badge-high" },
  unknown: { key: "workload.status.unknown", cls: "badge badge-none" },
};
const LEVEL_KEY: Record<ReadinessLevel, MessageKey> = {
  good: "workload.ready.good",
  reduced: "workload.ready.reduced",
  low: "workload.ready.low",
  unknown: "workload.ready.unknown",
};
const LEVEL_COLOR: Record<ReadinessLevel, string> = {
  good: "text-[var(--ok)]",
  reduced: "text-[var(--warn)]",
  low: "text-[var(--danger)]",
  unknown: "text-muted",
};
const METER_KEY: Record<RuleKey, MessageKey> = {
  maxTrainings: "workload.meter.maxTrainings",
  maxGym: "workload.meter.maxGym",
  maxMatches: "workload.meter.maxMatches",
  minRestDays: "workload.meter.minRestDays",
};
const STATE_CLS = {
  ok: "",
  at: "!border-[var(--warn)] !text-[var(--warn)]",
  over: "!border-[var(--danger)] !bg-[var(--danger-bg)] !text-[var(--danger)]",
} as const;
const STATE_KEY = { ok: "workload.meter.ok", at: "workload.meter.at", over: "workload.meter.over" } as const;
const REASON_KEY: Record<ReadinessReason, MessageKey> = {
  pain: "workload.reason.pain",
  sleepLow: "workload.reason.sleepLow",
  energyLow: "workload.reason.energyLow",
  sorenessHigh: "workload.reason.sorenessHigh",
  stressHigh: "workload.reason.stressHigh",
  moodLow: "workload.reason.moodLow",
  belowBaseline: "workload.reason.belowBaseline",
  declining: "workload.reason.declining",
  noRecentData: "workload.reason.noRecentData",
};

const REASON_NOTE_KEY: Record<NoteReason, MessageKey> = {
  load: "workload.note.reason.load",
  pain: "workload.note.reason.pain",
  illness: "workload.note.reason.illness",
  schedule: "workload.note.reason.schedule",
  tactics: "workload.note.reason.tactics",
  other: "workload.note.reason.other",
};
const NOTE_REASONS = Object.keys(REASON_NOTE_KEY) as NoteReason[];
const FLAG_ICON = { stackedHeavyDay: Flame, consecutiveHeavyDays: Repeat, overlap: Layers } as const;
const nf = (n: number) => new Intl.NumberFormat().format(Math.round(n));

function warningText(w: BoardWarning, t: (k: MessageKey, v?: Record<string, string | number>) => string): { text: string; why: MessageKey } {
  switch (w.kind) {
    case "stackedHeavyDay":
      return { text: t("workload.warn.stackedHeavyDay", { n: w.n, day: w.day ?? "" }), why: "workload.warn.why.stackedHeavyDay" };
    case "consecutiveHeavyDays":
      return { text: t("workload.warn.consecutiveHeavyDays", { n: w.n, day: w.day ?? "" }), why: "workload.warn.why.consecutiveHeavyDays" };
    case "overlap":
      return { text: t("workload.warn.overlap", { day: w.day ?? "", time: w.time ?? "" }), why: "workload.warn.why.overlap" };
    case "deviation":
      return {
        text: t(w.up ? "workload.warn.deviationUp" : "workload.warn.deviationDown", { n: w.n, weeks: w.weeks }),
        why: "workload.warn.why.deviation",
      };
    case "missingCheckin":
      return { text: t("workload.warn.missingCheckin"), why: "workload.warn.why.missingCheckin" };
    case "pain":
      return { text: t("workload.warn.pain"), why: "workload.warn.why.pain" };
  }
}

function DayStrip({ a }: { a: BoardAthlete }) {
  const { t } = useT();
  const max = Math.max(...a.days.map((d) => Math.max(d.planned, d.actual)), 1);
  const H = 56;
  return (
    <ol className="grid grid-cols-7 gap-1" aria-label={t("workload.strip.aria", { name: a.name })}>
      {a.days.map((d) => {
        const hp = d.planned ? Math.max((d.planned / max) * H, 4) : 0;
        const ha = d.actual ? Math.max((d.actual / max) * H, 4) : 0;
        const text = t("workload.strip.day", { day: d.label, planned: nf(d.planned), actual: nf(d.actual), n: d.sessions });
        return (
          <li key={d.ymd} role="img" aria-label={text} title={text} className="flex min-w-0 flex-col items-center gap-1">
            <span className="text-[10px] uppercase leading-none text-muted">{d.weekday}</span>
            <span className="num text-xs leading-none">{d.num}</span>
            <span className="flex items-end justify-center gap-[3px]" style={{ height: H }} aria-hidden>
              <span
                className="w-2 rounded-full border"
                style={{ height: hp || 1, borderColor: "var(--accent)", background: hp ? "transparent" : "var(--line)", borderWidth: hp ? 1.5 : 0 }}
              />
              <span
                className="w-2 rounded-full"
                style={{ height: ha || 1, background: ha ? "var(--primary)" : "var(--line)" }}
              />
            </span>
            <span className="text-[11px] leading-none text-muted" aria-hidden>{d.sessions ? `${d.sessions}×` : "–"}</span>
            <span className="flex h-3.5 items-center gap-0.5" aria-hidden>
              {d.flags.filter((f) => f in FLAG_ICON).map((f) => {
                const Icon = FLAG_ICON[f as keyof typeof FLAG_ICON];
                return <Icon key={f} size={12} className="text-[var(--warn)]" />;
              })}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function WeekTotals({ a }: { a: BoardAthlete }) {
  const { t } = useT();
  const { planned, actual, diffPct } = a.totals;
  const diff = diffPct === null ? null : `${diffPct > 0 ? "+" : ""}${Math.round(diffPct)}%`;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)]/60 px-1 py-2">
          <p className="num text-lg">{nf(planned)}</p>
          <p className="text-[11px] leading-tight text-muted">{t("workload.totals.planned")}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)]/60 px-1 py-2">
          <p className="num text-lg">{nf(actual)}</p>
          <p className="text-[11px] leading-tight text-muted">{t("workload.totals.actual")}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)]/60 px-1 py-2">
          <p className="num text-lg">{diff ?? "–"}</p>
          <p className="text-[11px] leading-tight text-muted">{t("workload.totals.diff")}</p>
        </div>
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block h-3 w-2 rounded-full border-[1.5px]" style={{ borderColor: "var(--accent)" }} />{t("workload.totals.planned")}</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block h-3 w-2 rounded-full" style={{ background: "var(--primary)" }} />{t("workload.totals.actual")}</span>
        {a.ownAverage !== null && (
          <span className="chip"><TrendingUp size={12} aria-hidden />{t("workload.totals.ownAverage", { n: nf(a.ownAverage), weeks: a.ownAverageWeeks })}</span>
        )}
      </p>
    </div>
  );
}

function TopSessions({ a }: { a: BoardAthlete }) {
  const { t } = useT();
  if (!a.top.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="eyebrow !font-sans">{t(a.top[0].kind === "actual" ? "workload.top.actual" : "workload.top.planned")}</h3>
      <ul className="flex flex-col gap-1">
        {a.top.map((s) => (
          <li key={s.sessionId} className="flex items-center gap-2 text-sm">
            <SessionTypeIcon type={s.type} size={16} className="shrink-0 text-[var(--accent)]" />
            <span className="min-w-0 flex-1 truncate">{s.title} <span className="text-muted">· {s.day}</span></span>
            <span className="num shrink-0 text-base">{nf(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Warnings({ a, settings }: { a: BoardAthlete; settings: WorkloadSettings }) {
  const { t } = useT();
  const shown = (k: WarningKind) => a.warnings.filter((w) => w.kind === k);
  const load = a.warnings.filter((w) => w.kind !== "pain" && w.kind !== "missingCheckin");
  const health = [...shown("pain"), ...shown("missingCheckin")];
  const whyVars = { n: settings.heavyPerDay, rpe: settings.heavyRpe, days: settings.consecutiveHeavyDays, pct: settings.deviationPct };
  const line = (w: BoardWarning, i: number) => {
    const { text, why } = warningText(w, t);
    const isPain = w.kind === "pain";
    return (
      <li key={`${w.kind}-${i}`} className="flex items-start gap-2 text-sm">
        {isPain
          ? <TriangleAlert size={14} aria-hidden className="mt-0.5 shrink-0 text-[var(--danger)]" />
          : w.kind === "overlap" ? <CalendarClock size={14} aria-hidden className="mt-0.5 shrink-0 text-[var(--warn)]" />
          : w.kind === "deviation" ? <TrendingUp size={14} aria-hidden className="mt-0.5 shrink-0 text-muted" />
          : w.kind === "missingCheckin" ? <HeartPulse size={14} aria-hidden className="mt-0.5 shrink-0 text-muted" />
          : <Flame size={14} aria-hidden className="mt-0.5 shrink-0 text-[var(--warn)]" />}
        <span className="min-w-0">
          <span className={isPain ? "font-semibold text-danger" : "font-medium"}>{text}</span>
          <span className="block text-xs text-muted">{t(why, whyVars)}</span>
        </span>
      </li>
    );
  };
  return (
    <div className="flex flex-col gap-2">
      <h3 className="eyebrow !font-sans">{t("workload.warn.title")}</h3>
      {load.length + health.length === 0 ? (
        <p className="text-sm text-muted">{t("workload.warn.none")}</p>
      ) : (
        <>
          {load.length > 0 && <ul className="flex flex-col gap-2">{load.map(line)}</ul>}
          {health.length > 0 && (
            <ul className="flex flex-col gap-2 border-t border-[var(--line)] pt-2">{health.map(line)}</ul>
          )}
        </>
      )}
      <p className="text-xs text-muted">{t("workload.warn.disclaimer")}</p>
    </div>
  );
}

function NoteForm({ teamId, a, sessions, today }: { teamId: string; a: BoardAthlete; sessions: BoardSession[]; today: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<WorkloadResult | null>(null);
  const [pending, start] = useTransition();
  if (!open) {
    return (
      <button type="button" onClick={() => { setState(null); setOpen(true); }} className="btn inline-flex min-h-11 items-center gap-2 self-start">
        <Plus size={16} aria-hidden />{t("workload.note.add")}
      </button>
    );
  }
  return (
    <form
      className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] p-3"
      action={(fd) => {
        start(async () => {
          const r = await addWorkloadNote(teamId, a.id, fd);
          setState(r);
          if (r.ok) setOpen(false);
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">{t("workload.note.reason")}</span>
          <select name="reason" defaultValue="load" className="input min-h-11 w-full">
            {NOTE_REASONS.map((r) => <option key={r} value={r}>{t(REASON_NOTE_KEY[r])}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">{t("workload.note.day")}</span>
          <select name="day" defaultValue="" className="input min-h-11 w-full">
            <option value="">{t("workload.note.dayToday")}</option>
            {a.days.map((d) => <option key={d.ymd} value={d.ymd}>{d.label}{d.ymd === today ? ` (${t("workload.note.todayTag")})` : ""}</option>)}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="eyebrow">{t("workload.note.session")}</span>
        <select name="session_id" defaultValue="" className="input min-h-11 w-full">
          <option value="">{t("workload.note.sessionNone")}</option>
          {sessions.map((s) => <option key={s.id} value={s.id}>{s.title} · {s.day} {s.time}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="eyebrow">{t("workload.note.text")}</span>
        <textarea name="note" required maxLength={500} rows={3} placeholder={t("workload.note.placeholder")} className="input w-full" />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={pending} className="btn btn-primary inline-flex min-h-11 items-center gap-2">{t("workload.note.save")}</button>
        <button type="button" onClick={() => setOpen(false)} className="btn min-h-11">{t("common.cancel")}</button>
      </div>
      {state && !state.ok && state.error && <p role="alert" className="text-xs text-danger">{t(state.error)}</p>}
    </form>
  );
}

function Notes({ teamId, a, sessions, today, isHead }: { teamId: string; a: BoardAthlete; sessions: BoardSession[]; today: string; isHead: boolean }) {
  const { t } = useT();
  return (
    <div className="flex flex-col gap-2">
      <h3 className="eyebrow !font-sans">{t("workload.note.title")}</h3>
      {a.notes.length ? (
        <ul className="flex flex-col gap-2">
          {a.notes.map((n) => (
            <li key={n.id} className="flex items-start gap-2 rounded-2xl border border-[var(--line)] px-3 py-2" style={{ background: "var(--surface-2)" }}>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  <span className="chip">{t(REASON_NOTE_KEY[n.reason])}</span>
                  <span>{n.day}</span>
                  {n.session && <span className="truncate">· {n.session}</span>}
                  {n.author && <span>· {n.author}</span>}
                </p>
                <p className="mt-1 break-words text-sm">{n.note}</p>
              </div>
              {(n.mine || isHead) && (
                <ConfirmButton
                  action={() => deleteWorkloadNote(teamId, n.id)}
                  icon="trash"
                  iconOnly
                  label={t("workload.note.delete")}
                  title={t("workload.note.deleteTitle")}
                  body={t("workload.note.deleteBody")}
                  className="!size-11"
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{t("workload.note.empty")}</p>
      )}
      <NoteForm teamId={teamId} a={a} sessions={sessions} today={today} />
    </div>
  );
}

function ReadinessChip({ a }: { a: BoardAthlete }) {
  const { t } = useT();
  if (a.locked) {
    return (
      <span className="chip" title={t("workload.ready.lockedHint")}>
        <Lock size={12} aria-hidden />{t("workload.ready.locked")}
        <span className="sr-only">. {t("workload.ready.lockedHint")}</span>
      </span>
    );
  }
  return (
    <>
      <span className={`chip ${LEVEL_COLOR[a.level]}`}>
        <HeartPulse size={12} aria-hidden />{t(LEVEL_KEY[a.level])}
      </span>
      {a.pain && (
        <span className="chip !border-[var(--danger)] !bg-[var(--danger-bg)] !text-[var(--danger)]">
          <TriangleAlert size={12} aria-hidden />
          {a.painLocation ? t("workload.ready.pain", { where: a.painLocation }) : t("workload.ready.painNoWhere")}
        </span>
      )}
    </>
  );
}

function SessionToggle({ teamId, athlete, session, excluded, editable }: {
  teamId: string; athlete: BoardAthlete; session: BoardSession; excluded: boolean; editable: boolean;
}) {
  const { t } = useT();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const label = t(excluded ? "workload.sessions.include" : "workload.sessions.exclude", {
    title: session.title, name: athlete.name,
  });
  return (
    <li className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${excluded ? "opacity-70" : ""}`} style={{ background: "var(--surface-2)" }}>
      <SessionTypeIcon type={session.type} size={18} className={excluded ? "text-muted" : "text-[var(--accent)]"} />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${excluded ? "text-muted line-through" : ""}`}>{session.title}</p>
        <p className="text-xs text-muted">
          {session.day} · {session.time}
          {excluded && <span className="ml-2 inline-flex items-center gap-1"><Moon size={11} aria-hidden />{t("workload.sessions.rest")}</span>}
        </p>
        {failed && <p role="alert" className="text-xs text-danger">{t("workload.error.generic")}</p>}
      </div>
      {editable && <button
        type="button"
        role="switch"
        aria-checked={!excluded}
        aria-label={label}
        title={label}
        disabled={pending}
        onClick={() => {
          setFailed(false);
          start(async () => {
            const r = await toggleExclusion(teamId, session.id, athlete.id, !excluded);
            if (!r.ok) setFailed(true);
          });
        }}
        className="-my-1 inline-grid size-11 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-50"
      >
        <span
          aria-hidden
          className="relative block h-6 w-10 rounded-full border transition-colors"
          style={{ background: excluded ? "var(--surface-3)" : "var(--primary)", borderColor: "var(--line)" }}
        >
          <span
            className="absolute top-0.5 size-5 rounded-full transition-all"
            style={{ left: excluded ? "0.125rem" : "1.1rem", background: excluded ? "var(--muted)" : "var(--on-primary)" }}
          />
        </span>
      </button>}
    </li>
  );
}

function AthleteCard({ a, teamId, sessions, defaults, settings, canRules, canNotes, isHead, today }: {
  a: BoardAthlete; teamId: string; sessions: BoardSession[]; defaults: RulesValues; settings: WorkloadSettings;
  canRules: boolean; canNotes: boolean; isHead: boolean; today: string;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const st = STATUS[a.status];
  const excluded = new Set(a.excluded);
  const adviceKey: MessageKey | null =
    a.advice === "reduceOne" ? "workload.advice.reduceOne"
    : a.advice === "considerRest" ? (a.pain ? "workload.advice.considerRestPain" : "workload.advice.considerRest")
    : null;
  const panelId = `week-${a.id}`;
  const empty: RulesValues = { maxTrainings: null, maxGym: null, maxMatches: null, minRestDays: null };

  return (
    <li className="card flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Avatar name={a.name} size={44} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/team/${teamId}/athlete/${a.id}`}
            aria-label={t("workload.sessions.open", { name: a.name })}
            className="-my-1 flex min-h-11 items-center justify-between gap-1 font-semibold"
          >
            <span className="truncate">{a.name}</span>
            <ChevronRight size={16} aria-hidden className="shrink-0 text-[var(--accent)]" />
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <ReadinessChip a={a} />
          </div>
        </div>
        <span className={st.cls}>{t(st.key)}</span>
      </div>

      <ul className="flex flex-wrap gap-1.5" aria-label={t("workload.week.list", { name: a.name })}>
        <li className="chip">{t("workload.meter.total", { n: a.total })}</li>
        {a.checks.map((c) => (
          <li key={c.key} className={`chip ${STATE_CLS[c.state]}`}>
            {t(METER_KEY[c.key], { n: c.actual, max: c.limit })}
            <span className="sr-only">, {t(STATE_KEY[c.state])}</span>
          </li>
        ))}
        {a.override && <li className="chip"><CircleCheck size={12} aria-hidden />{t("workload.rules.custom")}</li>}
      </ul>

      <DayStrip a={a} />
      <WeekTotals a={a} />
      <Warnings a={a} settings={settings} />

      {adviceKey && <p className="text-sm">{t(adviceKey)}</p>}

      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t(open ? "workload.sessions.collapse" : "workload.sessions.expand", { name: a.name })}
        onClick={() => setOpen((o) => !o)}
        className="btn inline-flex min-h-11 items-center justify-center gap-2 self-start"
      >
        <ChevronDown size={16} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`} />
        {t("workload.sessions.weekBtn")}
      </button>

      {open && (
        <div id={panelId} className="flex flex-col gap-4 border-t pt-4">
          <TopSessions a={a} />
          <div className="flex flex-col gap-2">
            <h3 className="eyebrow !font-sans">{t("workload.sessions.title")}</h3>
            {sessions.length ? (
              <ul className="flex flex-col gap-2">
                {sessions.map((s) => (
                  <SessionToggle key={s.id} teamId={teamId} athlete={a} session={s} excluded={excluded.has(s.id)} editable={canRules} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t("workload.sessions.empty")}</p>
            )}
            {excluded.size > 0 && <p className="text-xs text-muted">{t("workload.sessions.excludedHint")}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="eyebrow !font-sans">{t("workload.readiness.title")}</h3>
            {a.locked ? (
              <p className="flex items-start gap-2 text-sm text-muted">
                <Lock size={14} aria-hidden className="mt-0.5 shrink-0" />{t("workload.ready.lockedHint")}
              </p>
            ) : (
              <>
                <ul className="flex flex-col gap-1 text-sm">
                  {a.reasons.length === 0 && <li className="text-muted">{t(LEVEL_KEY[a.level])}</li>}
                  {a.reasons.map((r) => <li key={r}>{t(REASON_KEY[r])}</li>)}
                </ul>
                {(a.average !== null || a.baseline !== null) && (
                  <p className="flex flex-wrap gap-x-4 text-xs text-muted">
                    {a.average !== null && <span>{t("workload.readiness.average", { avg: a.average })}</span>}
                    {a.baseline !== null && <span>{t("workload.readiness.baseline", { avg: a.baseline })}</span>}
                  </p>
                )}
              </>
            )}
          </div>

          {canRules && (
            <div className="flex flex-col gap-2">
              <h3 className="eyebrow !font-sans">{t("workload.rules.override")}</h3>
              <WeekRulesForm
                key={JSON.stringify(a.override)}
                teamId={teamId}
                userId={a.id}
                initial={a.override ?? empty}
                fallback={defaults}
                hasOverride={!!a.override}
              />
            </div>
          )}

          {canNotes && <Notes teamId={teamId} a={a} sessions={sessions} today={today} isHead={isHead} />}
        </div>
      )}
    </li>
  );
}

export function WorkloadBoard({ teamId, athletes, sessions, defaults, settings, canRules, canNotes, isHead, today }: {
  teamId: string; athletes: BoardAthlete[]; sessions: BoardSession[]; defaults: RulesValues; settings: WorkloadSettings;
  canRules: boolean; canNotes: boolean; isHead: boolean; today: string;
}) {
  const { t } = useT();
  if (!athletes.length) return <p className="text-muted">{t("workload.empty.athletes")}</p>;
  return (
    <div className="flex flex-col gap-3">
      <ul className="stagger flex flex-col gap-3">
        {athletes.map((a) => (
          <AthleteCard
            key={a.id} a={a} teamId={teamId} sessions={sessions} defaults={defaults} settings={settings}
            canRules={canRules} canNotes={canNotes} isHead={isHead} today={today}
          />
        ))}
      </ul>
      <p className="flex items-start gap-2 text-xs text-muted">
        <span>{t("workload.rules.explain")}</span>
        <Link href="/help" aria-label={t("workload.rules.help")} className="link -m-3 grid size-11 shrink-0 place-items-center">
          <CircleHelp size={14} aria-hidden />
        </Link>
      </p>
    </div>
  );
}
