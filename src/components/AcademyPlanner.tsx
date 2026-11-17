"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { SESSION_TYPE_KEY, type MessageKey } from "@/lib/i18n";
import { GROUP_COLOR, TYPE_GROUPS, colorOf, filterItems, groupByDay, totalAu, type PlanItem, type TypeGroup } from "@/lib/academy-plan";

export type PlanDay = { ymd: string; weekday: string; num: string; long: string };
export type PlanTeam = { id: string; name: string };

const GROUP_KEY: Record<TypeGroup, MessageKey> = {
  basketball: "acplan.legend.basketball",
  gym: "acplan.legend.gym",
  match: "acplan.legend.match",
};

function toggle<T>(set: ReadonlySet<T>, v: T): Set<T> {
  const n = new Set(set);
  if (n.has(v)) n.delete(v);
  else n.add(v);
  return n;
}

function SessionCard({ s, day }: { s: PlanItem; day: string }) {
  const { t } = useT();
  const cancelled = s.status === "cancelled";
  const known = s.type in SESSION_TYPE_KEY;
  const name = s.title || (known ? t(SESSION_TYPE_KEY[s.type as keyof typeof SESSION_TYPE_KEY]) : t("acplan.untitled"));
  return (
    <Link
      href={`/team/${s.teamId}/sessions/calendar?view=day&date=${day}`}
      className={`card flex min-h-11 flex-col gap-1 !p-3 text-sm transition-colors hover:border-[var(--accent)] ${cancelled ? "opacity-60" : ""}`}
      style={{ borderLeft: `4px solid ${colorOf(s.type)}` }}
    >
      <span className="num text-xs text-muted">
        {s.time}{s.durationMin ? ` · ${t("acplan.min", { n: s.durationMin })}` : ""}
      </span>
      <span className={`font-medium leading-snug ${cancelled ? "line-through" : ""}`}>{name}</span>
      <span className="text-xs text-muted">{s.teamName}</span>
      <span className="text-xs text-muted">
        {cancelled ? t("acplan.cancelled") : s.au !== null ? t("acplan.planned", { n: s.au }) : t("acplan.plannedNoAu")}
      </span>
    </Link>
  );
}

