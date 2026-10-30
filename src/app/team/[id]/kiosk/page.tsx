import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarX, ChevronRight, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { dateLocale } from "@/lib/i18n";
import { TEAM_TIME_ZONE, todayInTeamZone } from "@/lib/wellness";
import { KioskFrame } from "@/components/KioskGrid";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = new Intl.DateTimeFormat("sv-SE", { timeZone: TEAM_TIME_ZONE });

export default async function KioskPickPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { t, locale } = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: me } = await supabase
    .from("team_members").select("role").eq("team_id", id).eq("user_id", user.id).maybeSingle();
  if (me?.role !== "staff") notFound();

  // Gym sessions with a workout, around now; "today" is decided in the team's time zone.
  const now = Date.now();
  const { data: rows } = await supabase
    .from("sessions").select("id, title, starts_at, workout_id")
    .eq("team_id", id).eq("type", "gym").not("workout_id", "is", null)
    .gte("starts_at", new Date(now - 36 * 3600_000).toISOString())
    .lte("starts_at", new Date(now + 36 * 3600_000).toISOString())
    .order("starts_at");
  const today = todayInTeamZone();
  const sessions = (rows ?? []).filter((s) => DAY.format(new Date(s.starts_at as string)) === today);

  if (sessions.length === 1) redirect(`/team/${id}/kiosk/${sessions[0].id}`);

  const exitHref = `/team/${id}/sessions`;
  if (!sessions.length) {
    return (
      <KioskFrame exitHref={exitHref}>
        <section className="rise card card-hero mx-auto flex w-full max-w-xl flex-col items-start gap-3">
          <span aria-hidden className="grid size-11 place-items-center rounded-full text-[var(--accent)]" style={{ background: "var(--surface-2)" }}>
            <CalendarX size={20} />
          </span>
          <h1 className="display text-3xl leading-tight">{t("kiosk.pick.empty.title")}</h1>
          <p className="text-muted">{t("kiosk.pick.empty.body")}</p>
          <Link href={exitHref} className="btn btn-primary inline-flex min-h-14 items-center px-6">{t("kiosk.exit")}</Link>
        </section>
      </KioskFrame>
    );
  }

  const time = new Intl.DateTimeFormat(dateLocale(locale), { timeZone: TEAM_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  return (
    <KioskFrame exitHref={exitHref}>
      <section className="rise flex flex-col gap-5">
        <div>
          <h1 className="display text-4xl leading-tight">{t("kiosk.pick.title")}</h1>
          <p className="mt-2 text-lg text-muted">{t("kiosk.pick.body")}</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {sessions.map((s) => (
            <li key={s.id as string}>
              <Link href={`/team/${id}/kiosk/${s.id}`} className="card flex min-h-24 items-center justify-between gap-4 !p-5 active:scale-[0.99]">
                <span className="flex min-w-0 flex-col gap-2">
                  <span className="display truncate text-2xl">{(s.title as string | null) || t("common.sessionType.gym")}</span>
                  <span className="chip w-fit"><Clock size={12} aria-hidden />{time.format(new Date(s.starts_at as string))}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 font-semibold text-[var(--accent)]">
                  {t("kiosk.pick.open")}<ChevronRight size={20} aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </KioskFrame>
  );
}
