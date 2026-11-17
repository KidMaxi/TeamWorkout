import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getT } from "@/lib/auth-cache";
import { formatKg, pickId, rankLabel, splitPodium, type RecordRow } from "@/lib/leaderboard";

type Search = { club?: string | string[]; exercise?: string | string[] };
type ExerciseRow = { exercise_id: string; name: string; athletes: number };

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const user = await getAuthUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  // Clubs of the user: any team membership (staff or athlete) plus clubs they administer.
  const [{ t, locale }, { data: memberRows }, { data: adminRows }] = await Promise.all([
    getT(),
    supabase.from("team_members").select("teams(club_id, clubs(name))").eq("user_id", user.id),
    supabase.from("club_admins").select("club_id, clubs(name)").eq("user_id", user.id),
  ]);
  const names = new Map<string, string>();
  for (const r of memberRows ?? []) {
    const team = r.teams as unknown as { club_id: string | null; clubs: { name: string } | null } | null;
    if (team?.club_id) names.set(team.club_id, team.clubs?.name ?? "");
  }
  for (const r of adminRows ?? []) {
    const c = r.clubs as unknown as { name: string } | null;
    if (!names.get(r.club_id)) names.set(r.club_id, c?.name ?? "");
  }
  if (names.size === 0) redirect("/");

  // Only clubs where the leaderboard is open for this user.
  const ids = [...names.keys()];
  const access = await Promise.all(ids.map((id) => supabase.rpc("leaderboard_access", { _club: id })));
  const allowed = ids.filter((_, i) => access[i].data === true);
  if (allowed.length === 0) redirect("/");

  const clubId = pickId(sp.club, allowed) as string;
  const { data: exData, error: exError } = await supabase.rpc("club_record_exercises", { _club: clubId });
  if (exError) throw new Error(exError.message);
  const exercises = (exData ?? []) as ExerciseRow[];
  const exerciseId = pickId(sp.exercise, exercises.map((e) => e.exercise_id));

  let rows: RecordRow[] = [];
  if (exerciseId) {
    const { data, error } = await supabase.rpc("club_records", { _club: clubId, _exercise: exerciseId });
    if (error) throw new Error(error.message);
    rows = ((data ?? []) as RecordRow[]).map((r) => ({ ...r, best_kg: Number(r.best_kg), rank: Number(r.rank) }));
  }
  const { podium, rest } = splitPodium(rows);
  const kg = (n: number) => formatKg(n, locale);
  const href = (club: string, exercise?: string) => `/leaderboard?club=${club}${exercise ? `&exercise=${exercise}` : ""}`;
  const chip = (active: boolean) =>
    `chip inline-flex min-h-11 shrink-0 items-center ${active ? "border-[var(--accent)] text-[var(--foreground)]" : "text-muted"}`;

  return (
    <main className="stagger mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 px-4 pb-10 pt-4 sm:px-6">
      <header className="flex flex-col gap-1">
        <Link href="/" aria-label={t("common.nav.teams")} className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1 px-2 text-muted hover:text-[var(--foreground)]">
          <ChevronLeft size={18} aria-hidden />
          <span className="text-sm">{t("common.nav.teams")}</span>
        </Link>
        <p className="eyebrow">{t("leaderboard.eyebrow")}</p>
        <h1 className="display text-3xl">{t("leaderboard.title")}</h1>
        {names.get(clubId) && <p className="text-sm text-muted">{names.get(clubId)}</p>}
      </header>

      {allowed.length > 1 && (
        <nav aria-label={t("leaderboard.club.pick")} className="flex gap-2 overflow-x-auto pb-1">
          {allowed.map((id) => (
            <Link key={id} href={href(id)} aria-current={id === clubId ? "true" : undefined} className={chip(id === clubId)}>
              {names.get(id) || id}
            </Link>
          ))}
        </nav>
      )}

      {exercises.length > 0 && (
        <nav aria-label={t("leaderboard.exercise.pick")} className="flex gap-2 overflow-x-auto pb-1">
          {exercises.map((e) => (
            <Link key={e.exercise_id} href={href(clubId, e.exercise_id)} aria-current={e.exercise_id === exerciseId ? "true" : undefined} className={chip(e.exercise_id === exerciseId)}>
              {e.name}
            </Link>
          ))}
        </nav>
      )}

      {rows.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 py-8 text-center">
          <Trophy size={28} aria-hidden className="text-[var(--accent)]" />
          <p className="display text-lg">{t("leaderboard.empty.title")}</p>
          <p className="text-sm text-muted">{t("leaderboard.empty.hint")}</p>
        </div>
      ) : (
        <>
          <ol aria-label={t("leaderboard.podium")} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {podium.map((r) => {
              const me = r.user_id === user.id;
              return (
                <li key={r.user_id} className={`card ${r.rank === 1 ? "card-hero" : ""} flex min-w-0 flex-col gap-1 ${me ? "ring-2 ring-[var(--accent)]" : ""}`}>
                  <span className="num display text-4xl text-[var(--accent)]">{rankLabel(r.rank)}</span>
                  <span className="truncate font-semibold">
                    {r.full_name ?? "—"}
                    {me && <span className="badge badge-ok ml-2 align-middle">{t("leaderboard.row.you")}</span>}
                  </span>
                  <span className="truncate text-sm text-muted">
                    {r.team_name}
                    {r.jersey_number != null && ` · #${r.jersey_number}`}
                  </span>
                  <span className="mt-1 flex items-baseline gap-1">
                    <span className="num display text-3xl">{kg(r.best_kg)}</span>
                    <span className="text-sm text-muted">{t("leaderboard.unit")}</span>
                  </span>
                </li>
              );
            })}
          </ol>

          {rest.length > 0 && (
            <ol className="card flex flex-col divide-y divide-[var(--border)] !p-0">
              {rest.map((r) => {
                const me = r.user_id === user.id;
                return (
                  <li key={r.user_id} className={`flex min-h-14 items-center gap-3 px-4 py-2 ${me ? "bg-[var(--surface-3)] ring-1 ring-inset ring-[var(--accent)]" : ""}`}>
                    <span className="num w-8 shrink-0 text-muted">{rankLabel(r.rank)}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">
                        {r.full_name ?? "—"}
                        {me && <span className="badge badge-ok ml-2 align-middle">{t("leaderboard.row.you")}</span>}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-muted">
                        {r.team_name && <span className="chip truncate">{r.team_name}</span>}
                        {r.jersey_number != null && <span aria-label={t("leaderboard.jersey", { n: r.jersey_number })}>#{r.jersey_number}</span>}
                      </span>
                    </span>
                    <span className="num shrink-0 text-right font-semibold tabular-nums">
                      {kg(r.best_kg)} <span className="text-xs font-normal text-muted">{t("leaderboard.unit")}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}

      <p className="text-xs text-muted">{t("leaderboard.note.under16")}</p>
    </main>
  );
}
