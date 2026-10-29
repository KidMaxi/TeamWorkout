import { notFound } from "next/navigation";
import { Info, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { deleteTeam, removeMember } from "@/app/actions";
import { ConfirmButton } from "@/components/ConfirmButton";

export default async function TeamSettings({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: team } = await supabase.from("teams").select("name, created_by").eq("id", id).single();
  const { data: me } = await supabase
    .from("team_members").select("role").eq("team_id", id).eq("user_id", user!.id).single();
  if (!team || !me) notFound();
  const canDelete = me.role === "staff" && (team.created_by === user!.id || team.created_by === null);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <TriangleAlert size={18} aria-hidden className="text-danger" />
        {t("danger.zone.title")}
      </h2>
      <div className="card flex flex-col gap-3">
        <ConfirmButton
          action={removeMember.bind(null, id, user!.id)}
          icon="leave"
          label={t("danger.leave.label")}
          title={t("danger.leave.title")}
          body={t("danger.leave.body")}
          className="self-start"
        />
        {canDelete ? (
          <ConfirmButton
            action={deleteTeam.bind(null, id)}
            icon="trash"
            label={t("danger.team.label")}
            title={t("danger.team.title")}
            body={t("danger.team.body")}
            requireText={team.name}
            className="self-start"
          />
        ) : (
          me.role === "staff" && (
            <p className="flex items-center gap-2 text-xs text-muted">
              <Info size={14} aria-hidden className="shrink-0" />
              {t("danger.settings.ownerOnly")}
            </p>
          )
        )}
      </div>
    </section>
  );
}
