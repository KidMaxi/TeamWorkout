import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { Hint } from "@/components/Hint";
import { SessionsTabs } from "@/components/SessionsTabs";
import { TeamCalendar, type CalAthlete, type CalSession } from "@/components/TeamCalendar";
import { SESSION_TYPE_LIST } from "@/lib/load";
import {
  addDays, isFocus, isStatus, isView, isYmd, localDay, localTime, monthGrid, zonedToUtc, type CalendarView,
} from "@/lib/session-plan";
import { weekDays } from "@/lib/workload";

export default async function CalendarPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { t } = await getT();
  const today = localDay(new Date().toISOString());
  const view: CalendarView = isView(sp.view) ? sp.view : "week";
  const date = isYmd(sp.date) ? sp.date : today;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("team_members").select("role").eq("team_id", id).eq("user_id", user!.id).single();
  const isStaff = me?.role === "staff";

  const days = view === "day" ? [date] : view === "week" ? weekDays(date) : monthGrid(date);
  const from = zonedToUtc(days[0], "00:00").toISOString();
  const to = zonedToUtc(addDays(days[days.length - 1], 1), "00:00").toISOString();
  const { data: rows } = await supabase
    .from("sessions")
    .select("id, type, starts_at, planned_duration_min, planned_rpe, status, focus, location")
    .eq("team_id", id).gte("starts_at", from).lt("starts_at", to).order("starts_at");
  const all = rows ?? [];

  // Staff see every exclusion (for the athlete filter); an athlete only sees, and is only shown, what applies to them.
  const ids = all.map((s) => s.id as string);
  const exclQuery = ids.length ? supabase.from("session_exclusions").select("session_id, user_id").in("session_id", ids) : null;
  const { data: excl } = exclQuery ? await (isStaff ? exclQuery : exclQuery.eq("user_id", user!.id)) : { data: [] };
  const exclusions: Record<string, string[]> = {};
  for (const e of excl ?? []) (exclusions[e.session_id as string] ??= []).push(e.user_id as string);

  const visible = isStaff ? all : all.filter((s) => !exclusions[s.id as string]);
  const sessions: CalSession[] = visible
    .filter((s) => (SESSION_TYPE_LIST as readonly string[]).includes(s.type))
    .map((s) => {
      const lt = localTime(s.starts_at);
      return {
        id: s.id, type: s.type, day: localDay(s.starts_at), time: lt.hm, startMin: lt.minutes,
        durationMin: s.planned_duration_min, rpe: s.planned_rpe ?? null,
        status: isStatus(s.status) ? s.status : "planned",
        focus: ((s.focus ?? []) as string[]).filter(isFocus), location: s.location ?? null,
      };
    });

  let athletes: CalAthlete[] = [];
  if (isStaff) {
    const { data: members } = await supabase.from("team_members").select("user_id").eq("team_id", id).eq("role", "athlete");
    const athleteIds = (members ?? []).map((m) => m.user_id as string);
    const { data: profiles } = athleteIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", athleteIds)
      : { data: [] };
    athletes = (profiles ?? [])
      .map((p) => ({ id: p.id as string, name: (p.full_name as string) || "?" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <section className="stagger flex flex-col gap-4">
      <SessionsTabs teamId={id} />
      <Hint id="sessions-calendar" text={t("calendar.hint")} />
      <TeamCalendar teamId={id} view={view} date={date} today={today} sessions={sessions} showLoad={isStaff} athletes={athletes} exclusions={isStaff ? exclusions : {}} />
    </section>
  );
}
