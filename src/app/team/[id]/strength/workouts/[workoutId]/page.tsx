import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { can, getStaffKind } from "@/lib/roles";
import { getT } from "@/lib/i18n/server";
import { Hint } from "@/components/Hint";
import { WorkoutEditor, type EditorExercise, type EditorWorkout, type SetType } from "@/components/WorkoutEditor";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Raw = {
  id: string;
  name: string;
  description: string;
  workout_blocks: {
    position: number;
    exercise_id: string;
    notes: string | null;
    workout_sets: {
      position: number;
      set_type: SetType | null;
      reps: number | null;
      target_rpe: number | string | null;
      fixed_weight_kg: number | string | null;
      rest_seconds: number;
    }[];
  }[];
};

export default async function WorkoutEditorPage({ params }: { params: Promise<{ id: string; workoutId: string }> }) {
  const { id, workoutId } = await params;
  const creating = workoutId === "new";
  if (!creating && !UUID.test(workoutId)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const [{ data: team }, { data: me }] = await Promise.all([
    supabase.from("teams").select("club_id").eq("id", id).single(),
    supabase.from("team_members").select("role").eq("team_id", id).eq("user_id", user.id).single(),
  ]);
  // Editing is staff only; athletes get the read-only list.
  if (!team?.club_id || me?.role !== "staff" || !can(await getStaffKind(supabase, id, user.id), "manageLibrary")) notFound();

  let workout: EditorWorkout | null = null;
  if (!creating) {
    const { data } = await supabase
      .from("workouts")
      .select("id, name, description, workout_blocks(position, exercise_id, notes, workout_sets(position, set_type, reps, target_rpe, fixed_weight_kg, rest_seconds))")
      .eq("id", workoutId).eq("club_id", team.club_id).is("archived_at", null).maybeSingle();
    if (!data) notFound();
    const raw = data as unknown as Raw;
    workout = {
      id: raw.id,
      name: raw.name,
      description: raw.description ?? "",
      blocks: [...raw.workout_blocks].sort((a, b) => a.position - b.position).map((b) => ({
        exerciseId: b.exercise_id,
        notes: b.notes ?? "",
        sets: [...b.workout_sets].sort((x, y) => x.position - y.position).map((s) => ({
          type: s.set_type ?? "normal",
          reps: s.reps,
          rpe: s.target_rpe === null ? null : Number(s.target_rpe),
          weight: s.fixed_weight_kg === null ? null : Number(s.fixed_weight_kg),
          rest: s.rest_seconds,
        })),
      })),
    };
  }

  // Active exercises, plus any archived ones this workout still uses so they stay visible.
  const used = [...new Set(workout?.blocks.map((b) => b.exerciseId) ?? [])];
  const cols = "id, name, equipment, primary_muscle, kind, per_side, archived_at";
  const [{ data: active }, { data: archived }] = await Promise.all([
    supabase.from("exercises").select(cols).eq("club_id", team.club_id).is("archived_at", null).order("name"),
    used.length
      ? supabase.from("exercises").select(cols).eq("club_id", team.club_id).in("id", used).not("archived_at", "is", null)
      : Promise.resolve({ data: [] }),
  ]);
  const exercises = [...(active ?? []), ...(archived ?? [])].map((e) => ({
    id: e.id, name: e.name, equipment: e.equipment, primary_muscle: e.primary_muscle, kind: e.kind,
    per_side: !!e.per_side, archived: !!e.archived_at,
  })) as EditorExercise[];

  const { t } = await getT();
  return (
    <WorkoutEditor
      teamId={id} workout={workout} exercises={exercises}
      hint={<Hint id="workout-editor" text={t("workouts.editor.hint")} />}
    />
  );
}
