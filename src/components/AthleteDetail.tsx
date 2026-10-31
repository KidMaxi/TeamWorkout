import Link from "next/link";
import { Ban, ChevronLeft, CircleAlert, CircleHelp, Lock, Pencil, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Dial } from "@/components/Dial";
import { AvailabilityIcon, SessionTypeIcon } from "@/components/icons";
import { getT } from "@/lib/i18n/server";
import {
  AVAILABILITY_KEY, ROLE_KEY, SESSION_TYPE_KEY, dateLocale,
  type Locale, type MessageKey, type TFunction,
} from "@/lib/i18n";
import type { AthleteRow, Availability, LoadRow, SessionType } from "@/lib/load";
import {
  WELLNESS_ITEMS, todayInTeamZone, wellnessFlag, type WellnessEntry,
} from "@/lib/wellness";

type Level = AthleteRow["level"];
type DialTone = "primary" | "accent" | "warn" | "danger";

const LEVEL: Record<Level, { key: MessageKey; cls: string; tone: DialTone }> = {
  none: { key: "dashboard.level.none", cls: "badge badge-none", tone: "accent" },
  out: { key: "dashboard.level.out", cls: "badge badge-none", tone: "accent" },
  ok: { key: "dashboard.level.ok", cls: "badge badge-ok", tone: "primary" },
  watch: { key: "dashboard.level.watch", cls: "badge badge-watch", tone: "warn" },
  high: { key: "dashboard.level.high", cls: "badge badge-high", tone: "danger" },
};

const FLAG_COLOR = { ok: "var(--ok)", watch: "var(--warn)", low: "var(--danger)" } as const;
const FLAG_KEY = { ok: "wellness.flag.ok", watch: "wellness.flag.watch", low: "wellness.flag.low" } as const satisfies Record<string, MessageKey>;
const ITEM_KEY = {
  sleep: "wellness.item.sleep", soreness: "wellness.item.soreness", fatigue: "wellness.item.fatigue",
  stress: "wellness.item.stress", mood: "wellness.item.mood",
} as const satisfies Record<string, MessageKey>;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const fmt1 = (n: number) => (Math.round(n * 10) / 10).toString();

export type AthleteDetailProps = {
  teamId: string;
  name: string;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  consent: boolean;
  availability: { status: Availability; note: string | null };
  row: LoadRow;
  level: Level;
  /** Oldest first, last is the current week. week_start is YYYY-MM-DD (Monday). */
  weekly: { week_start: string; total_load: number }[];
  /** Newest first. */
  recent: { starts_at: string; type: SessionType; title: string; attended: boolean; duration_min: number; rpe: number; load: number; note?: string | null }[];
  missing: number;
  /** Newest first, only present when consent is given. */
  wellness: (WellnessEntry & { avg: number })[];
  /** Team setting. Off by default: the acute:chronic ratio and its fixed bands stay hidden. */
  showRatio?: boolean;
  /** This week against the athlete's own previous weeks; null pct = not enough history yet. */
  deviation?: { pct: number | null; baseline: number | null; flagged: boolean };
};

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-[var(--line)] bg-[var(--surface-2)]/60 px-1.5 py-3 text-center">
      <div className="flex min-h-7 items-center">{children}</div>
      <p className="text-[11px] leading-tight text-muted">{label}</p>
    </div>
  );
}

