import Link from "next/link";
import {
  Ban, ChevronDown, ChevronRight, CircleAlert, CircleHelp, ClipboardList, HeartPulse, Lock, TriangleAlert, UserCheck, Users, UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Dial } from "@/components/Dial";
import { Hero } from "@/components/Hero";
import { AvailabilityIcon } from "@/components/icons";
import { getT } from "@/lib/i18n/server";
import { AVAILABILITY_KEY, dateLocale, type Locale, type MessageKey, type TFunction } from "@/lib/i18n";
import { isPosition, playerLabel } from "@/lib/positions";
import { TEAM_TIME_ZONE, wellnessAverage, wellnessFlag, type WellnessEntry } from "@/lib/wellness";
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

type WellnessMap = Record<string, WellnessEntry | null>;
type ConsentMap = Record<string, boolean>;
type PlayerMap = Record<string, { jersey: number | null; position: string | null }>;
const FLAG_CLS = { ok: "badge badge-ok", watch: "badge badge-watch", low: "badge badge-high" } as const;

type DeviationMap = Record<string, { pct: number | null; flagged: boolean }>;
/** Neutral badge text for the own-average comparison, e.g. "+42%". */
const pctText = (pct: number) => `${pct > 0 ? "+" : ""}${Math.round(pct)}%`;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function Stat({
  label, value, tone, Icon,
}: { label: string; value: string | number; tone?: "danger" | "warn"; Icon: LucideIcon }) {
  const color = tone === "danger" ? "text-danger" : tone === "warn" ? "text-[var(--warn)]" : "";
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-3 sm:px-3">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase leading-tight tracking-wider text-muted sm:text-[11px] sm:tracking-widest">
        <Icon size={13} aria-hidden className={`hidden shrink-0 sm:block ${tone ? color : "text-[var(--accent)]"}`} />
        <span className="min-w-0">{label}</span>
      </p>
      <p className={`num text-3xl sm:text-5xl ${color}`}>{value}</p>
    </div>
  );
}

function Tiles({
  available, total, alerts, high, missing, wellnessCount, t,
}: {
  available: number; total: number; alerts: number; high: number; missing: number;
  wellnessCount: { filled: number; total: number } | null; t: TFunction;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat Icon={UserCheck} label={t("dashboard.tiles.available")} value={`${available}/${total}`} />
        <Stat Icon={TriangleAlert} label={t("dashboard.tiles.alerts")} value={alerts} tone={high ? "danger" : alerts ? "warn" : undefined} />
        <Stat Icon={ClipboardList} label={t("dashboard.tiles.missing")} value={missing} tone={missing ? "warn" : undefined} />
      </div>
      {wellnessCount && wellnessCount.total > 0 && (
        <p className="flex items-center gap-2 px-1 text-sm text-muted">
          <HeartPulse size={16} aria-hidden className="text-[var(--accent)]" />
          {t("wellness.staff.tile")}
          <span className="num text-base text-[var(--foreground)]">{wellnessCount.filled}/{wellnessCount.total}</span>
        </p>
      )}
    </div>
  );
}

