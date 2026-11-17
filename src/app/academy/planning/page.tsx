import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getT } from "@/lib/auth-cache";
import { dateLocale } from "@/lib/i18n";
import { currentWeekStart, parseWeekParam, weekNav } from "@/lib/academy";
import { SESSION_TYPE_LIST, type SessionType } from "@/lib/load";
import { canPlanType, kindsFromRow } from "@/lib/roles";
import { defaultDay, toPlanItem, weekBoundsUtc, type RawSession } from "@/lib/academy-plan";
import { AcademyPlanner, type PlanDay } from "@/components/AcademyPlanner";
import { AcademyPlanForm, type FormTeam } from "@/components/AcademyPlanForm";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Search = { club?: string | string[]; week?: string | string[] };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

type StaffRow = {
  team_id: string; role: string; staff_kind: string | null; extra_kinds: string[] | null;
  teams: { id: string; name: string; club_id: string | null; clubs: { name: string } | null } | null;
};

export default async function AcademyPlanningPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const user = await getAuthUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const [{ t, locale }, { data: staffData }, { data: adminRows }] = await Promise.all([
    getT(),
    supabase.from("team_members").select("team_id, role, staff_kind, extra_kinds, teams(id, name, club_id, clubs(name))").eq("user_id", user.id).eq("role", "staff"),
    supabase.from("club_admins").select("club_id, clubs(name)").eq("user_id", user.id),
  ]);
  const staffRows = (staffData ?? []) as unknown as StaffRow[];
  const clubs = new Map<string, string>();
  for (const r of staffRows) if (r.teams?.club_id) clubs.set(r.teams.club_id, r.teams.clubs?.name ?? "");
  const adminClubs = new Set<string>();
  for (const r of adminRows ?? []) {
    adminClubs.add(r.club_id);
    const c = r.clubs as unknown as { name: string } | null;
    if (!clubs.get(r.club_id)) clubs.set(r.club_id, c?.name ?? "");
  }
  if (clubs.size === 0) redirect("/");

  const wanted = first(sp.club);
  const clubId = wanted && UUID.test(wanted) && clubs.has(wanted) ? wanted : [...clubs.keys()][0];
  const weekStart = parseWeekParam(sp.week) ?? currentWeekStart();
  const isAdmin = adminClubs.has(clubId);

  // Visible teams: club admins see every team of the club, trainers only the teams they are staff of.
  const myStaff = staffRows.filter((r) => r.teams?.club_id === clubId && r.teams);
  let visible: { id: string; name: string }[];
  if (isAdmin) {
    const { data } = await supabase.from("teams").select("id, name").eq("club_id", clubId).order("name");
    visible = (data ?? []) as { id: string; name: string }[];
  } else {
    visible = myStaff.map((r) => ({ id: r.teams!.id, name: r.teams!.name })).sort((a, b) => a.name.localeCompare(b.name));
  }
  const teamName = new Map(visible.map((v) => [v.id, v.name]));

  // Planning is limited to teams the user is staff of; trainers plan only in teams where their role allows the type.
  const formTeams: FormTeam[] = myStaff
    .map((r) => {
      const kinds = kindsFromRow(r);
      return { id: r.teams!.id, name: r.teams!.name, types: SESSION_TYPE_LIST.filter((ty) => canPlanType(kinds, ty)) as SessionType[] };
    })
    .filter((tm) => tm.types.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const { from, to } = weekBoundsUtc(weekStart);
  const { data: rows, error } = visible.length === 0
    ? { data: [] as RawSession[], error: null }
    : await supabase
        .from("sessions")
        .select("id, team_id, type, title, starts_at, planned_duration_min, planned_rpe, status, location")
        .in("team_id", visible.map((v) => v.id)).gte("starts_at", from).lt("starts_at", to).order("starts_at");
  if (error) throw new Error(error.message);
  const items = ((rows ?? []) as RawSession[]).map((r) => toPlanItem(r, teamName.get(r.team_id) ?? ""));

  const loc = dateLocale(locale);
  const nav = weekNav(weekStart);
  const fmt = (ymd: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(loc, { timeZone: "UTC", ...o }).format(new Date(`${ymd}T00:00:00Z`));
  const days: PlanDay[] = nav.days.map((ymd) => ({
    ymd,
    weekday: fmt(ymd, { weekday: "short" }).replace(".", ""),
    num: fmt(ymd, { day: "numeric" }),
    long: fmt(ymd, { weekday: "long", day: "numeric", month: "long" }),
  }));
  const today = nav.todayIndex >= 0 ? nav.days[nav.todayIndex] : "";
  const grouped: Record<string, unknown[]> = {};
  for (const d of nav.days) grouped[d] = items.filter((i) => i.day === d);
  const startDay = defaultDay(nav.days, today, grouped);
  const range = `${fmt(nav.start, { day: "numeric", month: "short" })} – ${fmt(nav.end, { day: "numeric", month: "short", year: "numeric" })}`;
  const href = (week: string, club = clubId) => `/academy/planning?club=${club}&week=${week}`;
  const clubName = clubs.get(clubId) ?? "";
  const linkCls = "glass inline-flex min-h-11 items-center justify-center gap-1 rounded-full px-4 text-sm transition-colors hover:text-[var(--foreground)]";

  return (
    <main className="stagger mx-auto flex min-h-dvh max-w-6xl flex-col gap-5 px-4 pb-10 pt-4 sm:px-6">
      <header className="flex flex-col gap-1">
        <Link href={`/academy?club=${clubId}&week=${nav.start}`} className="inline-flex min-h-11 w-fit items-center gap-1 text-sm text-muted hover:text-[var(--foreground)]">
          <ChevronLeft size={16} aria-hidden />{t("acplan.back")}
        </Link>
        <p className="eyebrow">{t("acplan.eyebrow")}{clubName ? ` · ${clubName}` : ""}</p>
        <h1 className="display text-4xl sm:text-5xl">{t("acplan.title")}</h1>
      </header>

      {clubs.size > 1 && (
        <nav aria-label={t("acplan.club.pick")} className="flex flex-wrap gap-2">
          {[...clubs].map(([id, name]) => (
            <Link key={id} href={href(nav.start, id)} aria-current={id === clubId ? "page" : undefined}
              className={`chip min-h-11 px-3.5 text-sm ${id === clubId ? "!border-[var(--accent)] !text-[var(--foreground)]" : ""}`}>
              {name || id.slice(0, 8)}
            </Link>
          ))}
        </nav>
      )}

      <nav aria-label={t("acplan.week.nav")} className="flex flex-wrap items-center gap-2">
        <Link href={href(nav.prev)} className={linkCls}><ChevronLeft size={16} aria-hidden />{t("acplan.week.prev")}</Link>
        <Link href={href(nav.thisWeek)} aria-current={nav.isCurrent ? "date" : undefined}
          className={`${linkCls} ${nav.isCurrent ? "!border-[var(--accent)]" : ""}`}>{t("acplan.week.this")}</Link>
        <Link href={href(nav.next)} className={linkCls}>{t("acplan.week.next")}<ChevronRight size={16} aria-hidden /></Link>
        <p className="ml-auto text-sm text-muted">{range}</p>
      </nav>

      {formTeams.length === 0 && <p className="text-xs text-muted">{t("acplan.readonly")}</p>}

      {/* key: reset filters and the chosen day when the week or club changes */}
      <AcademyPlanner key={`${clubId}:${nav.start}`} items={items} days={days} today={today} defaultDay={startDay} teams={visible} />

      {formTeams.length > 0 && (
        <AcademyPlanForm key={`${clubId}:${nav.start}`} teams={formTeams} days={days.map((d) => ({ ymd: d.ymd, label: d.long }))} defaultDay={startDay} />
      )}
    </main>
  );
}
