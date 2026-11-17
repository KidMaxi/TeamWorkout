import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getT } from "@/lib/auth-cache";
import { SESSION_TYPE_KEY, dateLocale } from "@/lib/i18n";
import { currentWeekStart, normalizeDays, parseWeekParam, weekNav, type AcademyRow } from "@/lib/academy";
import { pickChild, possessive } from "@/lib/parent";
import { isPosition, playerLabel } from "@/lib/positions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { removeParentLink } from "./actions";
import { ParentHeader } from "./ParentHeader";

type Search = { child?: string | string[]; week?: string | string[] };
type Child = { id: string; name: string };
type Membership = { user_id: string; jersey_number: number | null; position: string | null; teams: { id: string; name: string } | null };
type PlannedSession = { id: string; team_id: string; title: string | null; type: string; starts_at: string; planned_duration_min: number | null };

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" });
const amsterdamDay = (iso: string): string => {
  const p = dayKey.formatToParts(new Date(iso));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}`;
};
const shiftDay = (ymd: string, n: number): string => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export default async function ParentPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const user = await getAuthUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const { t, locale } = await getT();

  const { data: links } = await supabase.from("parent_links").select("child_user").eq("parent_user", user.id);
  const childIds = [...new Set((links ?? []).map((l) => l.child_user as string))];
  if (childIds.length === 0) redirect("/parent/join");

  const [{ data: profs }, { data: mems }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("id", childIds),
    supabase.from("team_members").select("user_id, jersey_number, position, teams(id, name)").eq("role", "athlete").in("user_id", childIds),
  ]);
  const nameOf = new Map((profs ?? []).map((p) => [p.id as string, (p.full_name as string | null)?.trim() || t("parent.unnamed")]));
  const children: Child[] = childIds.map((id) => ({ id, name: nameOf.get(id) ?? t("parent.unnamed") })).sort((a, b) => a.name.localeCompare(b.name));
  const child = pickChild(children, sp.child)!;
  const memberships = ((mems ?? []) as unknown as Membership[]).filter((m) => m.user_id === child.id && m.teams);
  const teamIds = memberships.map((m) => m.teams!.id);

  const weekStart = parseWeekParam(sp.week) ?? currentWeekStart();
  const nav = weekNav(weekStart);

  const [{ data: weekRows }, { data: sess }] = await Promise.all([
    supabase.rpc("athlete_week", { _user: child.id, _week_start: nav.start }),
    teamIds.length
      ? supabase.from("sessions").select("id, team_id, title, type, starts_at, planned_duration_min")
          .in("team_id", teamIds).neq("status", "cancelled")
          .gte("starts_at", `${shiftDay(nav.start, -1)}T00:00:00Z`).lt("starts_at", `${shiftDay(nav.end, 2)}T00:00:00Z`).order("starts_at")
      : Promise.resolve({ data: [] }),
  ]);

  const rows = (weekRows ?? []) as AcademyRow[];
  const daily = Array.from({ length: 7 }, (_, i) => rows.reduce((s, r) => s + normalizeDays(r.day_au)[i], 0));
  const weekAu = rows.reduce((s, r) => s + (Number(r.week_au) || 0), 0);
  const logged = rows.reduce((s, r) => s + (Number(r.sessions) || 0), 0);
  const gym = rows.reduce((s, r) => s + (Number(r.gym_sessions) || 0), 0);
  const maxDay = Math.max(1, ...daily);

  const loc = dateLocale(locale);
  const dayFmt = (ymd: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(loc, { timeZone: "UTC", ...o }).format(new Date(`${ymd}T00:00:00Z`));
  const timeFmt = new Intl.DateTimeFormat(loc, { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" });
  const dayLabels = nav.days.map((d) => dayFmt(d, { weekday: "short" }).replace(".", "").slice(0, 2));
  const range = `${dayFmt(nav.start, { day: "numeric", month: "short" })} – ${dayFmt(nav.end, { day: "numeric", month: "short", year: "numeric" })}`;
  const href = (week: string, c = child.id) => `/parent?child=${c}&week=${week}`;
  const fmt = (n: number) => n.toLocaleString(loc);
  const linkCls = "glass inline-flex min-h-11 items-center justify-center gap-1 rounded-full px-4 text-sm transition-colors hover:text-[var(--foreground)]";

  const planned = ((sess ?? []) as PlannedSession[]).map((s) => ({ ...s, day: amsterdamDay(s.starts_at) }));
  const typeKey = (ty: string) => (ty in SESSION_TYPE_KEY ? SESSION_TYPE_KEY[ty as keyof typeof SESSION_TYPE_KEY] : SESSION_TYPE_KEY.other);
  const first = memberships[0];
  const sub = [
    memberships.map((m) => m.teams!.name).join(", "),
    first ? playerLabel(first.jersey_number, isPosition(first.position) ? t(`members.pos.${first.position}`) : null) : "",
  ].filter(Boolean).join(" · ");

  const kpiCards = [
    { label: t("parent.kpi.load"), value: weekAu, unit: t("parent.unit.au"), hero: true },
    { label: t("parent.kpi.sessions"), value: logged, hero: false },
    { label: t("parent.kpi.gym"), value: gym, hero: false },
  ];

  return (
    <main className="stagger mx-auto flex min-h-dvh max-w-lg flex-col gap-5 px-4 pb-10 pt-4 sm:px-6">
      <ParentHeader />

      {children.length > 1 && (
        <nav aria-label={t("parent.child.pick")} className="flex flex-wrap gap-2">
          {children.map((c) => (
            <Link key={c.id} href={href(nav.start, c.id)} aria-current={c.id === child.id ? "page" : undefined}
              className={`chip min-h-11 px-3.5 text-sm ${c.id === child.id ? "!border-[var(--accent)] !text-[var(--foreground)]" : ""}`}>
              {c.name}
            </Link>
          ))}
        </nav>
      )}

      <div className="flex flex-col gap-1">
        <p className="eyebrow">{t("parent.eyebrow")}{sub ? ` · ${sub}` : ""}</p>
        <h1 className="display text-4xl">{t("parent.weekTitle", { name: possessive(child.name, locale) })}</h1>
      </div>

      <nav aria-label={t("parent.week.nav")} className="flex flex-wrap items-center gap-2">
        <Link href={href(nav.prev)} className={linkCls}><ChevronLeft size={16} aria-hidden />{t("parent.week.prev")}</Link>
        <Link href={href(nav.thisWeek)} aria-current={nav.isCurrent ? "date" : undefined}
          className={`${linkCls} ${nav.isCurrent ? "!border-[var(--accent)]" : ""}`}>{t("parent.week.this")}</Link>
        <Link href={href(nav.next)} className={linkCls}>{t("parent.week.next")}<ChevronRight size={16} aria-hidden /></Link>
        <p className="w-full text-sm text-muted">{range}</p>
      </nav>

      <section className="grid grid-cols-2 gap-3">
        {kpiCards.map((c) => (
          <div key={c.label} className={`card flex flex-col gap-2 ${c.hero ? "card-hero col-span-2" : ""}`}>
            <span className="eyebrow">{c.label}</span>
            <span className="num text-4xl">{fmt(c.value)}{c.unit && <span className="ml-1 text-sm font-normal text-muted">{c.unit}</span>}</span>
          </div>
        ))}
      </section>

      <section className="card flex flex-col gap-3" aria-labelledby="daily-title">
        <h2 id="daily-title" className="display text-lg">{t("parent.chart.title")}</h2>
        <div role="img" aria-label={`${t("parent.chart.aria")}: ${daily.map((v, i) => `${dayLabels[i]} ${v}`).join(", ")}`} className="grid grid-cols-7 gap-2">
          {daily.map((v, i) => {
            const today = i === nav.todayIndex;
            return (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span className={`text-xs tabular-nums ${today ? "font-semibold text-[var(--accent)]" : "text-muted"}`}>{fmt(v)}</span>
                <div className="flex h-28 w-full items-end rounded-lg bg-[var(--surface-2)]">
                  <div className="w-full rounded-lg"
                    style={{ height: `${v > 0 ? Math.max(4, Math.round((v / maxDay) * 100)) : 0}%`, background: today ? "var(--accent)" : "color-mix(in srgb, var(--accent) 40%, var(--muted))" }} />
                </div>
                <span className={`eyebrow ${today ? "" : "!text-[var(--muted)]"}`}>{dayLabels[i]}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card flex flex-col gap-3" aria-labelledby="plan-title">
        <h2 id="plan-title" className="display text-lg">{t("parent.plan.title")}</h2>
        {planned.some((s) => nav.days.includes(s.day)) ? (
          <ul className="flex flex-col gap-3">
            {nav.days.map((d, i) => {
              const list = planned.filter((s) => s.day === d);
              if (!list.length) return null;
              return (
                <li key={d} className="flex flex-col gap-2">
                  <span className={`eyebrow ${i === nav.todayIndex ? "!text-[var(--accent)]" : ""}`}>
                    {dayFmt(d, { weekday: "long", day: "numeric", month: "short" })}{i === nav.todayIndex ? ` · ${t("parent.plan.today")}` : ""}
                  </span>
                  <ul className="flex flex-col gap-2">
                    {list.map((s) => (
                      <li key={s.id} className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm" style={{ background: "var(--surface-2)" }}>
                        <span className="num shrink-0">{timeFmt.format(new Date(s.starts_at))}</span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate font-semibold">{s.title || t(typeKey(s.type))}</span>
                          <span className="text-xs text-muted">
                            {t(typeKey(s.type))}{s.planned_duration_min ? ` · ${t("parent.plan.min", { n: s.planned_duration_min })}` : ""}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t("parent.plan.empty")}</p>
        )}
      </section>

      <p className="text-xs text-muted">{t("parent.readOnly")}</p>

      <ConfirmButton
        action={removeParentLink.bind(null, child.id)}
        icon="removeUser"
        label={t("parent.unlink.label")}
        title={t("parent.unlink.title", { name: child.name })}
        body={t("parent.unlink.body")}
        className="self-start"
      />
    </main>
  );
}
