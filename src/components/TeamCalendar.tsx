"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Flame, MapPin, TriangleAlert, Users } from "lucide-react";
import { SessionTypeIcon } from "@/components/icons";
import { useT } from "@/lib/i18n/client";
import { SESSION_TYPE_KEY, dateLocale, type MessageKey } from "@/lib/i18n";
import type { SessionType } from "@/lib/load";
import { mondayOf, weekDays } from "@/lib/workload";
import { dayStats, monthGrid, shiftDate, type CalendarView, type SessionStatus } from "@/lib/session-plan";

export type CalSession = {
  id: string;
  type: SessionType;
  day: string; // YYYY-MM-DD, Europe/Amsterdam
  time: string; // HH:MM
  startMin: number;
  durationMin: number;
  rpe: number | null;
  status: SessionStatus;
  focus: string[];
  location: string | null;
};
export type CalAthlete = { id: string; name: string };

const TYPE_COLOR: Record<SessionType, string> = {
  academy: "var(--accent)",
  gym: "var(--primary)",
  evening: "var(--warn)",
  match: "var(--danger)",
  other: "var(--muted)",
};
const TYPES = Object.keys(TYPE_COLOR) as SessionType[];
const VIEWS: CalendarView[] = ["day", "week", "month"];

const fmtDay = (ymd: string, loc: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(loc, { timeZone: "UTC", ...opts }).format(new Date(`${ymd}T12:00:00Z`));

export function TeamCalendar({ teamId, view, date, today, sessions, showLoad, athletes, exclusions }: {
  teamId: string;
  view: CalendarView;
  date: string;
  today: string;
  sessions: CalSession[];
  /** Staff only: planned load per day and stack warnings. */
  showLoad: boolean;
  athletes: CalAthlete[];
  /** sessionId -> athlete ids taken out of that session (staff only). */
  exclusions: Record<string, string[]>;
}) {
  const { t, locale } = useT();
  const loc = dateLocale(locale);
  const [athlete, setAthlete] = useState("");
  const base = `/team/${teamId}/sessions/calendar`;
  const href = (v: CalendarView, d: string) => `${base}?view=${v}&date=${d}`;

  const byDay = useMemo(() => {
    const m = new Map<string, CalSession[]>();
    for (const s of sessions) {
      if (athlete && exclusions[s.id]?.includes(athlete)) continue;
      const list = m.get(s.day) ?? [];
      list.push(s);
      m.set(s.day, list);
    }
    for (const list of m.values()) list.sort((a, b) => a.startMin - b.startMin);
    return m;
  }, [sessions, athlete, exclusions]);

  const days = view === "day" ? [date] : view === "week" ? weekDays(date) : monthGrid(date);
  const range =
    view === "day" ? fmtDay(date, loc, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : view === "week" ? `${fmtDay(days[0], loc, { day: "numeric", month: "short" })} - ${fmtDay(days[6], loc, { day: "numeric", month: "short", year: "numeric" })}`
    : fmtDay(date, loc, { month: "long", year: "numeric" });
  const navBtn = "btn inline-grid size-11 place-items-center !p-0";

  function DayHeadline({ day }: { day: string }) {
    const stats = dayStats(byDay.get(day) ?? []);
    if (!showLoad || stats.count === 0) return null;
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted">
        <span title={t("calendar.load")} className="inline-flex items-center gap-1">
          <Flame size={12} aria-hidden className="text-[var(--accent)]" />
          <span className="sr-only">{t("calendar.load")}: </span>
          <span className="num !text-sm">{stats.load}</span>
        </span>
        {stats.stacked && (
          <span title={t("calendar.warn.stack")} className="inline-flex text-[var(--warn)]">
            <TriangleAlert size={14} aria-hidden />
            <span className="sr-only">{t("calendar.warn.stack")}</span>
          </span>
        )}
      </span>
    );
  }

  function Chip({ s }: { s: CalSession }) {
    const cancelled = s.status === "cancelled";
    return (
      <li className={`flex flex-col gap-1 rounded-xl border p-2 text-xs ${cancelled ? "opacity-70" : ""}`} style={{ borderLeft: `3px solid ${TYPE_COLOR[s.type]}`, background: "color-mix(in srgb, var(--surface-2) 70%, transparent)" }}>
        <span className={`flex items-center gap-1.5 font-semibold ${cancelled ? "text-muted line-through" : ""}`}>
          <SessionTypeIcon type={s.type} size={14} className="shrink-0 text-[var(--accent)]" />
          <span className="truncate">{t(SESSION_TYPE_KEY[s.type])}</span>
        </span>
        <span className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-muted ${cancelled ? "line-through" : ""}`}>
          <span className="inline-flex items-center gap-1"><Clock size={11} aria-hidden />{s.time}</span>
          <span>{s.durationMin} {t("common.min")}</span>
          {s.rpe ? <span className="font-semibold text-[var(--foreground)]">{t("calendar.rpe", { n: s.rpe })}</span> : null}
        </span>
        {s.focus.length > 0 && (
          <span className={`text-muted ${cancelled ? "line-through" : ""}`}>{s.focus.map((f) => t(`sessions.focus.${f}` as MessageKey)).join(" · ")}</span>
        )}
        {s.location && <span className="inline-flex items-center gap-1 text-muted"><MapPin size={11} aria-hidden className="shrink-0" /><span className="truncate">{s.location}</span></span>}
        {s.status !== "planned" && (
          <span className={`badge w-fit ${s.status === "completed" ? "badge-ok" : s.status === "adjusted" ? "badge-watch" : "badge-high"}`}>
            {t(`sessions.status.${s.status}` as MessageKey)}
          </span>
        )}
      </li>
    );
  }

  function DayCell({ day, bigHeader }: { day: string; bigHeader?: boolean }) {
    const list = byDay.get(day) ?? [];
    const isToday = day === today;
    return (
      <section
        aria-label={fmtDay(day, loc, { weekday: "long", day: "numeric", month: "long" })}
        className={`flex min-w-0 flex-col gap-2 rounded-2xl border p-2.5 ${isToday ? "border-[var(--accent)]" : ""}`}
        style={{ background: "var(--card-sheen), var(--surface)" }}
      >
        <div className="flex items-center justify-between gap-2">
          <Link href={href("day", day)} className="inline-flex min-h-11 items-center gap-2 rounded-lg">
            <span className="eyebrow">{fmtDay(day, loc, { weekday: "short" }).replace(".", "")}</span>
            <span className={`num ${bigHeader ? "text-3xl" : "text-xl"} ${isToday ? "text-[var(--accent)]" : ""}`}>{fmtDay(day, loc, { day: "numeric" })}</span>
          </Link>
          <DayHeadline day={day} />
        </div>
        {list.length > 0 ? (
          <ul className="flex flex-col gap-1.5">{list.map((s) => <Chip key={s.id} s={s} />)}</ul>
        ) : (
          <p className="text-xs text-muted">{t("calendar.empty")}</p>
        )}
      </section>
    );
  }

  const monthIndex = Number(date.slice(5, 7));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={href(view, shiftDate(view, date, -1))} className={navBtn} aria-label={t("calendar.prev")}><ChevronLeft size={18} aria-hidden /></Link>
          <Link href={href(view, shiftDate(view, date, 1))} className={navBtn} aria-label={t("calendar.next")}><ChevronRight size={18} aria-hidden /></Link>
          <Link href={href(view, today)} className="btn inline-flex min-h-11 items-center">{t("calendar.today")}</Link>
        </div>
        <nav className="glass flex w-fit gap-1 rounded-full p-1" aria-label={t("calendar.views")}>
          {VIEWS.map((v) => (
            <Link
              key={v}
              href={href(v, date)}
              aria-current={v === view ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition-colors ${v === view ? "bg-[var(--primary)] text-[var(--on-primary)]" : "text-muted hover:text-[var(--foreground)]"}`}
            >
              {t(`calendar.view.${v}` as MessageKey)}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 aria-live="polite" className="display text-2xl capitalize">{range}</h2>
        {athletes.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <Users size={14} aria-hidden className="text-[var(--accent)]" />
            <span className="sr-only">{t("calendar.filter.athlete")}</span>
            <select value={athlete} onChange={(e) => setAthlete(e.target.value)} className="input min-h-11">
              <option value="">{t("calendar.filter.all")}</option>
              {athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
        )}
      </div>

      {view === "day" && <DayCell day={date} bigHeader />}

      {view === "week" && (
        <div className="flex flex-col gap-2 md:grid md:grid-cols-7 md:items-start md:gap-1.5">
          {days.map((d) => <DayCell key={d} day={d} />)}
        </div>
      )}

      {view === "month" && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-7 gap-1 text-center" aria-hidden>
            {weekDays(mondayOf(date)).map((d) => <span key={d} className="eyebrow">{fmtDay(d, loc, { weekday: "short" }).replace(".", "").slice(0, 2)}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const list = (byDay.get(d) ?? []).filter((s) => s.status !== "cancelled");
              const stats = dayStats(byDay.get(d) ?? []);
              const inMonth = Number(d.slice(5, 7)) === monthIndex;
              const counts = TYPES.map((ty) => ({ ty, n: list.filter((s) => s.type === ty).length })).filter((c) => c.n > 0);
              const full = fmtDay(d, loc, { weekday: "long", day: "numeric", month: "long" });
              return (
                <Link
                  key={d}
                  href={href("day", d)}
                  aria-label={`${t("calendar.openDay", { date: full })}, ${list.length === 1 ? t("calendar.count.one") : t("calendar.count", { n: list.length })}`}
                  className={`flex min-h-16 flex-col items-center gap-1 rounded-xl border p-1 transition-colors hover:border-[var(--accent)] ${d === today ? "border-[var(--accent)]" : ""} ${inMonth ? "" : "opacity-45"}`}
                  style={{ background: "color-mix(in srgb, var(--surface) 80%, transparent)" }}
                >
                  <span className={`num text-sm ${d === today ? "text-[var(--accent)]" : ""}`}>{fmtDay(d, loc, { day: "numeric" })}</span>
                  <span className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5" aria-hidden>
                    {counts.map((c) => (
                      <span key={c.ty} className="inline-flex items-center gap-px text-[10px] leading-none text-muted">
                        <span className="size-2 rounded-full" style={{ background: TYPE_COLOR[c.ty] }} />
                        {c.n > 1 ? c.n : null}
                      </span>
                    ))}
                  </span>
                  {showLoad && stats.count > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] leading-none text-muted" aria-hidden>
                      <span className="hidden sm:inline">{stats.load}</span>
                      {stats.stacked && <TriangleAlert size={11} className="text-[var(--warn)]" />}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label={t("calendar.legend")}>
            {TYPES.map((ty) => (
              <li key={ty} className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: TYPE_COLOR[ty] }} aria-hidden />{t(SESSION_TYPE_KEY[ty])}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