export function AcademyPlanner({ items, days, today, defaultDay, teams }: {
  items: PlanItem[]; days: PlanDay[]; today: string; defaultDay: string; teams: PlanTeam[];
}) {
  const { t } = useT();
  const [view, setView] = useState<"week" | "day">("week");
  const [day, setDay] = useState(defaultDay);
  const [teamSel, setTeamSel] = useState<ReadonlySet<string>>(new Set());
  const [typeSel, setTypeSel] = useState<ReadonlySet<TypeGroup>>(new Set());

  const ymds = useMemo(() => days.map((d) => d.ymd), [days]);
  const grouped = useMemo(() => groupByDay(filterItems(items, teamSel, typeSel), ymds), [items, teamSel, typeSel, ymds]);
  const anyItems = items.length > 0;
  const anyShown = ymds.some((d) => grouped[d].length > 0);
  const chip = (on: boolean) => `chip min-h-11 px-3.5 text-sm ${on ? "!border-[var(--accent)] !bg-[var(--accent-soft)] !text-[var(--primary)]" : ""}`;

  const dayBlock = (d: PlanDay, withHeader: boolean) => {
    const list = grouped[d.ymd];
    const isToday = d.ymd === today;
    return (
      <div key={d.ymd} className="flex min-w-0 flex-col gap-2" aria-label={d.long}>
        {withHeader && (
          <div className={`flex items-baseline justify-between gap-2 ${isToday ? "text-[var(--accent)]" : ""}`}>
            <span className="eyebrow !text-inherit">{d.weekday}</span>
            <span className="num text-lg">{d.num}</span>
          </div>
        )}
        {list.length === 0 ? (
          <p className="rounded-md border border-dashed px-2 py-3 text-center text-xs text-muted">–</p>
        ) : list.map((s) => <SessionCard key={s.id} s={s} day={d.ymd} />)}
      </div>
    );
  };

  const current = days.find((d) => d.ymd === day) ?? days[0];

  return (
    <section className="flex flex-col gap-4" aria-label={t("acplan.title")}>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t("acplan.view.label")} className="glass flex w-fit gap-1 rounded-md p-1">
          {(["week", "day"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`inline-flex min-h-11 items-center rounded-md px-4 text-sm font-medium transition-colors ${view === v ? "bg-[var(--accent-soft)] text-[var(--primary)]" : "text-muted hover:text-[var(--foreground)]"}`}>
              {t(v === "week" ? "acplan.view.week" : "acplan.view.day")}
            </button>
          ))}
        </div>
        <ul className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-label={t("acplan.legend.label")}>
          {TYPE_GROUPS.map((g) => (
            <li key={g} className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-sm" style={{ background: GROUP_COLOR[g] }} />{t(GROUP_KEY[g])}
            </li>
          ))}
        </ul>
      </div>

      {(teams.length > 1 || anyItems) && (
        <div className="flex flex-col gap-2">
          {teams.length > 1 && (
            <div role="group" aria-label={t("acplan.filter.teams")} className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={teamSel.size === 0} onClick={() => setTeamSel(new Set())} className={chip(teamSel.size === 0)}>{t("acplan.filter.all")}</button>
              {teams.map((tm) => (
                <button key={tm.id} type="button" aria-pressed={teamSel.has(tm.id)} onClick={() => setTeamSel(toggle(teamSel, tm.id))} className={chip(teamSel.has(tm.id))}>{tm.name}</button>
              ))}
            </div>
          )}
          <div role="group" aria-label={t("acplan.filter.types")} className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={typeSel.size === 0} onClick={() => setTypeSel(new Set())} className={chip(typeSel.size === 0)}>{t("acplan.filter.all")}</button>
            {TYPE_GROUPS.map((g) => (
              <button key={g} type="button" aria-pressed={typeSel.has(g)} onClick={() => setTypeSel(toggle(typeSel, g))} className={chip(typeSel.has(g))}>
                <span aria-hidden className="mr-1.5 inline-block size-2.5 rounded-sm" style={{ background: GROUP_COLOR[g] }} />{t(GROUP_KEY[g])}
              </button>
            ))}
          </div>
        </div>
      )}

      {view === "week" ? (
        !anyShown ? (
          <p className="card text-sm text-muted">{anyItems ? t("acplan.empty.filter") : t("acplan.empty.week")}</p>
        ) : (
          <>
            {/* Small screens: stacked day list, days without sessions are skipped */}
            <div className="flex flex-col gap-4 lg:hidden">
              {days.filter((d) => grouped[d.ymd].length > 0).map((d) => (
                <div key={d.ymd} className="flex flex-col gap-2">
                  <h3 className={`eyebrow ${d.ymd === today ? "!text-[var(--accent)]" : ""}`}>{d.long}{d.ymd === today ? ` · ${t("acplan.today")}` : ""}</h3>
                  {grouped[d.ymd].map((s) => <SessionCard key={s.id} s={s} day={d.ymd} />)}
                </div>
              ))}
            </div>
            {/* Desktop: 7 columns */}
            <div className="hidden grid-cols-7 gap-2 lg:grid">{days.map((d) => dayBlock(d, true))}</div>
          </>
        )
      ) : (
        <div className="flex flex-col gap-3">
          <div role="group" aria-label={t("acplan.day.pick")} className="grid grid-cols-7 gap-1.5">
            {days.map((d) => (
              <button key={d.ymd} type="button" aria-pressed={d.ymd === current.ymd} onClick={() => setDay(d.ymd)}
                className={`chip min-h-11 flex-col !px-0 text-xs ${d.ymd === current.ymd ? "!border-[var(--accent)] !bg-[var(--accent-soft)] !text-[var(--primary)]" : ""} ${d.ymd === today ? "font-semibold" : ""}`}>
                <span>{d.weekday}</span><span className="num">{d.num}</span>
              </button>
            ))}
          </div>
          <h3 className="display text-xl">{current.long}</h3>
          {grouped[current.ymd].length === 0 ? (
            <p className="card text-sm text-muted">{anyItems && !anyShown ? t("acplan.empty.filter") : t("acplan.empty.day")}</p>
          ) : (
            <>
              <p className="text-xs text-muted">{t("acplan.day.total", { n: totalAu(grouped[current.ymd]) })}</p>
              <div className="flex flex-col gap-2">{grouped[current.ymd].map((s) => <SessionCard key={s.id} s={s} day={current.ymd} />)}</div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
