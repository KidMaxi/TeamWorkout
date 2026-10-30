"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ChevronDown, ChevronRight, CircleCheck, CircleHelp, HeartPulse, Lock, Moon, TriangleAlert,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { SessionTypeIcon } from "@/components/icons";
import { WeekRulesForm, type RulesValues } from "@/components/WeekRulesForm";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";
import type { SessionType } from "@/lib/load";
import type { ReadinessLevel, ReadinessReason, RuleKey, WeekAdvice, WeekStatus } from "@/lib/workload";
import { toggleExclusion } from "@/app/team/[id]/workload/actions";

export type BoardSession = { id: string; type: SessionType; title: string; day: string; time: string };
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

function SessionToggle({ teamId, athlete, session, excluded }: {
  teamId: string; athlete: BoardAthlete; session: BoardSession; excluded: boolean;
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
      <button
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
      </button>
    </li>
  );
}

function AthleteCard({ a, teamId, sessions, defaults }: {
  a: BoardAthlete; teamId: string; sessions: BoardSession[]; defaults: RulesValues;
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
          <div className="flex flex-col gap-2">
            <h3 className="eyebrow !font-sans">{t("workload.sessions.title")}</h3>
            {sessions.length ? (
              <ul className="flex flex-col gap-2">
                {sessions.map((s) => (
                  <SessionToggle key={s.id} teamId={teamId} athlete={a} session={s} excluded={excluded.has(s.id)} />
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
        </div>
      )}
    </li>
  );
}

export function WorkloadBoard({ teamId, athletes, sessions, defaults }: {
  teamId: string; athletes: BoardAthlete[]; sessions: BoardSession[]; defaults: RulesValues;
}) {
  const { t } = useT();
  if (!athletes.length) return <p className="text-muted">{t("workload.empty.athletes")}</p>;
  return (
    <div className="flex flex-col gap-3">
      <ul className="stagger flex flex-col gap-3">
        {athletes.map((a) => (
          <AthleteCard key={a.id} a={a} teamId={teamId} sessions={sessions} defaults={defaults} />
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
