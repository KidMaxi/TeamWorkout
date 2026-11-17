import Link from "next/link";
import { ArrowRight, Ban, CalendarCheck, ChevronDown } from "lucide-react";
import { WellnessCard } from "@/components/WellnessCard";
import { Dial } from "@/components/Dial";
import { Hero } from "@/components/Hero";
import { QuickLog } from "@/components/QuickLog";
import { AvailabilityIcon, SessionTypeIcon } from "@/components/icons";
import { getT } from "@/lib/i18n/server";
import { AVAILABILITY_KEY, SESSION_TYPE_KEY, dateLocale, type Locale, type TFunction } from "@/lib/i18n";
import type { Availability, SessionType } from "@/lib/load";
import { TEAM_TIME_ZONE, todayInTeamZone, type WellnessEntry } from "@/lib/wellness";

export type AthleteDashboardProps = {
  teamId: string;
  /** Shown in the greeting banner; the greeting drops the name when missing. */
  firstName?: string;
  /** Shown in the banner subtitle after today's training count. */
  teamName?: string;
  availability: { status: Availability; note: string | null } | null;
  pending: { id: string; type: SessionType; title: string; starts_at: string; plannedDurationMin: number; plannedRpe: number | null }[];
  /** Oldest first; the last entry is the current week. week_start is YYYY-MM-DD (Monday). */
  weekly: { week_start: string; total_load: number }[];
  /** Newest first. */
  recentLogs: {
    starts_at: string;
    type: SessionType;
    title: string;
    attended: boolean;
    duration_min: number;
    rpe: number;
    load: number;
  }[];
  last7Load: number;
  attendedThisWeek: number;
  /** Own check-ins: today (or null) and the last 7 days, newest first. */
  wellness?: { today: WellnessEntry | null; recent: WellnessEntry[] };
  /** Team sessions of the current Monday-Sunday week (oldest first) with the athlete's own rest flags, plus simple counts. */
  week?: {
    sessions: { id: string; type: SessionType; title: string; starts_at: string; excluded: boolean }[];
    counts: { training: number; gym: number; match: number; restDays: number };
  };
};

const QUICK_MAX = 3;
const RECENT_SHOWN = 3;

/** Amsterdam hour: morning 5-11, afternoon 12-17, otherwise evening. */
function dayPart(now: Date): "morning" | "afternoon" | "evening" {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TEAM_TIME_ZONE }).format(now));
  return h >= 5 && h < 12 ? "morning" : h >= 12 && h < 18 ? "afternoon" : "evening";
}

const dateFmt = (iso: string, locale: Locale) =>
  new Date(iso).toLocaleDateString(dateLocale(locale), { weekday: "short", day: "numeric", month: "short" });

function LoadCard({
  last7Load, attendedThisWeek, weekly, t,
}: { last7Load: number; attendedThisWeek: number; weekly: AthleteDashboardProps["weekly"]; t: TFunction }) {
  const max = Math.max(...weekly.map((w) => w.total_load), last7Load, 1);
  const prev = weekly.slice(0, -1);
  const avg = prev.length ? prev.reduce((s, w) => s + w.total_load, 0) / prev.length : 0;
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="eyebrow self-start">{t("athlete.hero.eyebrow")}</p>
      <Dial
        value={last7Load / max}
        marker={avg > 0 ? avg / max : undefined}
        size={180}
        tone="primary"
        label={t("athlete.hero.aria", { load: last7Load, avg: Math.round(avg) })}
      >
        <p className="num" style={{ fontSize: String(last7Load).length > 4 ? "1.75rem" : "2.25rem" }}>{last7Load}</p>
      </Dial>
      <div className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-4 py-2 text-sm">
        <CalendarCheck size={16} aria-hidden className="text-[var(--accent)]" />
        <span className="num text-lg">{attendedThisWeek}</span>
        <span className="text-muted">{t("athlete.tiles.attended")} {t("athlete.tiles.attendedSub")}</span>
      </div>
    </div>
  );
}

