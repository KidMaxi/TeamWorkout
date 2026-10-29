import Link from "next/link";
import { Ban, CalendarCheck, CircleCheck, ClipboardList, Flame, History, Pencil } from "lucide-react";
import { AvailabilityIcon, SessionTypeIcon } from "@/components/icons";
import { getT } from "@/lib/i18n/server";
import { AVAILABILITY_KEY, SESSION_TYPE_KEY, dateLocale, type Locale, type TFunction } from "@/lib/i18n";
import type { Availability, SessionType } from "@/lib/load";

export type AthleteDashboardProps = {
  teamId: string;
  availability: { status: Availability; note: string | null } | null;
  pending: { id: string; type: SessionType; title: string; starts_at: string }[];
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
};

const dateFmt = (iso: string, locale: Locale) =>
  new Date(iso).toLocaleDateString(dateLocale(locale), { weekday: "short", day: "numeric", month: "short" });

function Tile({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="card">
      <p className="flex items-center gap-1.5 text-xs text-muted">{icon} {label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

function AvailabilityBanner({ availability, t }: { availability: AthleteDashboardProps["availability"]; t: TFunction }) {
  const status = availability?.status ?? "available";
  const note = availability?.note;
  if (status === "available") {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="badge badge-ok inline-flex items-center gap-1">
          <AvailabilityIcon status="available" size={14} /> {t(AVAILABILITY_KEY.available)}
        </span>
        {note && <span className="text-muted">{note}</span>}
      </div>
    );
  }
  const limited = status === "limited";
  return (
    <div
      className="card flex flex-col gap-1"
      role="status"
      style={{
        background: limited ? "var(--warn-bg)" : "var(--danger-bg)",
        borderColor: limited ? "var(--warn)" : "var(--danger)",
      }}
    >
      <p className="flex items-center gap-2 text-lg font-semibold">
        <AvailabilityIcon status={status} size={20} /> {t(AVAILABILITY_KEY[status])}
      </p>
      <p className={`text-sm ${note ? "" : "text-muted"}`}>{note || t("athlete.status.note")}</p>
    </div>
  );
}

function WeeklyBars({ weekly, t, locale }: { weekly: AthleteDashboardProps["weekly"]; t: TFunction; locale: Locale }) {
  const max = Math.max(...weekly.map((w) => w.total_load), 1);
  return (
    <div className="card">
      <h3 className="mb-3 flex items-center gap-1.5 font-semibold">
        <Flame size={16} aria-hidden /> {t("athlete.weekly.title")}
      </h3>
      <ol className="flex h-36 items-end gap-2" aria-label={t("athlete.weekly.aria")}>
        {weekly.map((w, i) => {
          const current = i === weekly.length - 1;
          const d = new Date(w.week_start + "T00:00:00Z");
          const label = d.toLocaleDateString(dateLocale(locale), { day: "numeric", month: "numeric", timeZone: "UTC" });
          return (
            <li key={w.week_start} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] tabular-nums text-muted">{w.total_load}</span>
              <div
                className="w-full rounded-t"
                style={{
                  height: `${Math.max((w.total_load / max) * 100, w.total_load ? 4 : 1)}%`,
                  background: current ? "var(--primary)" : "var(--line)",
                }}
                role="img"
                aria-label={t(current ? "athlete.weekly.weekCurrent" : "athlete.weekly.week", { date: label, load: w.total_load })}
              />
              <span className={`text-[10px] ${current ? "font-semibold" : "text-muted"}`}>{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export async function AthleteDashboard({
  teamId, availability, pending, weekly, recentLogs, last7Load, attendedThisWeek,
}: AthleteDashboardProps) {
  const { t, locale } = await getT();
  return (
    <section className="flex flex-col gap-4">
      <AvailabilityBanner availability={availability} t={t} />

      <div className="card flex flex-col gap-3">
        <h3 className="flex items-center gap-1.5 font-semibold">
          <ClipboardList size={16} aria-hidden /> {t("athlete.pending.title")}
        </h3>
        {pending.length ? (
          <ul className="flex flex-col gap-2">
            {pending.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <SessionTypeIcon type={s.type} size={18} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t(SESSION_TYPE_KEY[s.type])}{s.title ? ` ${s.title}` : ""}</p>
                    <p className="text-xs text-muted">{dateFmt(s.starts_at, locale)}</p>
                  </div>
                </div>
                <Link href={`/team/${teamId}/sessions`} className="btn btn-primary">
                  <Pencil size={14} aria-hidden /> {t("athlete.pending.fill")}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <CircleCheck size={16} aria-hidden /> {t("athlete.pending.done")}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Tile icon={<Flame size={14} aria-hidden />} label={t("athlete.tiles.last7")} value={last7Load} />
        <Tile icon={<CalendarCheck size={14} aria-hidden />} label={t("athlete.tiles.attended")} value={attendedThisWeek} sub={t("athlete.tiles.attendedSub")} />
      </div>

      <WeeklyBars weekly={weekly} t={t} locale={locale} />

      <div className="card flex flex-col gap-2">
        <h3 className="flex items-center gap-1.5 font-semibold">
          <History size={16} aria-hidden /> {t("athlete.recent.title")}
        </h3>
        {recentLogs.length ? (
          <ul className="flex flex-col text-sm">
            {recentLogs.map((l, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[var(--line)] py-2 last:border-b-0">
                <span className="flex min-w-0 items-center gap-2">
                  <SessionTypeIcon type={l.type} />
                  <span className="truncate">
                    <span className="text-muted">{dateFmt(l.starts_at, locale)}</span>{" "}
                    {l.title || t(SESSION_TYPE_KEY[l.type])}
                  </span>
                </span>
                {l.attended ? (
                  <span className="badge badge-none tabular-nums">
                    {t("athlete.recent.calc", { min: l.duration_min, rpe: l.rpe, load: l.load })}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-muted">
                    <Ban size={14} aria-hidden /> {t("athlete.recent.absent")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t("athlete.recent.empty")}</p>
        )}
      </div>
    </section>
  );
}
