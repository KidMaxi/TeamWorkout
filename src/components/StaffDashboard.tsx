import Link from "next/link";
import {
  Ban, CircleHelp, ClipboardList, TriangleAlert, UserCheck, Users, UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Dial } from "@/components/Dial";
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

type DialTone = "primary" | "accent" | "warn" | "danger";

const LEVEL: Record<AthleteRow["level"], { key: MessageKey; cls: string; tone: DialTone }> = {
  none: { key: "dashboard.level.none", cls: "badge badge-none", tone: "accent" },
  out: { key: "dashboard.level.out", cls: "badge badge-none", tone: "accent" },
  ok: { key: "dashboard.level.ok", cls: "badge badge-ok", tone: "primary" },
  watch: { key: "dashboard.level.watch", cls: "badge badge-watch", tone: "warn" },
  high: { key: "dashboard.level.high", cls: "badge badge-high", tone: "danger" },
};

const FILTERS: { key: DashboardFilter; label: MessageKey; Icon: LucideIcon }[] = [
  { key: "all", label: "dashboard.filter.all", Icon: Users },
  { key: "alerts", label: "dashboard.filter.alerts", Icon: TriangleAlert },
  { key: "unavailable", label: "dashboard.filter.unavailable", Icon: Ban },
  { key: "missing", label: "dashboard.filter.missing", Icon: ClipboardList },
];

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function shortName(full: string, fallback: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
}

function Stat({
  label, value, tone, Icon,
}: { label: string; value: string | number; tone?: "danger" | "warn"; Icon: LucideIcon }) {
  const color = tone === "danger" ? "text-danger" : tone === "warn" ? "text-[var(--warn)]" : "";
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-[var(--line)] bg-[var(--surface-2)]/60 px-2 py-3 text-center">
      <Icon size={16} aria-hidden className={tone ? color : "text-[var(--accent)]"} />
      <p className={`num text-2xl ${color}`}>{value}</p>
      <p className="text-[11px] leading-tight text-muted">{label}</p>
    </div>
  );
}

function Hero({
  weeks, available, total, alerts, high, missing, t,
}: {
  weeks: WeekTrendRow[]; available: number; total: number; alerts: number; high: number; missing: number; t: TFunction;
}) {
  const thisWeek = weeks.at(-1)?.total_load ?? 0;
  const max = Math.max(...weeks.map((w) => w.total_load), 1);
  const prev = weeks.slice(-5, -1);
  const avg = prev.length ? prev.reduce((s, w) => s + w.total_load, 0) / prev.length : 0;
  const hasBaseline = avg > 0;
  const tone: DialTone = hasBaseline && thisWeek > avg * 1.5 ? "danger" : hasBaseline && thisWeek > avg * 1.3 ? "warn" : "primary";
  const label = hasBaseline
    ? t("dashboard.hero.aria", { load: thisWeek, avg: Math.round(avg) })
    : t("dashboard.hero.aria.none", { load: thisWeek });
  const digits = String(thisWeek).length;
  return (
    <div className="card card-hero flex flex-col items-center gap-5">
      <p className="eyebrow self-start">{t("dashboard.hero.eyebrow")}</p>
      <Dial value={thisWeek / max} marker={hasBaseline ? avg / max : undefined} size={232} tone={tone} label={label}>
        <div>
          <p className="num" style={{ fontSize: digits > 4 ? "2.25rem" : "3rem" }}>{thisWeek}</p>
          <p className="mt-1.5 text-[11px] uppercase tracking-widest text-muted">{t("dashboard.hero.caption")}</p>
        </div>
      </Dial>
      <div className="grid w-full grid-cols-3 gap-2">
        <Stat Icon={UserCheck} label={t("dashboard.tiles.available")} value={`${available}/${total}`} />
        <Stat Icon={TriangleAlert} label={t("dashboard.tiles.alerts")} value={alerts} tone={high ? "danger" : alerts ? "warn" : undefined} />
        <Stat Icon={ClipboardList} label={t("dashboard.tiles.missing")} value={missing} tone={missing ? "warn" : undefined} />
      </div>
    </div>
  );
}