/** One line. Only when there is a note does it open (tap) to show the full text. */
function AvailabilityStrip({ availability, t }: { availability: AthleteDashboardProps["availability"]; t: TFunction }) {
  const status = availability?.status ?? "available";
  const note = availability?.note;
  const flagged = status !== "available";
  const color = status === "limited" ? "var(--warn)" : status === "unavailable" ? "var(--danger)" : "var(--accent)";
  const head = (
    <>
      <span className="shrink-0" style={{ color }}>
        <AvailabilityIcon status={status} size={20} />
      </span>
      <span className="min-w-0 flex-1 truncate">
        <span className="font-semibold">{t(AVAILABILITY_KEY[status])}</span>
        {note && <span className="text-sm text-muted"> · {note}</span>}
        {!note && flagged && <span className="text-sm text-muted"> · {t("athlete.status.note")}</span>}
      </span>
    </>
  );
  return (
    <div
      className="card !p-0"
      role={flagged ? "status" : undefined}
      style={flagged ? { background: status === "limited" ? "var(--warn-bg)" : "var(--danger-bg)", borderColor: color } : undefined}
    >
      {note ? (
        <details className="group">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-md px-4 [&::-webkit-details-marker]:hidden">
            {head}
            <ChevronDown size={18} aria-hidden className="shrink-0 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <p className="px-4 pb-3 text-sm [overflow-wrap:anywhere]">{note}</p>
        </details>
      ) : (
        <div className="flex min-h-12 items-center gap-3 px-4">{head}</div>
      )}
    </div>
  );
}

