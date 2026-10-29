import Link from "next/link";
import {
  Activity, Ban, CircleHelp, ClipboardList, Flame, TriangleAlert, UserCheck, Users, UserPlus,
  type LucideIcon,
} from "lucide-react";
import { AvailabilityIcon } from "@/components/icons";
import { getT } from "@/lib/i18n/server";
import { AVAILABILITY_KEY, dateLocale, type Locale, type MessageKey, type TFunction } from "@/lib/i18n";
import {
  applyFilter,
  sortByRisk,
  type AthleteRow,
  type DashboardFilter,
  type WeekTrendRow,
} from "@/lib/load";

const LEVEL: Record<AthleteRow["level"], { key: MessageKey; cls: string }> = {
  none: { key: "dashboard.level.none", cls: "badge badge-none" },
  out: { key: "dashboard.level.out", cls: "badge badge-none" },
  ok: { key: "dashboard.level.ok", cls: "badge badge-ok" },
  watch: { key: "dashboard.level.watch", cls: "badge badge-watch" },
  high: { key: "dashboard.level.high", cls: "badge badge-high" },
};

const FILTERS: { key: DashboardFilter; label: MessageKey; Icon: LucideIcon }[] = [
  { key: "all", label: "dashboard.filter.all", Icon: Users },
  { key: "alerts", label: "dashboard.filter.alerts", Icon: TriangleAlert },
  { key: "unavailable", label: "dashboard.filter.unavailable", Icon: Ban },
  { key: "missing", label: "dashboard.filter.missing", Icon: ClipboardList },
];