function Hero({ row, level, showRatio, deviation, t }: {
  row: LoadRow; level: Level; showRatio: boolean; deviation?: AthleteDetailProps["deviation"]; t: TFunction;
}) {
  const acute = Math.round(row.acute_load);
  const chronic = Math.round(row.chronic_weekly_avg);
  const denom = row.max_weekly_load ?? Math.max(row.chronic_weekly_avg * 1.5, 1);
  const L = LEVEL[level];
  // Fixed-band colours only with the ratio on; a coach-set limit stays red.
  const tone: DialTone = showRatio || level === "high" ? L.tone : "accent";
  return (
    <div className="card card-hero flex flex-col items-center gap-5">
      <p className="eyebrow self-start">{t("detail.hero.eyebrow")}</p>
      <Dial
        value={clamp01(row.acute_load / denom)}
        marker={row.chronic_weekly_avg > 0 ? clamp01(row.chronic_weekly_avg / denom) : undefined}
        size={200}
        tone={tone}
        label={t("detail.hero.aria", { load: acute, chronic })}
      >
        <p className="num" style={{ fontSize: String(acute).length > 4 ? "2.1rem" : "2.8rem" }}>{acute}</p>
      </Dial>
      <div className="grid w-full grid-cols-4 gap-2">
        <Tile label={t("detail.tile.acute")}><span className="num text-xl">{acute}</span></Tile>
        <Tile label={t("detail.tile.chronic")}><span className="num text-xl">{chronic}</span></Tile>
        {showRatio ? (
          <Tile label={t("detail.tile.ratio")}>
            {row.acwr !== null ? (
              <span className="flex flex-col items-center gap-1">
                <span className="num text-xl">{row.acwr.toFixed(2)}</span>
                <span className={L.cls}>{t(L.key)}</span>
              </span>
            ) : (
              <span className="text-[11px] leading-tight text-muted">{t("detail.ratio.none")}</span>
            )}
          </Tile>
        ) : (
          <Tile label={t("detail.tile.deviation")}>
            {deviation?.pct != null ? (
              <span className="flex flex-col items-center gap-1">
                <span className="num text-xl">{deviation.pct > 0 ? "+" : ""}{Math.round(deviation.pct)}%</span>
                <span className="badge badge-none">{t("detail.deviation.own")}</span>
              </span>
            ) : (
              <span className="text-[11px] leading-tight text-muted">{t("detail.deviation.none")}</span>
            )}
          </Tile>
        )}
        <Tile label={t("detail.tile.limit")}>
          <span className="num text-xl">{row.max_weekly_load ?? "–"}</span>
        </Tile>
      </div>
      {showRatio ? (
        <Link href="/help#ratio" className="link -my-2 inline-flex min-h-11 items-center gap-1.5 self-end text-xs">
          <CircleHelp size={14} aria-hidden /> {t("detail.ratio.help")}
        </Link>
      ) : (
        <p className="self-start text-xs text-muted">{t("detail.deviation.note")}</p>
      )}
    </div>
  );
}

