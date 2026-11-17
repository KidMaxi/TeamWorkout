"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { dateLocale, type MessageKey } from "@/lib/i18n";
import { byJerseyThenName, isPosition, playerLabel } from "@/lib/positions";
import { avgRound, normalizeDays, type AcademyRow } from "@/lib/academy";

type SortKey = "week" | "name" | "number";
type Player = AcademyRow & { name: string };

const fmt = (n: number, loc: string) => n.toLocaleString(loc);

/** Search, team filter and sort for the academy week; one section per team with a table (>=640px) or compact cards (phones). */
export function AcademyBoard({ rows, dayLabels, todayIndex }: { rows: AcademyRow[]; dayLabels: string[]; todayIndex: number }) {
  const { t, locale } = useT();
  const loc = dateLocale(locale);
  const [q, setQ] = useState("");
  const [team, setTeam] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("week");

  const teams = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) m.set(r.team_id, r.team_name);
    return [...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, loc));
  }, [rows, loc]);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const cmp = (a: Player, b: Player) =>
      sort === "name" ? a.name.localeCompare(b.name, loc)
      : sort === "number" ? byJerseyThenName({ jersey: a.jersey_number, name: a.name }, { jersey: b.jersey_number, name: b.name })
      : b.week_au - a.week_au || a.name.localeCompare(b.name, loc);
    return teams
      .filter((tm) => team === null || tm.id === team)
      .map((tm) => {
        const all = rows.filter((r) => r.team_id === tm.id);
        const total = all.reduce((s, r) => s + r.week_au, 0);
        const players: Player[] = all
          .map((r) => ({ ...r, name: r.full_name?.trim() || "—", day_au: normalizeDays(r.day_au) }))
          .filter((p) => !needle || p.name.toLowerCase().includes(needle))
          .sort(cmp);
        return { ...tm, count: all.length, total, avg: avgRound(total, all.length), players };
      })
      .filter((g) => g.players.length > 0);
  }, [rows, teams, q, team, sort, loc]);

  if (rows.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-2 py-10 text-center">
        <Users size={28} aria-hidden className="text-[var(--accent)]" />
        <p className="display text-lg">{t("academy.empty.title")}</p>
        <p className="max-w-sm text-sm text-muted">{t("academy.empty.hint")}</p>
      </div>
    );
  }

  const chip = (active: boolean) =>
    `chip min-h-11 cursor-pointer px-3.5 text-sm transition-colors ${active ? "!border-[var(--accent)] !text-[var(--foreground)]" : ""}`;
  const posText = (p: Player) => {
    const pos = isPosition(p.position) ? t(`members.pos.${p.position}` as MessageKey) : null;
    return playerLabel(null, pos);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder={t("academy.search")} aria-label={t("academy.search")} className="input min-h-11 w-full pl-10"
            />
          </div>
          <label className="flex items-center gap-2">
            <span className="eyebrow">{t("academy.sort.label")}</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="input min-h-11">
              <option value="week">{t("academy.sort.week")}</option>
              <option value="name">{t("academy.sort.name")}</option>
              <option value="number">{t("academy.sort.number")}</option>
            </select>
          </label>
        </div>
        {teams.length > 1 && (
          <div role="group" aria-label={t("academy.filter.teams")} className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={team === null} onClick={() => setTeam(null)} className={chip(team === null)}>{t("academy.filter.all")}</button>
            {teams.map((tm) => (
              <button key={tm.id} type="button" aria-pressed={team === tm.id} onClick={() => setTeam(tm.id)} className={chip(team === tm.id)}>{tm.name}</button>
            ))}
          </div>
        )}
      </div>

      {groups.length === 0 && <p className="card text-center text-sm text-muted">{t("academy.noMatch")}</p>}

      {groups.map((g) => (
        <section key={g.id} aria-labelledby={`team-${g.id}`} className="card flex flex-col gap-3 !px-3 sm:!px-5">
          <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id={`team-${g.id}`} className="display text-xl">{g.name}</h2>
            <p className="flex flex-wrap gap-x-3 text-sm text-muted">
              <span>{t("academy.team.players", { n: g.count })}</span>
              <span className="tabular-nums">{t("academy.team.total", { n: fmt(g.total, loc) })}</span>
              <span>{t("academy.team.avg", { n: fmt(g.avg, loc) })}</span>
            </p>
          </header>

          <ul className="flex flex-col gap-2 sm:hidden">
            {g.players.map((p) => {
              const max = Math.max(1, ...p.day_au);
              return (
                <li key={p.user_id} className="rounded-xl border border-[var(--line)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {p.jersey_number != null && <span className="mr-1.5 text-muted">#{p.jersey_number}</span>}{p.name}
                      </p>
                      {posText(p) && <p className="truncate text-xs text-muted">{posText(p)}</p>}
                    </div>
                    <p className="num shrink-0 text-2xl">{fmt(p.week_au, loc)}<span className="ml-1 text-xs font-normal text-muted">{t("academy.unit.au")}</span></p>
                  </div>
                  <div className="mt-2 grid grid-cols-7 gap-1" role="img" aria-label={p.day_au.map((v, i) => `${dayLabels[i]} ${v}`).join(", ")}>
                    {p.day_au.map((v, i) => (
                      <div key={i} className="flex flex-col items-center gap-0.5">
                        <div className="flex h-8 w-full items-end rounded bg-[var(--surface-2)]">
                          <div
                            className="w-full rounded"
                            style={{ height: `${v > 0 ? Math.max(12, Math.round((v / max) * 100)) : 0}%`, background: i === todayIndex ? "var(--accent)" : "color-mix(in srgb, var(--accent) 55%, var(--muted))" }}
                          />
                        </div>
                        <span className="text-[0.6rem] text-muted">{dayLabels[i]}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {t("academy.player.sessions", { n: p.sessions })} · {t("academy.col.own")} {fmt(p.avg_28d, loc)} {t("academy.unit.au")}
                  </p>
                </li>
              );
            })}
          </ul>

          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead>
                <tr className="text-left">
                  <th scope="col" className="eyebrow w-12 py-2 pr-2 font-semibold">{t("academy.col.number")}</th>
                  <th scope="col" className="eyebrow py-2 pr-2 font-semibold">{t("academy.col.player")}</th>
                  {dayLabels.map((d, i) => (
                    <th key={i} scope="col" className={`eyebrow px-1.5 py-2 text-right font-semibold ${i === todayIndex ? "!text-[var(--accent)]" : ""}`}>{d}</th>
                  ))}
                  <th scope="col" className="eyebrow px-2 py-2 text-right font-semibold">{t("academy.col.week")}</th>
                  <th scope="col" className="eyebrow px-2 py-2 text-right font-semibold">{t("academy.col.sessions")}</th>
                  <th scope="col" title={t("academy.col.ownHint")} className="eyebrow py-2 pl-2 text-right font-semibold">{t("academy.col.own")}</th>
                </tr>
              </thead>
              <tbody>
                {g.players.map((p) => (
                  <tr key={p.user_id} className="min-h-11 border-t border-[var(--line)]">
                    <td className="py-2.5 pr-2 tabular-nums text-muted">{p.jersey_number ?? ""}</td>
                    <td className="py-2.5 pr-2">
                      <span className="block font-medium">{p.name}</span>
                      {posText(p) && <span className="block text-xs text-muted">{posText(p)}</span>}
                    </td>
                    {p.day_au.map((v, i) => (
                      <td key={i} className={`px-1.5 py-2.5 text-right tabular-nums ${v === 0 ? "text-muted opacity-60" : ""}`}>{fmt(v, loc)}</td>
                    ))}
                    <td className="num px-2 py-2.5 text-right text-lg">{fmt(p.week_au, loc)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{p.sessions}</td>
                    <td className="py-2.5 pl-2 text-right tabular-nums text-muted">{fmt(p.avg_28d, loc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
