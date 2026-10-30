import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Pencil, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { StrengthTabs } from "@/components/StrengthTabs";
import { ConfirmButton } from "@/components/ConfirmButton";
import { DuplicateWorkoutButton } from "@/components/WorkoutEditor";
import { archiveWorkout } from "./actions";

type Row = {
  id: string;
  name: string;
  description: string;
  workout_blocks: {
    position: number;
    exercises: { name: string } | { name: string }[] | null;
    workout_sets: { id: string }[];
  }[];
};

export default async function WorkoutsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const [{ data: team }, { data: me }] = await Promise.all([
    supabase.from("teams").select("club_id").eq("id", id).single(),
    supabase.from("team_members").select("role").eq("team_id", id).eq("user_id", user.id).single(),
  ]);
  if (!team?.club_id || !me) notFound();
  const isStaff = me.role === "staff";

  const [{ data }, { count }] = await Promise.all([
    supabase
      .from("workouts")
      .select("id, name, description, workout_blocks(position, exercises(name), workout_sets(id))")
      .eq("club_id", team.club_id).is("archived_at", null).order("name"),
    isStaff
      ? supabase.from("exercises").select("id", { count: "exact", head: true }).eq("club_id", team.club_id).is("archived_at", null)
      : Promise.resolve({ count: null }),
  ]);
  const workouts = (data ?? []) as unknown as Row[];
  const noExercises = isStaff && count === 0;

  const plural = (key: "blocks" | "sets", n: number) => (n === 1 ? t(`workouts.${key}.one`) : t(`workouts.${key}.many`, { n }));

  return (
    <section className="flex flex-col gap-4">
      <StrengthTabs teamId={id} />
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="display text-2xl">{t("workouts.title")}</h2>
          <p className="text-sm text-muted">{t("workouts.intro")}</p>
        </div>
        {isStaff && workouts.length > 0 && !noExercises && (
          <Link href={`/team/${id}/strength/workouts/new`} className="btn btn-primary inline-flex min-h-11 shrink-0 items-center gap-2">
            <Plus size={18} aria-hidden />{t("workouts.new")}
          </Link>
        )}
      </div>

      {workouts.length === 0 ? (
        <div className="card card-hero flex flex-col items-center gap-3 py-8 text-center text-sm">
          <span
            aria-hidden
            className="grid size-12 place-items-center rounded-full text-[var(--accent)]"
            style={{
              background: "linear-gradient(145deg, var(--surface-3), var(--surface-2))",
              boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent)",
            }}
          >
            <ClipboardList size={22} />
          </span>
          <h3 className="display text-xl">{t("workouts.empty.title")}</h3>
          <p className="max-w-xs text-muted">
            {!isStaff ? t("workouts.empty.athlete") : noExercises ? t("workouts.empty.noExercises") : t("workouts.empty.staff")}
          </p>
          {isStaff && (noExercises ? (
            <Link href={`/team/${id}/strength/exercises`} className="btn btn-primary inline-flex min-h-11 items-center gap-2">
              {t("workouts.empty.exercisesLink")}
            </Link>
          ) : (
            <Link href={`/team/${id}/strength/workouts/new`} className="btn btn-primary inline-flex min-h-11 items-center gap-2">
              <Plus size={18} aria-hidden />{t("workouts.new")}
            </Link>
          ))}
        </div>
      ) : (
        <ul className="stagger flex flex-col gap-3">
          {workouts.map((w) => {
            const blocks = [...w.workout_blocks].sort((a, b) => a.position - b.position);
            const sets = blocks.reduce((n, b) => n + b.workout_sets.length, 0);
            const names = blocks.map((b) => (Array.isArray(b.exercises) ? b.exercises[0]?.name : b.exercises?.name)).filter(Boolean);
            return (
              <li key={w.id} className="card flex flex-col gap-3 text-sm">
                <div className="flex flex-col gap-1">
                  <h3 className="display text-xl leading-tight">
                    {isStaff ? (
                      <Link href={`/team/${id}/strength/workouts/${w.id}`} className="hover:underline">{w.name}</Link>
                    ) : w.name}
                  </h3>
                  <p className="eyebrow !font-sans">{plural("blocks", blocks.length)} · {plural("sets", sets)}</p>
                </div>
                <p className={`line-clamp-2 ${w.description ? "" : "text-muted"}`}>{w.description || t("workouts.noDescription")}</p>
                {names.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5" aria-label={t("workouts.block.exercise")}>
                    {names.slice(0, 5).map((n, i) => <li key={i} className="chip">{n}</li>)}
                    {names.length > 5 && <li className="chip">+{names.length - 5}</li>}
                  </ul>
                )}
                {isStaff && (
                  <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                    <Link href={`/team/${id}/strength/workouts/${w.id}`} className="btn inline-flex min-h-11 items-center gap-2">
                      <Pencil size={16} aria-hidden />{t("workouts.edit")}
                    </Link>
                    <DuplicateWorkoutButton teamId={id} workoutId={w.id} />
                    <ConfirmButton
                      action={archiveWorkout.bind(null, id, w.id)}
                      icon="trash"
                      label={t("workouts.archive.label")}
                      title={t("workouts.archive.title")}
                      body={t("workouts.archive.body")}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