function WeeklyBars({ weekly, t, locale }: { weekly: AthleteDetailProps["weekly"]; t: TFunction; locale: Locale }) {
  const max = Math.max(...weekly.map((w) => w.total_load), 1);
  const peak = weekly.findIndex((w) => w.total_load === max && max > 1);
  const prev = weekly.slice(0, -1);
  const avg = prev.length ? prev.reduce((s, w) => s + w.total_load, 0) / prev.length : 0;
  const scale = 84;
  const labelOf = (iso: string) =>
    new Date(iso + "T00:00:00Z").toLocaleDateString(dateLocale(locale), { day: "numeric", month: "numeric", timeZone: "UTC" });
  return (
    <div className="card">
      <h3 className="mb-5 font-semibold">{t("detail.weekly.title")}</h3>
      <div className="relative">
        <ol className="flex h-24 items-end gap-1" aria-label={t("detail.weekly.aria")}>
          {weekly.map((w, i) => {
            const current = i === weekly.length - 1;
            const text = t(current ? "detail.weekly.weekCurrent" : "detail.weekly.week", { date: labelOf(w.week_start), load: w.total_load });
            return (
              <li key={w.week_start} className="flex h-full min-w-0 flex-1 items-end justify-center">
                <div
                  className="relative w-full max-w-4 rounded-full"
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
                  {(current || i === peak) && w.total_load > 0 && (
                    <span className="num absolute -top-4 left-1/2 -translate-x-1/2 text-[11px]">{w.total_load}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {avg > 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 border-t border-dashed"
            style={{ bottom: `${(avg / max) * scale}%`, borderColor: "var(--accent)" }}
            title={t("detail.weekly.avg", { n: Math.round(avg) })}
          />
        )}
      </div>
      <ol className="mt-2 flex gap-1" aria-hidden>
        {weekly.map((w, i) => (
          <li key={w.week_start} className={`min-w-0 flex-1 whitespace-nowrap text-center text-[9px] ${i === weekly.length - 1 ? "font-semibold" : "text-muted"}`}>
            {i % 2 === (weekly.length - 1) % 2 ? labelOf(w.week_start) : ""}
          </li>
        ))}
      </ol>
      {avg > 0 && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted">
          <span aria-hidden className="w-5 border-t border-dashed" style={{ borderColor: "var(--accent)" }} />
          {t("detail.weekly.avg", { n: Math.round(avg) })}
        </p>
      )}
    </div>
  );
}

function Meter({ value, label, t }: { value: number; label: string; t: TFunction }) {
  return (
    <div className="flex items-center gap-3" role="img" aria-label={t("detail.wellness.item", { item: label, n: value })}>
      <span className="w-20 shrink-0 text-sm text-muted">{label}</span>
      <span className="flex flex-1 gap-1" aria-hidden>
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className="h-2 flex-1 rounded-full"
            style={{ background: n <= value ? "var(--accent)" : "var(--line)" }}
          />
        ))}
      </span>
      <span className="num w-4 text-right text-sm" aria-hidden>{value}</span>
    </div>
  );
}

function Wellness({
  teamId, consent, entries, t, locale,
}: { teamId: string; consent: boolean; entries: AthleteDetailProps["wellness"]; t: TFunction; locale: Locale }) {
  if (!consent) {
    return (
      <div className="card flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full text-muted"
          style={{ boxShadow: "0 0 0 1px var(--line)" }}
        >
          <Lock size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{t("detail.wellness.locked.title")}</h3>
          <p className="mt-1 text-sm text-muted">{t("detail.wellness.locked.body")}</p>
          <Link href={`/team/${teamId}/members`} className="link mt-1 inline-flex min-h-11 items-center text-sm">
            {t("detail.wellness.locked.cta")}
          </Link>
        </div>
      </div>
    );
  }
  if (!entries.length) {
    return (
      <div className="card">
        <h3 className="font-semibold">{t("detail.wellness.title")}</h3>
        <p className="mt-2 text-sm text-muted">{t("detail.wellness.empty")}</p>
      </div>
    );
  }
  const today = entries.find((e) => e.day === todayInTeamZone());
  const avg = entries.reduce((s, e) => s + e.avg, 0) / entries.length;
  const days = [...entries].reverse(); // oldest first for the strip
  const dayLabel = (d: string) =>
    new Date(d + "T00:00:00Z").toLocaleDateString(dateLocale(locale), { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" });
  return (
    <div className="card flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold">{t("detail.wellness.title")}</h3>
        <p className="flex items-baseline gap-2 text-xs text-muted">
          {t("detail.wellness.avg")} <span className="num text-xl text-[var(--foreground)]">{fmt1(avg)}</span>
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        <p className="eyebrow">{t("detail.wellness.today")}</p>
        {today ? (
          <>
            {WELLNESS_ITEMS.map((k) => <Meter key={k} value={today[k]} label={t(ITEM_KEY[k])} t={t} />)}
            {today.pain ? (
              <p className="mt-1 flex items-start gap-2 rounded-xl bg-[var(--danger-bg)] px-3 py-2 text-sm font-medium text-danger">
                <CircleAlert size={16} aria-hidden className="mt-0.5 shrink-0" />
                <span className="min-w-0 break-words">
                  {today.painLocation ? t("detail.wellness.painWhere", { where: today.painLocation }) : t("detail.wellness.pain")}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">{t("detail.wellness.painNone")}</p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">{t("detail.wellness.todayNone")}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="eyebrow">{t("detail.wellness.days")}</p>
        <ol className="flex h-14 items-end gap-1">
          {days.map((e) => {
            const flag = wellnessFlag(e);
            const text = t(e.pain ? "detail.wellness.dayPain" : "detail.wellness.day", { date: dayLabel(e.day), avg: fmt1(e.avg), flag: t(FLAG_KEY[flag]) });
            return (
              <li key={e.day} className="flex h-full min-w-0 flex-1 items-end">
                <div
                  role="img"
                  aria-label={text}
                  title={text}
                  className="w-full rounded-full"
                  style={{ height: `${Math.max((e.avg / 5) * 100, 8)}%`, background: FLAG_COLOR[flag] }}
                />
              </li>
            );
          })}
        </ol>
        {days.some((e) => e.pain) && (
          <>
            <ol className="flex gap-1" aria-hidden>
              {days.map((e) => (
                <li key={e.day} className="flex min-w-0 flex-1 justify-center">
                  {e.pain ? <CircleAlert size={12} className="text-danger" /> : <span className="h-3" />}
                </li>
              ))}
            </ol>
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <CircleAlert size={12} aria-hidden className="text-danger" /> {t("detail.wellness.pain")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export async function AthleteDetail(p: AthleteDetailProps) {
  const { t, locale } = await getT();
  const display = p.name || t("members.unnamed");
  const dateFmt = (iso: string) =>
    new Date(iso).toLocaleDateString(dateLocale(locale), { weekday: "short", day: "numeric", month: "short" });
  const flagged = p.availability.status !== "available";
  const availColor = p.availability.status === "limited" ? "var(--warn)" : p.availability.status === "unavailable" ? "var(--danger)" : "var(--accent)";
  const facts = [
    p.age !== null ? t("detail.age", { n: p.age }) : null,
    p.heightCm ? t("detail.height", { n: p.heightCm }) : null,
    p.weightKg ? t("detail.weight", { n: p.weightKg }) : null,
  ].filter(Boolean) as string[];

  return (
    <section className="stagger flex flex-col gap-5">
      <Link href={`/team/${p.teamId}`} className="link -mb-2 inline-flex min-h-11 items-center gap-1 self-start text-sm">
        <ChevronLeft size={16} aria-hidden /> {t("detail.back")}
      </Link>

      <header className="flex items-start gap-4">
        <Avatar name={display} size={72} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h2 className="display break-words text-2xl">{display}</h2>
          <p className="flex items-center gap-2 text-sm" style={{ color: flagged ? availColor : undefined }}>
            <AvailabilityIcon status={p.availability.status} size={16} />
            <span className="font-medium">{t(AVAILABILITY_KEY[p.availability.status])}</span>
            {p.availability.note && <span className="min-w-0 truncate text-muted">· {p.availability.note}</span>}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <span className="chip">{t(ROLE_KEY.athlete)}</span>
            <span className="chip">
              {p.consent ? <ShieldCheck size={12} aria-hidden className="text-[var(--accent)]" /> : <Lock size={12} aria-hidden />}
              {t(p.consent ? "detail.consent.given" : "detail.consent.none")}
            </span>
            {facts.map((f) => <span key={f} className="chip">{f}</span>)}
          </div>
        </div>
      </header>

      <Hero row={p.row} level={p.level} showRatio={!!p.showRatio} deviation={p.deviation} t={t} />
      <WeeklyBars weekly={p.weekly} t={t} locale={locale} />
      <Wellness teamId={p.teamId} consent={p.consent} entries={p.wellness} t={t} locale={locale} />

      <section className="flex flex-col gap-1" aria-label={t("detail.recent.title")}>
        <p className="eyebrow mb-1 px-1">{t("detail.recent.title")}</p>
        {p.missing > 0 && (
          <p className="mb-1 px-1 text-sm text-[var(--warn)]">
            {p.missing === 1 ? t("detail.recent.missingOne") : t("detail.recent.missing", { n: p.missing })}
          </p>
        )}
        {p.recent.length ? (
          <ul className="card flex flex-col !py-1 text-sm">
            {p.recent.map((l, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[var(--line)] py-2.5 last:border-b-0">
                <span className={`flex min-w-0 items-center gap-2.5 ${l.attended ? "" : "text-muted"}`}>
                  <SessionTypeIcon type={l.type} />
                  <span className="truncate">
                    <span className="text-muted">{dateFmt(l.starts_at)}</span>{" "}
                    {l.title || t(SESSION_TYPE_KEY[l.type])}
                  </span>
                </span>
                {l.attended ? (
                  <span className="chip tabular-nums">
                    {t("detail.recent.calc", { min: l.duration_min, rpe: l.rpe, load: l.load })}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-muted">
                    <Ban size={14} aria-hidden /> {t("detail.recent.absent")}
                  </span>
                )}
                {p.consent && l.note && (
                  <p className="basis-full whitespace-pre-line break-words border-l-2 border-[var(--accent)] pl-2.5 text-xs italic text-muted">
                    “{l.note}”
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-1 text-sm text-muted">{t("detail.recent.empty")}</p>
        )}
      </section>

      <Link href={`/team/${p.teamId}/members`} className="btn inline-flex min-h-12 w-full items-center justify-center gap-2">
        <Pencil size={16} aria-hidden /> {t("detail.edit")}
      </Link>
    </section>
  );
}
