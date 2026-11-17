import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getMembership, getT } from "@/lib/auth-cache";
import { dateLocale } from "@/lib/i18n";
import { TIME_ZONE } from "@/lib/session-plan";
import { doneTotal, groupByAthlete, topSet, type SummaryRow } from "@/lib/gym-summary";

const UUID_OK = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function GymSummaryPage({ params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const { id, sessionId } = await params;
  if (!UUID_OK.test(id) || !UUID_OK.test(sessionId)) notFound();
  const supabase = await createClient();
  const [{ t, locale }, user] = await Promise.all([getT(), getAuthUser()]);
  if (!user) notFound();
  const loc = dateLocale(locale);

  const [me, { data: session }, { data: team }, { data: summary }, { data: memberRows }, { data: exclusionRows }] = await Promise.all([
    getMembership(id, user.id),
    supabase.from("sessions").select("id, type, title, starts_at, workout_id").eq("id", sessionId).eq("team_id", id).maybeSingle(),
    supabase.from("teams").select("name").eq("id", id).maybeSingle(),
    supabase.rpc("session_set_summary", { _session: sessionId }),
    supabase.from("team_members").select("user_id, jersey_number").eq("team_id", id).eq("role", "athlete"),
    supabase.from("session_exclusions").select("user_id").eq("session_id", sessionId),
  ]);
  if (!session || session.type !== "gym") notFound();

  // Staff (and club admins without a team membership) see the whole team; athletes and parents only their own data.
  let full = me?.role === "staff";
  if (!me) {
    const { data: admin } = await supabase.from("club_admins").select("club_id").eq("user_id", user.id).limit(1);
    full = !!admin?.length;
  }

  const [{ data: workout }, { data: profiles }] = await Promise.all([
    session.workout_id ? supabase.from("workouts").select("name").eq("id", session.workout_id).maybeSingle() : Promise.resolve({ data: null }),
    full && memberRows?.length ? supabase.from("profiles").select("id, full_name").in("id", memberRows.map((m) => m.user_id as string)) : Promise.resolve({ data: [] }),
  ]);

  const athletes = groupByAthlete((summary ?? []) as SummaryRow[]) // the database already limits the rows to what this viewer may see;
  const excluded = new Set((exclusionRows ?? []).map((e) => e.user_id as string));
  const roster = (memberRows ?? []).filter((m) => !excluded.has(m.user_id as string));
  const started = new Set(athletes.map((a) => a.userId));
  const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? ""]));
  const notStarted = full
    ? roster.filter((m) => !started.has(m.user_id as string))
        .map((m) => ({ name: names.get(m.user_id as string) || t("members.unnamed"), jersey: m.jersey_number as number | null }))
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];
  const counts = doneTotal(athletes.filter((a) => !excluded.has(a.userId)), roster.length);

  const when = new Date(session.starts_at as string);
  const dateText = `${when.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long", timeZone: TIME_ZONE })} · ${when.toLocaleTimeString(loc, { timeStyle: "short", timeZone: TIME_ZONE })}`;
  const title = (workout?.name as string | undefined) ?? (session.title as string | null) ?? t("gymsum.title");

  return (
    <div className="stagger flex flex-col gap-4">
      <header className="flex flex-col gap-3">
        <Link href={`/team/${id}/sessions`} className="link inline-flex min-h-11 w-fit items-center gap-1">
          <ChevronLeft size={16} aria-hidden />{t("gymsum.back")}
        </Link>
        <div className="flex flex-col gap-1.5">
          <p className="eyebrow">{t("gymsum.title")}</p>
          <h2 className="display text-3xl leading-tight">{title}</h2>
          <p className="text-sm text-muted">{dateText}{team?.name ? ` · ${team.name}` : ""}</p>
          {full ? <p className="num text-lg">{t("gymsum.progress", { done: counts.done, total: counts.total })}</p>
            : <p className="text-sm text-muted">{t("gymsum.yourOwn")}</p>}
        </div>
      </header>

      {!athletes.length && <p className="card text-muted">{t("gymsum.empty")}</p>}

      <ul className="flex flex-col gap-3">
        {athletes.map((a) => (
          <li key={a.userId} className="card flex flex-col gap-3 text-sm">
            <div className="flex items-center gap-2">
              {a.jersey !== null && <span className="badge badge-none num">#{a.jersey}</span>}
              <span className="min-w-0 flex-1 truncate font-semibold">{a.name || t("members.unnamed")}</span>
              <span className={`badge ${a.finished ? "badge-ok" : "badge-watch"}`}>{a.finished ? t("gymsum.done") : t("gymsum.busy")}</span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {a.exercises.map((e) => {
                const top = topSet(e, locale);
                const topText = top.weight !== null
                  ? (top.reps !== null ? t("gymsum.topWeightReps", { kg: top.weight, reps: top.reps }) : t("gymsum.topWeight", { kg: top.weight }))
                  : (top.reps !== null ? t("gymsum.topReps", { reps: top.reps }) : t("gymsum.topNone"));
                return (
                  <li key={e.exerciseId}>
                    {t(e.sets === 1 ? "gymsum.lineOne" : "gymsum.line", { name: e.name, sets: e.sets, top: topText })}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>

      {notStarted.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="eyebrow !font-sans">{t("gymsum.notStarted")}</h3>
          <p className="text-sm text-muted">{notStarted.map((n) => (n.jersey !== null ? `#${n.jersey} ${n.name}` : n.name)).join(", ")}</p>
        </div>
      )}
    </div>
  );
}
