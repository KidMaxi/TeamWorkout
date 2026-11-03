import { notFound } from "next/navigation";
import { Info, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getMembership, getT } from "@/lib/auth-cache";
import { dateLocale } from "@/lib/i18n";
import { TEAM_TIME_ZONE } from "@/lib/wellness";
import { deleteTeam, removeMember } from "@/app/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { can } from "@/lib/roles";
import { KioskSettings, type KioskAthlete } from "@/components/KioskSettings";

export default async function TeamSettings({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ t, locale }, user] = await Promise.all([getT(), getAuthUser()]);
  const [{ data: team }, me] = await Promise.all([
    supabase.from("teams").select("name, created_by, kiosk_pin_required").eq("id", id).single(),
    getMembership(id, user!.id),
  ]);
  if (!team || !me) notFound();
  const kind = me.staffKind;
  const isHead = can(kind, "manageTeam");
  const canKiosk = can(kind, "manageLibrary");
  const canDelete = isHead && (team.created_by === user!.id || team.created_by === null);

  let athletes: KioskAthlete[] = [];
  if (canKiosk) {
    const [{ data: rows }, { data: locks }] = await Promise.all([
      supabase.from("team_members").select("user_id").eq("team_id", id).eq("role", "athlete").order("joined_at"),
      // PIN locks (5 wrong tries) that a coach may release; only still-active locks are returned.
      supabase.rpc("kiosk_locked_users", { _team: id }),
    ]);
    const ids = (rows ?? []).map((r) => r.user_id as string);
    // Names and per-athlete PIN flags are independent of each other: fetch them together.
    const [profsRes, pinRes] = await Promise.all([
      ids.length
        ? supabase.from("profiles").select("id, full_name").in("id", ids)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
      Promise.all(ids.map((uid) => supabase.rpc("has_athlete_pin", { _user: uid }))),
    ]);
    const names = new Map((profsRes.data ?? []).map((p) => [p.id, p.full_name]));
    const clock = new Intl.DateTimeFormat(dateLocale(locale), { timeZone: TEAM_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
    const lockedUntil = new Map(
      ((locks ?? []) as { user_id: string; locked_until: string }[]).map((l) => [l.user_id, clock.format(new Date(l.locked_until))]),
    );
    athletes = ids.map((uid, i) => ({
      userId: uid, name: names.get(uid) || t("members.unnamed"), hasPin: pinRes[i].data === true, lockedUntil: lockedUntil.get(uid) ?? null,
    }));
    athletes.sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <section className="rise flex flex-col gap-4">
      {canKiosk && (
        <KioskSettings teamId={id} pinRequired={!!team.kiosk_pin_required} athletes={athletes} canRequire={isHead} />
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
            isHead && (
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
