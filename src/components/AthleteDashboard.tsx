import Link from "next/link";
import { ArrowRight, Ban, CalendarCheck } from "lucide-react";
import { WellnessCard } from "@/components/WellnessCard";
import { Dial } from "@/components/Dial";
import { QuickLog } from "@/components/QuickLog";
import { AvailabilityIcon, SessionTypeIcon } from "@/components/icons";
import { getT } from "@/lib/i18n/server";
import { AVAILABILITY_KEY, SESSION_TYPE_KEY, dateLocale, type Locale, type TFunction } from "@/lib/i18n";
import type { Availability, SessionType } from "@/lib/load";
import { TEAM_TIME_ZONE, type WellnessEntry } from "@/lib/wellness";

export type AthleteDashboardProps = {
  teamId: string;
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

const dateFmt = (iso: string, locale: Locale) =>
  new Date(iso).toLocaleDateString(dateLocale(locale), { weekday: "short", day: "numeric", month: "short" });

function Hero({
  last7Load, attendedThisWeek, weekly, t,
}: { last7Load: number; attendedThisWeek: number; weekly: AthleteDashboardProps["weekly"]; t: TFunction }) {
  const max = Math.max(...weekly.map((w) => w.total_load), last7Load, 1);
  const prev = weekly.slice(0, -1);
  const avg = prev.length ? prev.reduce((s, w) => s + w.total_load, 0) / prev.length : 0;
  return (
    <div className="card card-hero flex flex-col items-center gap-5">
      <p className="eyebrow self-start">{t("athlete.hero.eyebrow")}</p>
      <Dial
        value={last7Load / max}
        marker={avg > 0 ? avg / max : undefined}
        size={220}
        tone="primary"
        label={t("athlete.hero.aria", { load: last7Load, avg: Math.round(avg) })}
      >
        <p className="num" style={{ fontSize: String(last7Load).length > 4 ? "2.25rem" : "3rem" }}>{last7Load}</p>
      </Dial>
      <div className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-2)]/60 px-4 py-2 text-sm">
        <CalendarCheck size={16} aria-hidden className="text-[var(--accent)]" />
        <span className="num text-lg">{attendedThisWeek}</span>
        <span className="text-muted">{t("athlete.tiles.attended")} {t("athlete.tiles.attendedSub")}</span>
      </div>
    </div>
  );
}

function AvailabilityStrip({ availability, t }: { availability: AthleteDashboardProps["availability"]; t: TFunction }) {
  const status = availability?.status ?? "available";
  const note = availability?.note;
  const flagged = status !== "available";
  const color = status === "limited" ? "var(--warn)" : status === "unavailable" ? "var(--danger)" : "var(--accent)";
  return (
    <div
      className="card flex items-center gap-3 !py-3"
      role={flagged ? "status" : undefined}
      style={flagged ? { background: status === "limited" ? "var(--warn-bg)" : "var(--danger-bg)", borderColor: color } : undefined}
    >
      <span
        className="grid size-10 shrink-0 place-items-center rounded-full"
        style={{ color, boxShadow: `0 0 0 1px color-mix(in srgb, ${color} 55%, transparent)` }}
      >
        <AvailabilityIcon status={status} size={20} />
      </span>
      <div className="min-w-0">
        <p className="font-semibold">{t(AVAILABILITY_KEY[status])}</p>
        {(note || flagged) && <p className={`text-sm ${note ? "" : "text-muted"}`}>{note || t("athlete.status.note")}</p>}
      </div>
    </div>
  );
}

function WeeklyBars({ weekly, t, locale }: { weekly: AthleteDashboardProps["weekly"]; t: TFunction; locale: Locale }) {
  const max = Math.max(...weekly.map((w) => w.total_load), 1);
  const scale = 84;
  const labelOf = (iso: string) =>
    new Date(iso + "T00:00:00Z").toLocaleDateString(dateLocale(locale), { day: "numeric", month: "numeric", timeZone: "UTC" });
  return (
    <div className="card">
      <h3 className="mb-4 font-semibold">{t("athlete.weekly.title")}</h3>
      <ol className="flex h-24 items-end gap-1.5" aria-label={t("athlete.weekly.aria")}>
        {weekly.map((w, i) => {
          const current = i === weekly.length - 1;
          const text = t(current ? "athlete.weekly.weekCurrent" : "athlete.weekly.week", { date: labelOf(w.week_start), load: w.total_load });
          return (
            <li key={w.week_start} className="flex h-full flex-1 items-end justify-center">
              <div
                className="relative w-full max-w-5 rounded-full"
                style={{
                  height: `${Math.max((w.total_load / max) * scale, w.total_load ? 4 : 1)}%`,
                  background: current
                    ? "linear-gradient(180deg, var(--primary), color-mix(in srgb, var(--primary) 55%, transparent))"
                    : "linear-gradient(180deg, color-mix(in srgb, var(--accent) 40%, var(--surface-3)), color-mix(in srgb, var(--accent) 14%, var(--surface-2)))",
                  boxShadow: current ? "0 0 14px -2px var(--primary)" : undefined,
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
          <li key={w.week_start} className={`flex-1 text-center text-[10px] ${i === weekly.length - 1 ? "font-semibold" : "text-muted"}`}>
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
      <h3 className="font-semibold">{t("athlete.week.title")}</h3>
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

export async function AthleteDashboard({
  teamId, availability, pending, weekly, recentLogs, last7Load, attendedThisWeek, wellness, week,
}: AthleteDashboardProps) {
  const { t, locale } = await getT();
  return (
    <section className="stagger flex flex-col gap-5">
      <Hero last7Load={last7Load} attendedThisWeek={attendedThisWeek} weekly={weekly} t={t} />

      {wellness && !wellness.today && <WellnessCard teamId={teamId} today={null} />}

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

      {wellness?.today && <WellnessCard teamId={teamId} today={wellness.today} />}

      <AvailabilityStrip availability={availability} t={t} />

      {week && <ThisWeek week={week} t={t} locale={locale} />}

      <WeeklyBars weekly={weekly} t={t} locale={locale} />

      <section className="flex flex-col gap-1" aria-label={t("athlete.recent.title")}>
        <p className="eyebrow mb-1 px-1">{t("athlete.recent.title")}</p>
        {recentLogs.length ? (
          <ul className="card flex flex-col !py-1 text-sm">
            {recentLogs.map((l, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[var(--line)] py-2.5 last:border-b-0">
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
            ))}
          </ul>
        ) : (
          <p className="px-1 text-sm text-muted">{t("athlete.recent.empty")}</p>
        )}
      </section>
    </section>
  );
}
