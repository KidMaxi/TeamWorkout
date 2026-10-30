import { notFound } from "next/navigation";
import { Info, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { deleteTeam, removeMember } from "@/app/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { KioskSettings, type KioskAthlete } from "@/components/KioskSettings";

export default async function TeamSettings({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: team } = await supabase.from("teams").select("name, created_by, kiosk_pin_required").eq("id", id).single();
  const { data: me } = await supabase
    .from("team_members").select("role").eq("team_id", id).eq("user_id", user!.id).single();
  if (!team || !me) notFound();
  const canDelete = me.role === "staff" && (team.created_by === user!.id || team.created_by === null);

  let athletes: KioskAthlete[] = [];
  if (me.role === "staff") {
    const { data: rows } = await supabase
      .from("team_members").select("user_id").eq("team_id", id).eq("role", "athlete").order("joined_at");
    const ids = (rows ?? []).map((r) => r.user_id as string);
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as { id: string; full_name: string | null }[] };
    const names = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
    athletes = await Promise.all(
      ids.map(async (uid) => {
        const { data } = await supabase.rpc("has_athlete_pin", { _user: uid });
        return { userId: uid, name: names.get(uid) || t("members.unnamed"), hasPin: data === true };
      }),
    );
    athletes.sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <section className="rise flex flex-col gap-4">
      {me.role === "staff" && (
        <KioskSettings teamId={id} pinRequired={!!team.kiosk_pin_required} athletes={athletes} />
      )}
      <div
        className="card flex flex-col gap-4"
        style={{ borderColor: "color-mix(in srgb, var(--danger) 45%, var(--line))" }}
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid size-11 shrink-0 place-items-center rounded-full text-danger"
            style={{ background: "var(--danger-bg)", boxShadow: "0 0 0 1px color-mix(in srgb, var(--danger) 35%, transparent)" }}
          >
            <TriangleAlert size={20} />
          </span>
          <div className="min-w-0">
            <h2 className="display text-xl">{t("danger.zone.title")}</h2>
            <p className="mt-1 text-sm text-muted">{t("danger.zone.body")}</p>
          </div>
        </div>
        <hr className="hairline" />
        <div className="flex flex-col gap-3">
          <ConfirmButton
            action={removeMember.bind(null, id, user!.id)}
            icon="leave"
            label={t("danger.leave.label")}
            title={t("danger.leave.title")}
            body={t("danger.leave.body")}
            className="w-full"
          />
          {canDelete ? (
            <ConfirmButton
              action={deleteTeam.bind(null, id)}
              icon="trash"
              label={t("danger.team.label")}
              title={t("danger.team.title")}
              body={t("danger.team.body")}
              requireText={team.name}
              className="w-full"
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
      </div>
    </section>
  );
}
