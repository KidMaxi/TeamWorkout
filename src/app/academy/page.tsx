import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getT } from "@/lib/auth-cache";
import { dateLocale } from "@/lib/i18n";
import { AcademyBoard } from "@/components/AcademyBoard";
import { currentWeekStart, dailyTotals, kpis, normalizeDays, parseWeekParam, weekNav, type AcademyRow, type FitRow } from "@/lib/academy";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Search = { club?: string | string[]; week?: string | string[] };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AcademyPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const user = await getAuthUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  // Clubs of the user: where they are staff of a team, plus clubs they administer.
  const [{ t, locale }, { data: staffRows }, { data: adminRows }] = await Promise.all([
    getT(),
    supabase.from("team_members").select("teams(club_id, clubs(name))").eq("user_id", user.id).eq("role", "staff"),
    supabase.from("club_admins").select("club_id, clubs(name)").eq("user_id", user.id),
  ]);
  const clubs = new Map<string, string>();
  for (const r of staffRows ?? []) {
    const team = r.teams as unknown as { club_id: string | null; clubs: { name: string } | null } | null;
    if (team?.club_id) clubs.set(team.club_id, team.clubs?.name ?? "");
  }
  for (const r of adminRows ?? []) {
    const c = r.clubs as unknown as { name: string } | null;
    if (!clubs.get(r.club_id)) clubs.set(r.club_id, c?.name ?? "");
  }
  if (clubs.size === 0) redirect("/");

  const wanted = first(sp.club);
  const clubId = wanted && UUID.test(wanted) && clubs.has(wanted) ? wanted : [...clubs.keys()][0];
  const weekStart = parseWeekParam(sp.week) ?? currentWeekStart();

  const [{ data, error }, { data: fitData }, { data: clubRow }] = await Promise.all([
    supabase.rpc("academy_week_matrix", { _club: clubId, _week_start: weekStart }),
    supabase.rpc("academy_fit_status", { _club: clubId }),
    supabase.from("clubs").select("name").eq("id", clubId).maybeSingle(),
  ]);
  if (error) throw new Error(error.message);
  const rows: AcademyRow[] = ((data ?? []) as AcademyRow[]).map((r) => ({ ...r, day_au: normalizeDays(r.day_au) }));
  // Fit status is an add-on: if it fails the load overview still renders.
  const fit = ((fitData ?? []) as FitRow[]);
  const clubName = clubRow?.name || clubs.get(clubId) || "";

  const loc = dateLocale(locale);
  const nav = weekNav(weekStart);
  const k = kpis(rows);
  const daily = dailyTotals(rows);
  const maxDay = Math.max(1, ...daily);
  const dayFmt = (ymd: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(loc, { timeZone: "UTC", ...o }).format(new Date(`${ymd}T00:00:00Z`));
  const dayLabels = nav.days.map((d) => dayFmt(d, { weekday: "short" }).replace(".", "").slice(0, 2));
  const range = `${dayFmt(nav.start, { day: "numeric", month: "short" })} – ${dayFmt(nav.end, { day: "numeric", month: "short", year: "numeric" })}`;
  const href = (week: string, club = clubId) => `/academy?club=${club}&week=${week}`;
  const fmt = (n: number) => n.toLocaleString(loc);
  const linkCls = "glass inline-flex min-h-11 items-center justify-center gap-1 rounded-full px-4 text-sm transition-colors hover:text-[var(--foreground)]";

  const kpiCards = [
    { label: t("academy.kpi.players"), value: k.players, hero: false },
    { label: t("academy.kpi.load"), value: k.weekAu, unit: t("academy.unit.au"), hero: true },
    { label: t("academy.kpi.sessions"), value: k.sessions, hero: false },
    { label: t("academy.kpi.gym"), value: k.gymSessions, hero: false },
  ];

  return (
    <main className="stagger mx-auto flex min-h-dvh max-w-5xl flex-col gap-5 px-4 pb-10 pt-4 sm:px-6">
      <header className="flex flex-col gap-1">
        <Link href="/?all" className="inline-flex min-h-11 w-fit items-center gap-1 text-sm text-muted hover:text-[var(--foreground)]">
          <ChevronLeft size={16} aria-hidden />{t("common.nav.teams")}
        </Link>
        <p className="eyebrow">{t("academy.eyebrow")}{clubName ? ` · ${clubName}` : ""}</p>
        <h1 className="display text-4xl sm:text-5xl">{t("academy.title")}</h1>
      </header>

      {clubs.size > 1 && (
        <nav aria-label={t("academy.club.pick")} className="flex flex-wrap gap-2">
          {[...clubs].map(([id, name]) => (
            <Link key={id} href={href(nav.start, id)} aria-current={id === clubId ? "page" : undefined}
              className={`chip min-h-11 px-3.5 text-sm ${id === clubId ? "!border-[var(--accent)] !text-[var(--foreground)]" : ""}`}>
              {name || id.slice(0, 8)}
            </Link>
          ))}
        </nav>
      )}

      <nav aria-label={t("academy.week.nav")} className="flex flex-wrap items-center gap-2">
        <Link href={href(nav.prev)} className={linkCls}><ChevronLeft size={16} aria-hidden />{t("academy.week.prev")}</Link>
        <Link href={href(nav.thisWeek)} aria-current={nav.isCurrent ? "date" : undefined}
          className={`${linkCls} ${nav.isCurrent ? "!border-[var(--accent)]" : ""}`}>{t("academy.week.this")}</Link>
        <Link href={href(nav.next)} className={linkCls}>{t("academy.week.next")}<ChevronRight size={16} aria-hidden /></Link>
        <p className="ml-auto text-sm text-muted">{range}</p>
      </nav>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpiCards.map((c) => (
          <div key={c.label} className={`card flex flex-col gap-2 ${c.hero ? "card-hero" : ""}`}>
            <span className="eyebrow">{c.label}</span>
            <span className="num text-4xl">{fmt(c.value)}{c.unit && <span className="ml-1 text-sm font-normal text-muted">{c.unit}</span>}</span>
          </div>
        ))}
      </section>

      <section className="card flex flex-col gap-3" aria-labelledby="daily-title">
        <h2 id="daily-title" className="display text-lg">{t("academy.chart.title")}</h2>
        <div role="img" aria-label={`${t("academy.chart.aria")}: ${daily.map((v, i) => `${dayLabels[i]} ${v}`).join(", ")}`} className="grid grid-cols-7 gap-2 sm:gap-4">
          {daily.map((v, i) => {
            const today = i === nav.todayIndex;
            return (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span className={`text-xs tabular-nums sm:text-sm ${today ? "font-semibold text-[var(--accent)]" : "text-muted"}`}>{fmt(v)}</span>
                <div className="flex h-32 w-full items-end rounded-lg bg-[var(--surface-2)] sm:h-40">
                  <div className="w-full rounded-lg"
                    style={{ height: `${v > 0 ? Math.max(4, Math.round((v / maxDay) * 100)) : 0}%`, background: today ? "var(--accent)" : "color-mix(in srgb, var(--accent) 40%, var(--muted))" }} />
                </div>
                <span className={`eyebrow ${today ? "" : "!text-[var(--muted)]"}`}>{dayLabels[i]}</span>
              </div>
            );
          })}
        </div>
      </section>

      <AcademyBoard rows={rows} fit={fit} dayLabels={dayLabels} todayIndex={nav.todayIndex} />

      <p className="text-xs text-muted">{t("academy.note")}</p>
    </main>
  );
}
