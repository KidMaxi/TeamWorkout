import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/roles";
import { getAuthUser, getMembership, getT } from "@/lib/auth-cache";
import { Hint } from "@/components/Hint";
import { StrengthTabs } from "@/components/StrengthTabs";
import { ExerciseLibrary } from "@/components/ExerciseLibrary";
import type { ExerciseRow } from "@/lib/exercises";

export default async function ExercisesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ t }, user] = await Promise.all([getT(), getAuthUser()]);
  if (!user) notFound();

  const [{ data: team }, me] = await Promise.all([
    supabase.from("teams").select("club_id").eq("id", id).single(),
    getMembership(id, user.id),
  ]);
  if (!team?.club_id || !me) notFound();
  // "isStaff" here means: may edit the library (S&C or head).
  const isStaff = me.role === "staff" && can(me.staffKind, "manageLibrary");

  const { data } = await supabase
    .from("exercises")
    .select("id, club_id, name, instructions, equipment, primary_muscle, other_muscles, kind, per_side, track_pr, track_5rm, media_kind, media_url, archived_at")
    .eq("club_id", team.club_id).is("archived_at", null).order("name");

  return (
    <section className="flex flex-col gap-4">
      <StrengthTabs teamId={id} />
      <Hint id="strength-library" text={t("help.hint.library")} href="/help#gym" linkLabel={t("help.hint.more")} />
      <div className="flex flex-col gap-1">
        <h2 className="display text-2xl">{t("exercises.title")}</h2>
        <p className="text-sm text-muted">{t("exercises.intro")}</p>
      </div>
      <ExerciseLibrary teamId={id} exercises={(data ?? []) as ExerciseRow[]} isStaff={isStaff} />
    </section>
  );
}
