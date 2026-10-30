import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { Hint } from "@/components/Hint";
import { StrengthTabs } from "@/components/StrengthTabs";
import { ExerciseLibrary } from "@/components/ExerciseLibrary";
import type { ExerciseRow } from "@/lib/exercises";

export default async function ExercisesPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { data } = await supabase
    .from("exercises").select("*")
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