/** Collapsed by default: the team gauge and the weekly bars, for the coach who wants the trend. */
function WeekDetails({ weeks, showRatio, t, locale }: { weeks: WeekTrendRow[]; showRatio: boolean; t: TFunction; locale: Locale }) {
  const thisWeek = weeks.at(-1)?.total_load ?? 0;
  const max = Math.max(...weeks.map((w) => w.total_load), 1);
  const prev = weeks.slice(-5, -1);
  const avg = prev.length ? prev.reduce((s, w) => s + w.total_load, 0) / prev.length : 0;
  const hasBaseline = avg > 0;
  // The fixed 1.3 / 1.5 bands only colour the dial when the ratio is switched on.
  const tone: DialTone = !showRatio ? "primary" : hasBaseline && thisWeek > avg * 1.5 ? "danger" : hasBaseline && thisWeek > avg * 1.3 ? "warn" : "primary";
  const label = hasBaseline
    ? t("dashboard.hero.aria", { load: thisWeek, avg: Math.round(avg) })
    : t("dashboard.hero.aria.none", { load: thisWeek });
  const digits = String(thisWeek).length;
  return (
    <details className="card group !p-0">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-md px-4 [&::-webkit-details-marker]:hidden">
        <span className="text-lg font-semibold">{t("dashboard.trend.summary")}</span>
        <span className="flex items-center gap-2 text-sm text-muted">
          <span className="num text-base text-[var(--foreground)]">{thisWeek}</span>
          {t("dashboard.hero.caption")}
          <ChevronDown size={18} aria-hidden className="shrink-0 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="flex flex-col items-center gap-5 border-t border-[var(--line)] px-4 pb-4 pt-4">
        <p className="eyebrow self-start">{t("dashboard.hero.eyebrow")}</p>
        <Dial value={thisWeek / max} marker={hasBaseline ? avg / max : undefined} size={180} tone={tone} label={label}>
          <div>
            <p className="num" style={{ fontSize: digits > 4 ? "1.75rem" : "2.25rem" }}>{thisWeek}</p>
            <p className="mt-1 text-[11px] uppercase tracking-widest text-muted">{t("dashboard.hero.caption")}</p>
          </div>
        </Dial>
        <TrendChart weeks={weeks} t={t} locale={locale} />
      </div>
    </details>
  );
}

/** Level badge. Without the ratio the own-average comparison gets a neutral badge (no risk colour); a coach-set limit stays red. */
function badgeFor(r: AthleteRow, showRatio: boolean, deviation: DeviationMap, t: TFunction): { cls: string; text: string } {
  const lvl = LEVEL[r.level];
  if (showRatio || r.level === "high" || r.level === "out") {
    return { cls: lvl.cls, text: `${showRatio && r.level !== "out" && r.acwr !== null ? `${r.acwr} ` : ""}${t(lvl.key)}` };
  }
  const d = deviation[r.user_id];
  if (d?.pct == null) return { cls: "badge badge-none", text: t("dashboard.dev.none") };
  return { cls: "badge badge-none", text: t("dashboard.dev.badge", { pct: pctText(d.pct) }) };
}

