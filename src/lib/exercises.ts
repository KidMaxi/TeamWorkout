/** Shared exercise taxonomy. Labels live in the i18n area "exercises" (equipment.*, muscle.*, kind.*). */
export const EQUIPMENT = ["none", "bodyweight", "barbell", "trap_bar", "dumbbell", "kettlebell", "machine", "cable", "band", "other"] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const MUSCLES = [
  "chest", "back", "shoulders", "biceps", "triceps", "forearms", "quads", "hamstrings", "glutes", "calves", "hips", "core", "full_body",
] as const;
export type Muscle = (typeof MUSCLES)[number];

/** How a set is recorded. */
export const EXERCISE_KINDS = ["weight_reps", "bodyweight_reps", "weighted_bodyweight", "height_cm", "duration_s"] as const;
export type ExerciseKind = (typeof EXERCISE_KINDS)[number];

export type ExerciseRow = {
  id: string;
  club_id: string;
  name: string;
  instructions: string;
  equipment: Equipment;
  primary_muscle: Muscle | null;
  other_muscles: Muscle[];
  kind: ExerciseKind;
  per_side: boolean;
  track_pr: boolean;
  track_5rm: boolean;
  media_kind: "none" | "image" | "video";
  media_url: string | null;
  archived_at: string | null;
};

/** A ready-made exercise a club can add in one click. Texts exist in both languages. */
export type StarterExercise = {
  key: string;
  name: { nl: string; en: string };
  instructions: { nl: string; en: string };
  equipment: Equipment;
  primary_muscle: Muscle;
  other_muscles: Muscle[];
  kind: ExerciseKind;
  per_side: boolean;
  track_pr: boolean;
  track_5rm: boolean;
};