function Tile({
  label, value, sub, tone, Icon,
}: { label: string; value: string | number; sub?: string; tone?: "danger" | "warn"; Icon: LucideIcon }) {
  const color = tone === "danger" ? "text-danger" : tone === "warn" ? "text-[var(--warn)]" : "";
  return (
    <div className="card">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Icon size={14} aria-hidden /> {label}
      </p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

function TrendChart({ weeks, t, locale }: { weeks: WeekTrendRow[]; t: TFunction; locale: Locale }) {
  const max = Math.max(...weeks.map((w) => w.total_load), 1);
  const loc = dateLocale(locale);
  return (
    <div className="card">
      <h3 className="mb-3 flex items-center gap-1.5 font-semibold">
        <Activity size={16} aria-hidden /> {t("dashboard.trend.title")}
      </h3>
      <ol className="flex h-36 items-end gap-2" aria-label={t("dashboard.trend.title")}>
        {weeks.map((w, i) => {
          const current = i === weeks.length - 1;
          const d = new Date(w.week_start + "T00:00:00");
          return (
            <li key={w.week_start} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] tabular-nums text-muted">{w.total_load || ""}</span>
              <div
                className="w-full rounded-t"
                style={{
                  height: `${Math.max((w.total_load / max) * 100, w.total_load ? 4 : 1)}%`,
                  background: current ? "var(--primary)" : "var(--line)",
                }}
                role="img"
                aria-label={t("dashboard.trend.week", { date: d.toLocaleDateString(loc), load: w.total_load, n: w.athletes_logged })}
                title={t("dashboard.trend.week", { date: d.toLocaleDateString(loc), load: w.total_load, n: w.athletes_logged })}
              />
              <span className="text-[10px] text-muted">{d.toLocaleDateString(loc, { day: "numeric", month: "numeric" })}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function AthleteCard({ r, t }: { r: AthleteRow; t: TFunction }) {
  const lvl = LEVEL[r.level];
  const avail = r.availability ?? "available";
  const pct = r.max_weekly_load ? Math.min((r.acute_load / r.max_weekly_load) * 100, 100) : null;
  return (
    <li className="card flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{r.full_name || t("dashboard.athlete.unnamed")}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <AvailabilityIcon status={avail} size={14} />
              {t(AVAILABILITY_KEY[avail])}
            </span>
            {r.availability_note && <span>{r.availability_note}</span>}
            {r.missing > 0 && (
              <span className="badge badge-watch inline-flex items-center gap-1">
                <ClipboardList size={12} aria-hidden /> {t("dashboard.athlete.missing", { n: r.missing })}
              </span>
            )}
          </p>
        </div>
        <span className={lvl.cls}>{r.level !== "out" && r.acwr !== null ? `${r.acwr} ` : ""}{t(lvl.key)}</span>
      </div>
      <div className="flex items-end gap-6 text-sm">
        <div><p className="text-xs text-muted">{t("dashboard.athlete.acute")}</p><p className={`font-semibold tabular-nums ${r.over_limit ? "text-danger" : ""}`}>{r.acute_load}</p></div>
        <div><p className="text-xs text-muted">{t("dashboard.athlete.chronic")}</p><p className="font-semibold tabular-nums">{r.chronic_weekly_avg}</p></div>
        {r.max_weekly_load && (
          <div>
            <p className="flex items-center gap-1 text-xs text-muted">
              {t("dashboard.athlete.max")}
              <Link href="/help#limits" className="link" aria-label={t("dashboard.help.limits")}>
                <CircleHelp size={12} aria-hidden />
              </Link>
            </p>
            <p className="font-semibold tabular-nums">{r.max_weekly_load}</p>
          </div>
        )}
      </div>
      {pct !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]" role="img" aria-label={t("dashboard.athlete.limitPct", { n: Math.round(pct) })}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.over_limit ? "var(--danger)" : "var(--primary)" }} />
        </div>
      )}
    </li>
  );
}

export async function StaffDashboard({
  teamId, rows, weeks, filter,
}: { teamId: string; rows: AthleteRow[]; weeks: WeekTrendRow[]; filter: DashboardFilter }) {
  const { t, locale } = await getT();
  const alerts = rows.filter((r) => r.level === "high" || r.level === "watch").length;
  const high = rows.filter((r) => r.level === "high").length;
  const available = rows.filter((r) => (r.availability ?? "available") === "available").length;
  const missing = rows.reduce((s, r) => s + r.missing, 0);
  const thisWeek = weeks.at(-1)?.total_load ?? 0;
  const visible = sortByRisk(applyFilter(rows, filter));

  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile Icon={Flame} label={t("dashboard.tiles.load")} value={thisWeek} sub={t("dashboard.tiles.loadSub")} />
        <Tile Icon={TriangleAlert} label={t("dashboard.tiles.alerts")} value={alerts} sub={high ? t("dashboard.tiles.alertsHigh", { n: high }) : t("dashboard.tiles.alertsNone")} tone={high ? "danger" : alerts ? "warn" : undefined} />
        <Tile Icon={UserCheck} label={t("dashboard.tiles.available")} value={`${available}/${rows.length}`} />
        <Tile Icon={ClipboardList} label={t("dashboard.tiles.missing")} value={missing} sub={t("dashboard.tiles.missingSub")} tone={missing ? "warn" : undefined} />
      </div>

      <TrendChart weeks={weeks} t={t} locale={locale} />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("dashboard.filter.label")}>
        {FILTERS.map(({ key, label, Icon }) => (
          <Link
            key={key}
            href={key === "all" ? `/team/${teamId}` : `/team/${teamId}?filter=${key}`}
            aria-current={filter === key ? "page" : undefined}
            className={`tab inline-flex items-center gap-1.5 border ${filter === key ? "!bg-[var(--primary)] !text-[var(--on-primary)]" : ""}`}
          >
            <Icon size={14} aria-hidden /> {t(label)}
          </Link>
        ))}
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {visible.map((r) => <AthleteCard key={r.user_id} r={r} t={t} />)}
      </ul>
      {!visible.length && (
        rows.length ? (
          <p className="text-muted">{t("dashboard.empty.filter")}</p>
        ) : (
          <Link href={`/team/${teamId}/members`} className="btn btn-primary self-start">
            <UserPlus size={16} aria-hidden /> {t("dashboard.empty.invite")}
          </Link>
        )
      )}
      <Link href="/help#ratio" className="link inline-flex items-center gap-1 self-start text-xs">
        <CircleHelp size={14} aria-hidden /> {t("dashboard.help.ratio")}
      </Link>
    </section>
  );
}
