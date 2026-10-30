import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { todayInTeamZone } from "@/lib/wellness";
import { Avatar } from "@/components/Avatar";
import { StrengthTabs } from "@/components/StrengthTabs";
import { StrengthTests, type StrengthTest } from "@/components/StrengthTests";

export default async function StrengthPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ athlete?: string }>;
}) {
  const { id } = await params;
  const { athlete: athleteParam } = await searchParams;
  const { t } = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("team_members").select("role").eq("team_id", id).eq("user_id", user!.id).single();
  if (!me) notFound();
  const isStaff = me.role === "staff";

  const { data: team } = await supabase.from("teams").select("club_id").eq("id", id).single();
  if (!team) notFound();

  // Athletes the viewer may look at: staff sees all athletes of the team, an athlete only themself.
  let athletes: { id: string; name: string }[] = [];
  if (isStaff) {
    const [{ data: members }, { data: profiles }] = await Promise.all([
      supabase.from("team_members").select("user_id").eq("team_id", id).eq("role", "athlete").order("joined_at"),
      supabase.from("profiles").select("id, full_name"),
    ]);
    const names = new Map(profiles?.map((p) => [p.id as string, (p.full_name as string | null) ?? ""]));
    athletes = (members ?? []).map((m) => ({ id: m.user_id as string, name: names.get(m.user_id as string) || "?" }));
  } else {
    const { data: p } = await supabase.from("profiles").select("full_name").eq("id", user!.id).single();
    athletes = [{ id: user!.id, name: p?.full_name ?? "?" }];
  }

  const chosen = athletes.find((a) => a.id === athleteParam) ?? athletes[0];

  const { data: exercises } = await supabase
    .from("exercises").select("id, name")
    .eq("club_id", team.club_id).eq("track_5rm", true).is("archived_at", null)
    .order("name");
  const tracked = (exercises ?? []).map((e) => ({ id: e.id as string, name: e.name as string }));

  let tests: StrengthTest[] = [];
  if (chosen && tracked.length) {
    const { data } = await supabase
      .from("strength_tests")
      .select("id, exercise_id, tested_at, weight_kg, reps, rpe, five_rm_kg, estimated, note")
      .eq("user_id", chosen.id)
      .in("exercise_id", tracked.map((e) => e.id))
      .order("tested_at", { ascending: false })
      .order("created_at", { ascending: false });
    tests = (data ?? []).map((r) => ({
      id: r.id, exercise_id: r.exercise_id, tested_at: r.tested_at,
      weight_kg: Number(r.weight_kg), reps: r.reps, rpe: Number(r.rpe),
      five_rm_kg: Number(r.five_rm_kg), estimated: !!r.estimated, note: r.note ?? null,
    }));
  }

  return (
    <section className="flex flex-col gap-4">
      <StrengthTabs teamId={id} />

      {isStaff && athletes.length > 0 && (
        <nav aria-label={t("strength.athlete.label")} className="-mx-4 overflow-x-auto px-4">
          <ul className="flex w-max gap-2 pb-1">
            {athletes.map((a) => {
              const active = a.id === chosen?.id;
              return (
                <li key={a.id}>
                  <Link
                    href={`/team/${id}/strength?athlete=${a.id}`}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center gap-2 rounded-full border py-1 pl-1 pr-4 text-sm font-medium transition-colors ${
                      active
                        ? "border-transparent bg-[var(--primary)] text-[var(--on-primary)]"
                        : "bg-[var(--surface-2)] text-muted hover:text-[var(--foreground)]"
                    }`}
                  >
                    <Avatar name={a.name} size={32} />
                    <span className="max-w-32 truncate">{a.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {!chosen ? (
        <p className="text-muted">{t("strength.empty.noAthletes")}</p>
      ) : tracked.length === 0 ? (
        <div className="card flex flex-col items-start gap-3">
          <p className="text-muted">{t("strength.empty.noExercises")}</p>
          <Link href={`/team/${id}/strength/exercises`} className="link inline-flex min-h-11 items-center">
            {t("strength.empty.library")}
          </Link>
        </div>
      ) : (
        <>
          <h2 className="eyebrow !font-sans">
            {isStaff ? t("strength.overview.titleFor", { name: chosen.name }) : t("strength.overview.title")}
          </h2>
          <StrengthTests
            key={chosen.id}
            teamId={id}
            athleteId={chosen.id}
            today={todayInTeamZone()}
            exercises={tracked}
            tests={tests}
          />
        </>
      )}
    </section>
  );
}