function WeeklyBars({ weekly, t, locale }: { weekly: AthleteDashboardProps["weekly"]; t: TFunction; locale: Locale }) {
  const max = Math.max(...weekly.map((w) => w.total_load), 1);
  const scale = 84;
  const labelOf = (iso: string) =>
    new Date(iso + "T00:00:00Z").toLocaleDateString(dateLocale(locale), { day: "numeric", month: "numeric", timeZone: "UTC" });
  return (
    <div>
      <h3 className="mb-4 text-base font-semibold">{t("athlete.weekly.title")}</h3>
      <ol className="flex h-24 items-end gap-1.5" aria-label={t("athlete.weekly.aria")}>
        {weekly.map((w, i) => {
          const current = i === weekly.length - 1;
          const text = t(current ? "athlete.weekly.weekCurrent" : "athlete.weekly.week", { date: labelOf(w.week_start), load: w.total_load });
          return (
            <li key={w.week_start} className="flex h-full flex-1 items-end justify-center">
              <div
                className="relative w-full max-w-5 rounded-t-sm"
                style={{
                  height: `${Math.max((w.total_load / max) * scale, w.total_load ? 4 : 1)}%`,
                  background: current ? "var(--primary)" : "var(--line)",
                }}
                role="img"
                aria-label={text}
                title={text}
              >
                {current && w.total_load > 0 && (
                  <span className="num absolute -top-4 left-1/2 -translate-x-1/2 text-[11px]">{w.total_load}</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <ol className="mt-2 flex gap-1.5" aria-hidden>
        {weekly.map((w, i) => (
          <li key={w.week_start} className={`flex-1 text-center text-[11px] ${i === weekly.length - 1 ? "font-semibold" : "text-muted"}`}>
            {labelOf(w.week_start)}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ThisWeek({ week, t, locale }: { week: NonNullable<AthleteDashboardProps["week"]>; t: TFunction; locale: Locale }) {
  const when = (iso: string) =>
    new Date(iso).toLocaleString(dateLocale(locale), { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: TEAM_TIME_ZONE });
  const c = week.counts;
  const parts = [
    c.training > 0 ? (c.training === 1 ? t("athlete.week.trainingOne") : t("athlete.week.training", { n: c.training })) : null,
    c.gym > 0 ? t("athlete.week.gym", { n: c.gym }) : null,
    c.match > 0 ? (c.match === 1 ? t("athlete.week.matchOne") : t("athlete.week.match", { n: c.match })) : null,
    c.restDays === 1 ? t("athlete.week.restDayOne") : t("athlete.week.restDays", { n: c.restDays }),
  ].filter((x): x is string => !!x);
  return (
    <section className="card flex flex-col gap-3" aria-label={t("athlete.week.title")}>
      <h3 className="text-xl">{t("athlete.week.title")}</h3>
      {week.sessions.length ? (
        <>
          <ul className="flex flex-col" aria-label={t("athlete.week.aria")}>
            {week.sessions.map((s) => (
              <li
                key={s.id}
                className={`flex min-h-11 items-center gap-2.5 border-b border-[var(--line)] py-2 text-sm last:border-b-0 ${s.excluded ? "text-muted" : ""}`}
              >
                <SessionTypeIcon type={s.type} />
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-muted">{when(s.starts_at)}</span>{" "}
                  <span className={s.excluded ? "line-through decoration-[var(--line)]" : ""}>
                    {s.title || t(SESSION_TYPE_KEY[s.type])}
                  </span>
                </span>
                {s.excluded && (
                  <span className="chip shrink-0" title={t("athlete.week.restHint")}>
                    {t("athlete.week.rest")}
                    <span className="sr-only">. {t("athlete.week.restHint")}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">{parts.join(" · ")}</p>
        </>
      ) : (
        <p className="text-sm text-muted">{t("athlete.week.empty")}</p>
      )}
    </section>
  );
}

function RecentItem({ l, t, locale }: { l: AthleteDashboardProps["recentLogs"][number]; t: TFunction; locale: Locale }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[var(--line)] py-2.5 last:border-b-0">
      <span className={`flex min-w-0 items-center gap-2.5 ${l.attended ? "" : "text-muted"}`}>
        <SessionTypeIcon type={l.type} />
        <span className="truncate">
          <span className="text-muted">{dateFmt(l.starts_at, locale)}</span>{" "}
          {l.title || t(SESSION_TYPE_KEY[l.type])}
        </span>
      </span>
      {l.attended ? (
        <span className="chip tabular-nums">
          {t("athlete.recent.calc", { min: l.duration_min, rpe: l.rpe, load: l.load })}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs text-muted">
          <Ban size={14} aria-hidden /> {t("athlete.recent.absent")}
        </span>
      )}
    </li>
  );
}

export async function AthleteDashboard({
  teamId, firstName, teamName, availability, pending, weekly, recentLogs, last7Load, attendedThisWeek, wellness, week,
}: AthleteDashboardProps) {
  const { t, locale } = await getT();
  const now = new Date();
  const part = dayPart(now);
  const name = firstName?.trim();
  const today = todayInTeamZone(now);
  const sameDay = (iso: string) => todayInTeamZone(new Date(iso)) === today;
  const todayCount = week ? week.sessions.filter((s) => !s.excluded && sameDay(s.starts_at)).length : null;
  const subtitle = [
    todayCount === null ? null : todayCount === 0 ? t("athlete.hero.todayNone") : todayCount === 1 ? t("athlete.hero.todayOne") : t("athlete.hero.today", { n: todayCount }),
    teamName?.trim() || null,
  ].filter(Boolean).join(" · ");
  return (
    <section className="stagger flex flex-col gap-5">
      <Hero
        eyebrow={now.toLocaleDateString(dateLocale(locale), { weekday: "long", day: "numeric", month: "long", timeZone: TEAM_TIME_ZONE })}
        title={name ? t(`athlete.greeting.${part}`, { name }) : t(`athlete.greeting.${part}.anon`)}
        subtitle={subtitle || undefined}
      />

      <QuickLog
        teamId={teamId}
        items={pending.slice(0, QUICK_MAX).map((s) => ({
          id: s.id, type: s.type, title: s.title, startsAt: s.starts_at,
          plannedDurationMin: s.plannedDurationMin, plannedRpe: s.plannedRpe,
        }))}
      />
      {pending.length > QUICK_MAX && (
        <Link href={`/team/${teamId}/sessions`} className="link -mt-3 inline-flex min-h-11 w-fit items-center gap-1.5 px-1 text-sm">
          {t("athlete.pending.all")} <ArrowRight size={14} aria-hidden />
        </Link>
      )}

      {wellness && <WellnessCard teamId={teamId} today={wellness.today} />}

      <AvailabilityStrip availability={availability} t={t} />

      {week && <ThisWeek week={week} t={t} locale={locale} />}

      <details className="card group !p-0">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-md px-4 [&::-webkit-details-marker]:hidden">
          <span className="text-lg font-semibold">{t("athlete.load.summary")}</span>
          <span className="flex items-center gap-2 text-sm text-muted">
            <span className="num text-base text-[var(--foreground)]">{last7Load}</span>
            {t("athlete.load.unit")}
            <ChevronDown size={18} aria-hidden className="shrink-0 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="flex flex-col gap-6 border-t border-[var(--line)] px-4 pb-4 pt-4">
          <LoadCard last7Load={last7Load} attendedThisWeek={attendedThisWeek} weekly={weekly} t={t} />
          <WeeklyBars weekly={weekly} t={t} locale={locale} />
          <section className="flex flex-col gap-1" aria-label={t("athlete.recent.title")}>
            <p className="eyebrow mb-1">{t("athlete.recent.title")}</p>
            {recentLogs.length ? (
              <>
                <ul className="flex flex-col text-sm">
                  {recentLogs.slice(0, RECENT_SHOWN).map((l, i) => <RecentItem key={i} l={l} t={t} locale={locale} />)}
                </ul>
                {recentLogs.length > RECENT_SHOWN && (
                  <details className="group/more">
                    <summary className="link flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 text-sm [&::-webkit-details-marker]:hidden">
                      {t("athlete.recent.all", { n: recentLogs.length - RECENT_SHOWN })}
                    </summary>
                    <ul className="flex flex-col text-sm">
                      {recentLogs.slice(RECENT_SHOWN).map((l, i) => <RecentItem key={i} l={l} t={t} locale={locale} />)}
                    </ul>
                  </details>
                )}
              </>
            ) : (
              <p className="text-sm text-muted">{t("athlete.recent.empty")}</p>
            )}
          </section>
        </div>
      </details>
    </section>
  );
}
