import Link from "next/link";
import { Check, ChevronRight, CircleHelp, Gauge, KeyRound, MessageSquare, Plus, Shield, ShieldCheck, Users, X } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Availability } from "@/lib/load";
import { AvailabilityIcon } from "@/components/icons";
import { Avatar } from "@/components/Avatar";
import { getT } from "@/lib/i18n/server";
import { AVAILABILITY_KEY, ROLE_KEY } from "@/lib/i18n";
import { createInvite, deleteInvite, removeMember, updateMember } from "@/app/actions";
import { ConfirmButton } from "@/components/ConfirmButton";

const label = "eyebrow flex items-center gap-1.5";

export default async function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("team_members").select("role").eq("team_id", id).eq("user_id", user!.id).single();
  if (me?.role !== "staff") notFound();

  const [{ data: members }, { data: profiles }, { data: avail }, { data: limits }, { data: invites }] =
    await Promise.all([
      supabase.from("team_members").select("*").eq("team_id", id).order("joined_at"),
      supabase.from("profiles").select("id, full_name, birth_date"),
      supabase.from("availability").select("*").eq("team_id", id),
      supabase.from("athlete_limits").select("*").eq("team_id", id),
      supabase.from("team_invites").select("*").eq("team_id", id).gt("expires_at", new Date().toISOString()),
    ]);
  const name = new Map(profiles?.map((p) => [p.id, p]));
  const av = new Map(avail?.map((a) => [a.user_id, a]));
  const lim = new Map(limits?.map((l) => [l.user_id, l]));
  const now = Date.now();

  return (
    <section className="flex flex-col gap-6">
      <div className="card card-hero flex flex-col gap-4 text-sm">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid size-11 shrink-0 place-items-center rounded-full text-[var(--accent)]"
            style={{
              background: "linear-gradient(145deg, var(--surface-3), var(--surface-2))",
              boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent)",
            }}
          >
            <KeyRound size={20} />
          </span>
          <div className="min-w-0">
            <h2 className="display text-xl">{t("members.inviteTitle")}</h2>
            <p className="mt-1 text-muted">{t("members.inviteHint")}</p>
          </div>
        </div>

        <form action={createInvite.bind(null, id)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className={label}>{t("members.role")}</span>
            <select name="role" className="input min-h-11 w-full">
              <option value="athlete">{t("common.role.athlete")}</option>
              <option value="staff">{t("common.role.staff")}</option>
            </select>
          </label>
          <button className="btn btn-primary inline-flex min-h-11 items-center justify-center gap-2">
            <Plus size={18} aria-hidden />{t("members.newCode")}
          </button>
        </form>
        <p className="-mt-2 text-xs text-muted">{t("members.days", { n: 14 })}</p>

        {!!invites?.length && (
          <>
            <hr className="hairline" />
            <div className="flex flex-col gap-3">
              <h3 className="eyebrow !font-sans">{t("members.activeCodes")}</h3>
              <ul className="flex flex-col gap-2">
                {invites.map((i) => {
                  const left = Math.max(1, Math.ceil((new Date(i.expires_at).getTime() - now) / 86_400_000));
                  return (
                    <li key={i.code} className="flex items-center gap-3 rounded-2xl border px-4 py-3" style={{ background: "var(--surface-2)" }}>
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <span className="select-all break-all font-mono text-xl font-semibold tracking-[0.18em]">{i.code}</span>
                        <span className="flex flex-wrap items-center gap-2">
                          <span className={`badge ${i.role === "staff" ? "badge-watch" : "badge-none"}`}>
                            {t(ROLE_KEY[i.role as keyof typeof ROLE_KEY])}
                          </span>
                          <span className="text-xs text-muted">{left === 1 ? t("members.dayLeft") : t("members.daysLeft", { n: left })}</span>
                        </span>
                      </div>
                      <form action={deleteInvite.bind(null, id, i.code)}>
                        <button
                          aria-label={t("danger.invite.revoke")}
                          title={t("danger.invite.revoke")}
                          className="inline-grid size-10 place-items-center rounded-full text-muted transition-colors hover:bg-[var(--danger-bg)] hover:text-danger"
                        >
                          <X size={18} aria-hidden />
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="eyebrow !font-sans">{t("members.team")}</h2>
        <ul className="stagger flex flex-col gap-3">
          {members?.map((m) => {
            const p = name.get(m.user_id);
            const a = av.get(m.user_id);
            const status = (a?.status ?? "available") as Availability;
            const display = p?.full_name || t("members.unnamed");
            return (
              <li key={m.user_id} className="card flex flex-col gap-4 text-sm">
                <div className="flex items-center gap-3">
                  <Avatar name={display} size={44} />
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                    <span className="max-w-full truncate font-semibold">{display}</span>
                    <span className={`badge ${m.role === "staff" ? "badge-watch" : "badge-none"}`}>
                      {m.role === "staff" ? <Shield size={12} aria-hidden /> : <Users size={12} aria-hidden />}
                      {t(ROLE_KEY[m.role as keyof typeof ROLE_KEY])}
                    </span>
                  </div>
                  {m.role === "athlete" && (
                    <Link
                      href={`/team/${id}/athlete/${m.user_id}`}
                      aria-label={t("detail.open", { name: display })}
                      title={t("detail.open", { name: display })}
                      className="inline-grid size-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:text-[var(--foreground)]"
                    >
                      <ChevronRight size={20} aria-hidden />
                    </Link>
                  )}
                  {m.user_id !== user!.id && (
                    <ConfirmButton
                      action={removeMember.bind(null, id, m.user_id)}
                      icon="removeUser"
                      iconOnly
                      label={t("danger.member.remove")}
                      title={t("danger.member.title", { name: display })}
                      body={t("danger.member.body")}
                      className="-mr-2 self-start"
                    />
                  )}
                </div>
                {m.role === "athlete" && (
                  <form action={updateMember.bind(null, id, m.user_id)} className="flex flex-col gap-4 border-t pt-4">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex flex-col gap-1.5">
                        <span className={label}><AvailabilityIcon status={status} size={12} />{t("members.status")}</span>
                        <select name="status" defaultValue={status} className="input min-h-11 w-full">
                          {(Object.keys(AVAILABILITY_KEY) as Availability[]).map((k) => <option key={k} value={k}>{t(AVAILABILITY_KEY[k])}</option>)}
                        </select>
                      </label>
                      <div className="flex flex-col gap-1.5">
                        <span className={`${label} justify-between`}>
                          <span className="flex items-center gap-1.5"><Gauge size={12} aria-hidden />{t("members.maxLoad")}</span>
                          <Link href="/help#limits" aria-label={t("common.nav.help")} className="link -m-3 grid size-10 place-items-center"><CircleHelp size={14} aria-hidden /></Link>
                        </span>
                        <input name="max_weekly_load" type="number" inputMode="numeric" min={1} defaultValue={lim.get(m.user_id)?.max_weekly_load ?? ""} aria-label={t("members.maxLoad")} className="input min-h-11 w-full" />
                      </div>
                      <label className="col-span-2 flex flex-col gap-1.5">
                        <span className={label}><MessageSquare size={12} aria-hidden />{t("members.note")}</span>
                        <input name="note" defaultValue={a?.note ?? ""} className="input min-h-11 w-full" />
                      </label>
                    </div>
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-4" style={{ background: "var(--surface-2)" }}>
                      <ShieldCheck size={18} aria-hidden className="shrink-0 text-[var(--accent)]" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-medium">{t("members.consent")}</span>
                        <span className="text-xs text-muted">{t("members.consentHint")}</span>
                      </span>
                      <input type="checkbox" name="consent" defaultChecked={m.consent_given} className="size-5 shrink-0 accent-[var(--primary)]" />
                    </label>
                    <button className="btn inline-flex min-h-12 w-full items-center justify-center gap-2">
                      <Check size={18} aria-hidden />{t("common.save")}
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