function TrendChart({ weeks, t, locale }: { weeks: WeekTrendRow[]; t: TFunction; locale: Locale }) {
  const max = Math.max(...weeks.map((w) => w.total_load), 1);
  const loc = dateLocale(locale);
  const prev = weeks.slice(0, -1);
  const avg = prev.length ? prev.reduce((s, w) => s + w.total_load, 0) / prev.length : 0;
  const maxIdx = weeks.findIndex((w) => w.total_load === max);
  const scale = 86; // percent of plot height used by the tallest bar, leaves room for its value
  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{t("dashboard.trend.title")}</h3>
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
                  className="relative w-full max-w-5 rounded-t-sm"
                  style={{
                    height: `${Math.max((w.total_load / max) * scale, w.total_load ? 3 : 1)}%`,
                    background: current ? "var(--primary)" : "var(--line)",
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

function WellnessRow({ entry, consent, t }: { entry: WellnessEntry | null | undefined; consent: boolean; t: TFunction }) {
  if (!consent) {
    return (
      <span className="chip mt-1.5" title={t("wellness.staff.noConsentHint")}>
        <Lock size={12} aria-hidden /> {t("wellness.staff.noConsent")}
        <span className="sr-only">. {t("wellness.staff.noConsentHint")}</span>
      </span>
    );
  }
  if (!entry) {
    return (
      <span className="chip mt-1.5">
        <HeartPulse size={12} aria-hidden /> {t("wellness.staff.notFilled")}
      </span>
    );
  }
  const flag = wellnessFlag(entry);
  const avg = wellnessAverage(entry);
  return (
    <>
      <span className="mt-1.5 flex items-center gap-2" aria-label={t("wellness.staff.avg", { avg, flag: t(`wellness.flag.${flag}`) })}>
        <HeartPulse size={14} aria-hidden className="text-[var(--accent)]" />
        <span className="num text-sm" aria-hidden>{avg}</span>
        <span className={FLAG_CLS[flag]} aria-hidden>{t(`wellness.flag.${flag}`)}</span>
      </span>
      {entry.pain && (
        <span className="mt-1.5 flex w-fit max-w-full items-start gap-1 rounded-md bg-[var(--danger-bg)] px-2.5 py-1 text-xs font-semibold text-danger">
          <CircleAlert size={12} aria-hidden className="mt-0.5 shrink-0" />
          <span className="min-w-0 break-words">
            {entry.painLocation ? t("wellness.staff.painWhere", { where: entry.painLocation }) : t("wellness.staff.pain")}
          </span>
        </span>
      )}
    </>
  );
}

type Fit = "ok" | "less" | "out" | "unknown";
const FIT: Record<Fit, { key: MessageKey; cls: string; rank: number }> = {
  out: { key: "dashboard.fit.out", cls: "badge badge-high", rank: 0 },
  less: { key: "dashboard.fit.less", cls: "badge badge-watch", rank: 1 },
  unknown: { key: "dashboard.fit.unknown", cls: "badge badge-none", rank: 2 },
  ok: { key: "dashboard.fit.ok", cls: "badge badge-ok", rank: 3 },
};

/** Fit / less fit / not fit from availability, today's check-in (only with consent) and the load signal. Indicative; staff decide. */
function fitOf(r: AthleteRow, entry: WellnessEntry | null | undefined, consent: boolean): Fit {
  if (r.availability === "unavailable") return "out";
  const known = consent && entry ? entry : null;
  if (r.availability === "limited" || r.level === "high" || known?.pain || (known && wellnessFlag(known) === "low")) return "less";
  if (!r.availability && !known && r.level === "none") return "unknown";
  return "ok";
}

const LOAD_WORD: Record<"normal" | "high" | "low" | "none", MessageKey> = {
  normal: "dashboard.row.load.normal", high: "dashboard.row.load.high", low: "dashboard.row.load.low", none: "dashboard.row.load.none",
};

/** Plain word for this week's load against the athlete's own average, from the existing level logic. */
function loadWord(r: AthleteRow): keyof typeof LOAD_WORD {
  if (!r.has_baseline) return "none";
  if (r.level === "high") return "high";
  if (r.level === "watch") return r.acute_load >= r.chronic_weekly_avg ? "high" : "low";
  return "normal";
}

const BAR_COLOR: Record<DialTone, string> = {
  primary: "var(--primary)", accent: "var(--accent)", warn: "var(--warn)", danger: "var(--danger)",
};

function AthleteRowItem({
  r, teamId, wellness, consent, player, showRatio, deviation, t,
}: { r: AthleteRow; teamId: string; wellness?: WellnessMap; consent?: ConsentMap; player?: PlayerMap[string]; showRatio: boolean; deviation: DeviationMap; t: TFunction }) {
  const lvl = LEVEL[r.level];
  const badge = badgeFor(r, showRatio, deviation, t);
  const dialTone: DialTone = showRatio || r.level === "high" ? lvl.tone : "accent";
  const name = r.full_name || t("dashboard.athlete.unnamed");
  const cap = r.max_weekly_load ?? Math.max(r.chronic_weekly_avg * 1.5, 1);
  const tag = playerLabel(player?.jersey, isPosition(player?.position) ? t(`members.pos.${player.position}`) : null);
  const label = t("dashboard.athlete.dial", { name, acute: Math.round(r.acute_load), cap: Math.round(cap) });
  const given = !!consent?.[r.user_id];
  const entry = wellness?.[r.user_id];
  const fit = FIT[fitOf(r, entry, given)];
  const known = given && entry ? entry : null;
  const reasons = [
    known?.pain ? (known.painLocation ? t("wellness.staff.painWhere", { where: known.painLocation }) : t("wellness.staff.pain")) : null,
    known && !known.pain && wellnessFlag(known) === "low" ? t("wellness.staff.attention") : null,
    r.availability_note || null,
    r.missing > 0 ? t("dashboard.row.missing", { n: r.missing }) : null,
  ].filter((x): x is string => !!x);
  // Bar: this week's load against the athlete's own weekly average (the notch).
  const barMax = Math.max(r.acute_load, r.chronic_weekly_avg * 1.5, 1);
  const word = loadWord(r);
  const wordCls = word === "high" ? "text-[var(--warn)]" : "text-muted";
  return (
    <li>
      <details className="card group !p-0">
        <summary className="flex min-h-[4.25rem] cursor-pointer list-none items-center gap-3 rounded-md px-3 py-2.5 [&::-webkit-details-marker]:hidden">
          <Avatar name={r.full_name} size={40} />
          <div className="min-w-0 flex-1">
            <p className="flex items-baseline gap-1.5">
              <span className="truncate font-semibold">{name}</span>
              {player?.jersey != null && <span className="num shrink-0 text-xs text-muted">#{player.jersey}</span>}
            </p>
            {reasons.length > 0 && (
              <p className={`truncate text-xs ${known?.pain || fit === FIT.out ? "text-danger" : "text-muted"}`}>{reasons.join(" · ")}</p>
            )}
            <p className="mt-1.5 flex items-center gap-2 text-xs">
              <span aria-hidden className="relative h-1.5 w-16 shrink-0 rounded-full bg-[var(--surface-3)] sm:w-24">
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${Math.max(clamp01(r.acute_load / barMax) * 100, r.acute_load ? 4 : 0)}%`, background: BAR_COLOR[dialTone] }}
                />
                {r.has_baseline && (
                  <span className="absolute -inset-y-0.5 w-0.5 bg-[var(--foreground)] opacity-70" style={{ left: `${clamp01(r.chronic_weekly_avg / barMax) * 100}%` }} />
                )}
              </span>
              <span className={`num text-sm ${r.over_limit ? "text-danger" : ""}`}>{Math.round(r.acute_load)}</span>
              <span className={wordCls}>{t(LOAD_WORD[word])}</span>
            </p>
          </div>
          <span className="flex shrink-0 flex-col items-end gap-2">
            <span className={fit.cls}>{t(fit.key)}</span>
            <ChevronDown size={18} aria-hidden className="text-muted transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="flex flex-col gap-3 border-t border-[var(--line)] px-3 pb-3 pt-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap gap-x-5 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-muted">{t("dashboard.row.acute")}</p>
                <p className={`num mt-1 text-lg ${r.over_limit ? "text-danger" : ""}`}>{Math.round(r.acute_load)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">{t("dashboard.row.chronic")}</p>
                <p className="num mt-1 text-lg">{Math.round(r.chronic_weekly_avg)}</p>
              </div>
              {r.max_weekly_load && (
                <div>
                  <p className="flex items-center gap-1 text-xs text-muted">
                    {t("dashboard.athlete.max")}
                    <Link href="/help#limits" className="link -my-3 inline-grid min-h-11 min-w-11 place-items-center" aria-label={t("dashboard.help.limits")}>
                      <CircleHelp size={12} aria-hidden />
                    </Link>
                  </p>
                  <p className="num mt-1 text-lg">{Math.round(r.max_weekly_load)}</p>
                </div>
              )}
            </div>
            <Dial
              value={clamp01(r.acute_load / cap)}
              marker={r.has_baseline ? clamp01(r.chronic_weekly_avg / cap) : undefined}
              size={64}
              ticks={24}
              tone={dialTone}
              label={label}
            >
              <span className="num text-sm">{Math.round(r.acute_load)}</span>
            </Dial>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
            <span className={badge.cls}>{badge.text}</span>
            <span className="inline-flex items-center gap-1">
              <AvailabilityIcon status={r.availability ?? "available"} size={14} />
              {t(AVAILABILITY_KEY[r.availability ?? "available"])}
            </span>
            {tag && <span className="num">{tag}</span>}
          </div>
          {wellness && consent && (
            <div className="flex flex-col"><WellnessRow entry={wellness[r.user_id]} consent={given} t={t} /></div>
          )}
          {r.missing > 0 && (
            <span className="chip !text-[var(--warn)] w-fit">
              <ClipboardList size={12} aria-hidden /> {t("dashboard.athlete.missing", { n: r.missing })}
            </span>
          )}
          <Link
            href={`/team/${teamId}/athlete/${r.user_id}`}
            aria-label={t("wellness.staff.open", { name })}
            className="btn inline-flex min-h-11 w-full items-center justify-between gap-2"
          >
            <span className="truncate">{t("wellness.staff.open", { name })}</span>
            <ChevronRight size={16} aria-hidden className="shrink-0 text-[var(--accent)]" />
          </Link>
        </div>
      </details>
    </li>
  );
}

export async function StaffDashboard({
  teamId, rows, weeks, filter, wellness, consent, players, showRatio = false, deviation = {},
}: {
  teamId: string; rows: AthleteRow[]; weeks: WeekTrendRow[]; filter: DashboardFilter;
  wellness?: WellnessMap; consent?: ConsentMap; players?: PlayerMap;
  /** Team setting. Off by default: the acute:chronic ratio and its fixed bands stay hidden. */
  showRatio?: boolean;
  /** Each athlete's current week against their own previous weeks (pct, and whether it crosses the team threshold). */
  deviation?: DeviationMap;
}) {
  const { t, locale } = await getT();
  const alerts = rows.filter((r) => r.level === "high" || r.level === "watch").length;
  const high = rows.filter((r) => r.level === "high").length;
  const available = rows.filter((r) => (r.availability ?? "available") === "available").length;
  const missing = rows.reduce((s, r) => s + r.missing, 0);
  const fitRank = (r: AthleteRow) => FIT[fitOf(r, wellness?.[r.user_id], !!consent?.[r.user_id])].rank;
  // Not fit first, then less fit, then the rest; within a group the existing risk order.
  const visible = sortByRisk(applyFilter(rows, filter)).sort((a, b) => fitRank(a) - fitRank(b));
  const consenting = consent ? rows.filter((r) => consent[r.user_id]) : [];
  const wellnessCount = wellness && consent
    ? { filled: consenting.filter((r) => wellness[r.user_id]).length, total: consenting.length }
    : null;

  // A short team needs no filter, unless one is already active via the URL (then it must stay clearable).
  const showFilters = rows.length >= 6 || filter !== "all";

  return (
    <section className="stagger flex flex-col gap-5">
      <Hero
        eyebrow={new Date().toLocaleDateString(dateLocale(locale), { weekday: "long", day: "numeric", month: "long", timeZone: TEAM_TIME_ZONE })}
        title={t("dashboard.overview.title")}
        subtitle={t("dashboard.overview.subtitle")}
      />

      <Tiles available={available} total={rows.length} alerts={alerts} high={high} missing={missing} wellnessCount={wellnessCount} t={t} />

      <div className="flex flex-col gap-3">
        {showFilters && (
          <nav aria-label={t("dashboard.filter.label")} className="flex flex-wrap gap-2">
            {FILTERS.map(({ key, label, Icon }) => {
              const active = filter === key;
              return (
                <Link
                  key={key}
                  href={key === "all" ? `/team/${teamId}` : `/team/${teamId}?filter=${key}`}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--primary)]"
                      : "border-[var(--line)] text-muted hover:text-[var(--foreground)]"
                  }`}
                >
                  <Icon size={14} aria-hidden /> {t(label)}
                  <span className="num text-xs opacity-80">{applyFilter(rows, key).length}</span>
                </Link>
              );
            })}
          </nav>
        )}
        <ul className="grid gap-2 sm:grid-cols-2">
          {visible.map((r) => <AthleteRowItem key={r.user_id} r={r} teamId={teamId} wellness={wellness} consent={consent} player={players?.[r.user_id]} showRatio={showRatio} deviation={deviation} t={t} />)}
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

      <WeekDetails weeks={weeks} showRatio={showRatio} t={t} locale={locale} />

      {showRatio && (
        <Link href="/help#ratio" className="link inline-flex min-h-11 items-center gap-1 self-start text-xs">
          <CircleHelp size={14} aria-hidden /> {t("dashboard.help.ratio")}
        </Link>
      )}
    </section>
  );
}
