import Link from "next/link";
import {
  applyFilter,
  AVAILABILITY,
  sortByRisk,
  type AthleteRow,
  type DashboardFilter,
  type WeekTrendRow,
} from "@/lib/load";

const LEVEL = {
  none: { label: "Geen baseline", cls: "badge badge-none" },
  out: { label: "Niet beschikbaar", cls: "badge badge-none" },
  ok: { label: "Normaal", cls: "badge badge-ok" },
  watch: { label: "Let op", cls: "badge badge-watch" },
  high: { label: "Hoog", cls: "badge badge-high" },
};

const FILTERS: { key: DashboardFilter; label: string }[] = [
  { key: "all", label: "Iedereen" },
  { key: "alerts", label: "Waarschuwingen" },
  { key: "unavailable", label: "Beperkt / uit" },
  { key: "missing", label: "Mist RPE" },
];

function Tile({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: "danger" | "warn" }) {
  const color = tone === "danger" ? "text-danger" : tone === "warn" ? "text-[var(--warn)]" : "";
  return (
    <div className="card">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

function TrendChart({ weeks }: { weeks: WeekTrendRow[] }) {
  const max = Math.max(...weeks.map((w) => w.total_load), 1);
  return (
    <div className="card">
      <div className="mb-3">
        <h3 className="font-semibold">Teamload per week</h3>
        <p className="text-xs text-muted">RPE &times; minuten, alle atleten samen</p>
      </div>
      <ol className="flex h-36 items-end gap-2" aria-label="Teamload per week">
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
                title={`Week van ${d.toLocaleDateString("nl-NL")}: ${w.total_load} (${w.athletes_logged} atleten)`}
              />
              <span className="text-[10px] text-muted">{d.toLocaleDateString("nl-NL", { day: "numeric", month: "numeric" })}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function AthleteCard({ r }: { r: AthleteRow }) {
  const lvl = LEVEL[r.level];
  const avail = r.availability ?? "available";
  const pct = r.max_weekly_load ? Math.min((r.acute_load / r.max_weekly_load) * 100, 100) : null;
  return (
    <li className="card flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{r.full_name || "Naamloos"}</p>
          <p className="text-xs text-muted">
            {AVAILABILITY[avail]}
            {r.availability_note ? ` · ${r.availability_note}` : ""}
            {r.missing > 0 ? ` · ${r.missing} RPE ontbreekt` : ""}
          </p>
        </div>
        <span className={lvl.cls}>{r.level !== "out" && r.acwr !== null ? `${r.acwr} ` : ""}{lvl.label}</span>
      </div>
      <div className="flex gap-6 text-sm">
        <div><p className="text-xs text-muted">Acuut (7d)</p><p className={`font-semibold tabular-nums ${r.over_limit ? "text-danger" : ""}`}>{r.acute_load}</p></div>
        <div><p className="text-xs text-muted">Gem. per week (28d)</p><p className="font-semibold tabular-nums">{r.chronic_weekly_avg}</p></div>
        {r.max_weekly_load && <div><p className="text-xs text-muted">Limiet</p><p className="font-semibold tabular-nums">{r.max_weekly_load}</p></div>}
      </div>
      {pct !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]" role="img" aria-label={`${Math.round(pct)}% van weeklimiet`}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.over_limit ? "var(--danger)" : "var(--primary)" }} />
        </div>
      )}
    </li>
  );
}

export function StaffDashboard({
  teamId, rows, weeks, filter,
}: { teamId: string; rows: AthleteRow[]; weeks: WeekTrendRow[]; filter: DashboardFilter }) {
  const alerts = rows.filter((r) => r.level === "high" || r.level === "watch").length;
  const high = rows.filter((r) => r.level === "high").length;
  const available = rows.filter((r) => (r.availability ?? "available") === "available").length;
  const missing = rows.reduce((s, r) => s + r.missing, 0);
  const thisWeek = weeks.at(-1)?.total_load ?? 0;
  const visible = sortByRisk(applyFilter(rows, filter));

  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Load deze week" value={thisWeek} sub="vanaf maandag" />
        <Tile label="Waarschuwingen" value={alerts} sub={high ? `${high} hoog` : "geen hoog"} tone={high ? "danger" : alerts ? "warn" : undefined} />
        <Tile label="Beschikbaar" value={`${available}/${rows.length}`} />
        <Tile label="Ontbrekende RPE" value={missing} sub="laatste 14 dagen" tone={missing ? "warn" : undefined} />
      </div>

      <TrendChart weeks={weeks} />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter atleten">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? `/team/${teamId}` : `/team/${teamId}?filter=${f.key}`}
            aria-current={filter === f.key ? "page" : undefined}
            className={`tab border ${filter === f.key ? "!bg-[var(--primary)] !text-[var(--on-primary)]" : ""}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {visible.map((r) => <AthleteCard key={r.user_id} r={r} />)}
      </ul>
      {!visible.length && (
        <p className="text-muted">{rows.length ? "Geen atleten voor dit filter." : "Nog geen atleten. Maak een uitnodiging bij Leden."}</p>
      )}
      <p className="text-xs text-muted">
        Ratio = acute load (7d) / gemiddelde weekload over 28 dagen, pas na 28 dagen data. Een indicatie, geen blessurevoorspelling.
        Boven 1,5 of boven de eigen weeklimiet telt als hoog; 1,3&ndash;1,5 en onder 0,8 als let op.
      </p>
    </section>
  );
}