function Attention({ rows, t }: { rows: AthleteRow[]; t: TFunction }) {
  return (
    <section aria-label={t("dashboard.attention.title")}>
      <p className="eyebrow mb-2 px-1">{t("dashboard.attention.title")}</p>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rows.map((r) => {
          const lvl = LEVEL[r.level];
          return (
            <li key={r.user_id} className="card flex w-40 shrink-0 snap-start flex-col gap-2 !p-3">
              <div className="flex items-center gap-2">
                <Avatar name={r.full_name} size={36} />
                <p className="min-w-0 truncate text-sm font-semibold">{shortName(r.full_name, t("dashboard.athlete.unnamed"))}</p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className={lvl.cls}>{t(lvl.key)}</span>
                <span className="text-right">
                  <span className="num text-lg">{r.acute_load}</span>
                  <span className="ml-1 text-[11px] text-muted">{t("dashboard.athlete.acute")}</span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function TrendChart({ weeks, t, locale }: { weeks: WeekTrendRow[]; t: TFunction; locale: Locale }) {
  const max = Math.max(...weeks.map((w) => w.total_load), 1);
  const loc = dateLocale(locale);
  const prev = weeks.slice(0, -1);
  const avg = prev.length ? prev.reduce((s, w) => s + w.total_load, 0) / prev.length : 0;
  const maxIdx = weeks.findIndex((w) => w.total_load === max);
  const scale = 86; // percent of plot height used by the tallest bar, leaves room for its value
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="font-semibold">{t("dashboard.trend.title")}</h3>
        {avg > 0 && (
          <span className="flex items-center gap-1.5 text-[11px] text-muted">
            <span aria-hidden className="w-4 border-t border-dashed border-[var(--accent)]" /> {t("dashboard.trend.avg")} {Math.round(avg)}
          </span>
        )}
      </div>
      <div className="relative h-32">
        {avg > 0 && (
          <div
            aria-hidden
            className="absolute inset-x-0 border-t border-dashed border-[var(--accent)]"
            style={{ bottom: `${(avg / max) * scale}%` }}
          />
        )}
        <ol className="relative flex h-full items-end gap-1.5" aria-label={t("dashboard.trend.title")}>
          {weeks.map((w, i) => {
            const current = i === weeks.length - 1;
            const d = new Date(w.week_start + "T00:00:00");
            const text = t("dashboard.trend.week", { date: d.toLocaleDateString(loc), load: w.total_load, n: w.athletes_logged });
            return (
              <li key={w.week_start} className="flex h-full flex-1 items-end justify-center">
                <div
                  className="relative w-full max-w-5 rounded-full"
                  style={{
                    height: `${Math.max((w.total_load / max) * scale, w.total_load ? 3 : 1)}%`,
                    background: current
                      ? "linear-gradient(180deg, var(--primary), color-mix(in srgb, var(--primary) 55%, transparent))"
                      : "linear-gradient(180deg, color-mix(in srgb, var(--accent) 40%, var(--surface-3)), color-mix(in srgb, var(--accent) 14%, var(--surface-2)))",
                    boxShadow: current ? "0 0 14px -2px var(--primary)" : undefined,
                  }}
                  role="img"
                  aria-label={text}
                  title={text}
                >
                  {(current || i === maxIdx) && w.total_load > 0 && (
                    <span className={`num absolute -top-4 left-1/2 -translate-x-1/2 text-[11px] ${current ? "" : "text-muted"}`}>
                      {w.total_load}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      <ol className="mt-2 flex gap-1.5" aria-hidden>
        {weeks.map((w, i) => {
          const d = new Date(w.week_start + "T00:00:00");
          return (
            <li key={w.week_start} className={`flex-1 text-center text-[10px] ${i === weeks.length - 1 ? "font-semibold" : "text-muted"}`}>
              {d.toLocaleDateString(loc, { day: "numeric", month: "numeric" })}
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
  const name = r.full_name || t("dashboard.athlete.unnamed");
  const cap = r.max_weekly_load ?? Math.max(r.chronic_weekly_avg * 1.5, 1);
  const label = t("dashboard.athlete.dial", { name, acute: r.acute_load, cap: Math.round(cap) });
  return (
    <li className="card flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Avatar name={r.full_name} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <AvailabilityIcon status={avail} size={14} />
              {t(AVAILABILITY_KEY[avail])}
            </span>
            {r.availability_note && <span>{r.availability_note}</span>}
          </p>
          {r.missing > 0 && (
            <span className="chip mt-1.5 !text-[var(--warn)]">
              <ClipboardList size={12} aria-hidden /> {t("dashboard.athlete.missing", { n: r.missing })}
            </span>
          )}
        </div>
        <span className={lvl.cls}>{r.level !== "out" && r.acwr !== null ? `${r.acwr} ` : ""}{t(lvl.key)}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-5 text-sm">
          <div>
            <p className="text-xs text-muted">{t("dashboard.athlete.acute")}</p>
            <p className={`num mt-1 text-lg ${r.over_limit ? "text-danger" : ""}`}>{r.acute_load}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("dashboard.athlete.chronic")}</p>
            <p className="num mt-1 text-lg">{r.chronic_weekly_avg}</p>
          </div>
          {r.max_weekly_load && (
            <div>
              <p className="flex items-center gap-1 text-xs text-muted">
                {t("dashboard.athlete.max")}
                <Link href="/help#limits" className="link inline-grid min-h-6 min-w-6 place-items-center" aria-label={t("dashboard.help.limits")}>
                  <CircleHelp size={12} aria-hidden />
                </Link>
              </p>
              <p className="num mt-1 text-lg">{r.max_weekly_load}</p>
            </div>
          )}
        </div>
        <Dial
          value={clamp01(r.acute_load / cap)}
          marker={r.has_baseline ? clamp01(r.chronic_weekly_avg / cap) : undefined}
          size={64}
          ticks={24}
          tone={lvl.tone}
          label={label}
        >
          <span className="num text-sm">{r.acute_load}</span>
        </Dial>
      </div>
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
  const visible = sortByRisk(applyFilter(rows, filter));
  const attention = sortByRisk(rows.filter((r) => r.level === "high" || r.level === "watch" || r.level === "out"));

  return (
    <section className="stagger flex flex-col gap-5">
      <Hero weeks={weeks} available={available} total={rows.length} alerts={alerts} high={high} missing={missing} t={t} />

      {attention.length > 0 && <Attention rows={attention} t={t} />}

      <TrendChart weeks={weeks} t={t} locale={locale} />

      <nav aria-label={t("dashboard.filter.label")} className="glass flex max-w-full gap-1 self-start overflow-x-auto rounded-full p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map(({ key, label, Icon }) => {
          const active = filter === key;
          return (
            <Link
              key={key}
              href={key === "all" ? `/team/${teamId}` : `/team/${teamId}?filter=${key}`}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors ${
                active ? "bg-[var(--primary)] text-[var(--on-primary)]" : "text-muted hover:text-[var(--foreground)]"
              }`}
            >
              <Icon size={14} aria-hidden /> {t(label)}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-3">
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((r) => <AthleteCard key={r.user_id} r={r} t={t} />)}
        </ul>
        {!visible.length && (
          rows.length ? (
            <p className="text-muted">{t("dashboard.empty.filter")}</p>
          ) : (
            <Link href={`/team/${teamId}/members`} className="btn btn-primary inline-flex min-h-11 items-center gap-2 self-start">
              <UserPlus size={16} aria-hidden /> {t("dashboard.empty.invite")}
            </Link>
          )
        )}
      </div>

      <Link href="/help#ratio" className="link inline-flex min-h-10 items-center gap-1 self-start text-xs">
        <CircleHelp size={14} aria-hidden /> {t("dashboard.help.ratio")}
      </Link>
    </section>
  );
}
