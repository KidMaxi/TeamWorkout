import Link from "next/link";
import { Check, ChevronRight, CircleHelp, Gauge, KeyRound, Lock, MessageSquare, Plus, Shield, ShieldCheck, Users, X } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Availability } from "@/lib/load";
import { AvailabilityIcon } from "@/components/icons";
import { Avatar } from "@/components/Avatar";
import { getT } from "@/lib/i18n/server";
import { AVAILABILITY_KEY, ROLE_KEY, dateLocale } from "@/lib/i18n";
import { createInvite, deleteInvite, removeMember, updateMember } from "@/app/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ParentConsentForm } from "@/components/ConsentCard";
import { withdrawParentConsent } from "@/app/consent-actions";
import { StaffKindSelect } from "@/components/StaffKindSelect";
import { STAFF_KINDS, can, getStaffKind, isStaffKind, type Capability, type StaffKind } from "@/lib/roles";

function ageOf(birth: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birth ?? "");
  if (!m) return null;
  const now = new Date();
  let a = now.getUTCFullYear() - Number(m[1]);
  if (now.getUTCMonth() + 1 < Number(m[2]) || (now.getUTCMonth() + 1 === Number(m[2]) && now.getUTCDate() < Number(m[3]))) a--;
  return a >= 0 && a < 130 ? a : null;
}

const label = "eyebrow flex items-center gap-1.5";

const MATRIX_ROWS: Capability[] = [
  "planGym", "planCourt", "manageLibrary", "planRules", "writeNotes", "setAvailability", "viewHealth", "manageMembers", "manageTeam",
];

export default async function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, locale } = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("team_members").select("role").eq("team_id", id).eq("user_id", user!.id).single();
  if (me?.role !== "staff") notFound();
  const myKind = (await getStaffKind(supabase, id, user!.id)) as StaffKind;
  const isHead = can(myKind, "manageMembers");
  const mayAvail = can(myKind, "setAvailability");
  const mayLimit = can(myKind, "planRules");
  const kindOf = (v: unknown): StaffKind => (isStaffKind(v) ? v : "head"); // legacy rows behave as head

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
  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(dateLocale(locale), { day: "numeric", month: "short", year: "numeric" }) : "";

  return (
    <section className="flex flex-col gap-6">
      {!isHead && <p className="card text-sm text-muted">{t("roles.readOnly")}</p>}
      {isHead && <div className="card card-hero flex flex-col gap-4 text-sm">
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
          <label className="flex flex-1 flex-col gap-1.5">
            <span className={label}>{t("roles.kind.invite")}</span>
            <select name="staff_kind" defaultValue="basketball" className="input min-h-11 w-full">
              {STAFF_KINDS.map((k) => <option key={k} value={k}>{t(`common.staffKind.${k}`)}</option>)}
            </select>
          </label>
          <button className="btn btn-primary inline-flex min-h-11 items-center justify-center gap-2">
            <Plus size={18} aria-hidden />{t("members.newCode")}
          </button>
        </form>
        <p className="-mt-2 text-xs text-muted">{t("roles.kind.inviteHint")} {t("members.days", { n: 14 })}</p>

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
                            {i.role === "staff" ? t(`common.staffKind.${kindOf(i.staff_kind)}`) : t(ROLE_KEY[i.role as keyof typeof ROLE_KEY])}
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
      </div>}

      <div className="flex flex-col gap-3">
        <h2 className="eyebrow !font-sans">{t("members.team")}</h2>
        <ul className="stagger flex flex-col gap-3">
          {members?.map((m) => {
            const p = name.get(m.user_id);
            const a = av.get(m.user_id);
            const status = (a?.status ?? "available") as Availability;
            const display = p?.full_name || t("members.unnamed");
            const age = ageOf(p?.birth_date);
            return (
              <li key={m.user_id} className="card flex flex-col gap-4 text-sm">
                <div className="flex items-center gap-3">
                  <Avatar name={display} size={44} />
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                    <span className="max-w-full truncate font-semibold">{display}</span>
                    <span className={`badge ${m.role === "staff" ? "badge-watch" : "badge-none"}`}>
                      {m.role === "staff" ? <Shield size={12} aria-hidden /> : <Users size={12} aria-hidden />}
                      {m.role === "staff" ? t(`common.staffKind.${kindOf(m.staff_kind)}`) : t(ROLE_KEY[m.role as keyof typeof ROLE_KEY])}
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
                  {isHead && m.user_id !== user!.id && (
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
                {isHead && m.role === "staff" && (
                  <div className="border-t pt-4">
                    <StaffKindSelect teamId={id} userId={m.user_id} name={display} kind={kindOf(m.staff_kind)} />
                  </div>
                )}
                {m.role === "athlete" && (
                  <div className="flex flex-col gap-3 border-t pt-4">
                    <span className={label}><ShieldCheck size={12} aria-hidden />{t("members.consent")}</span>
                    {m.consent_given ? (
                      <div className="flex flex-col items-start gap-1">
                        <span className="badge badge-ok">
                          <ShieldCheck size={12} aria-hidden />
                          {m.consent_by === "parent"
                            ? t("consent.staff.parent", { date: fmt(m.consent_at) })
                            : t("consent.staff.self", { date: fmt(m.consent_at) })}
                        </span>
                        {m.consent_by === "parent" && m.consent_note && (
                          <span className="break-words text-xs text-muted">{t("consent.staff.noteLabel", { note: m.consent_note })}</span>
                        )}
                      </div>
                    ) : (
                      <span className="badge badge-none self-start"><Lock size={12} aria-hidden />{t("consent.staff.none")}</span>
                    )}
                    {age === null ? (
                      <p className="text-xs text-muted">{t("consent.staff.needBirth")}</p>
                    ) : age >= 16 ? (
                      <p className="text-xs text-muted">{t("consent.staff.selfHint")}</p>
                    ) : !isHead ? null : m.consent_given ? (
                      <ConfirmButton
                        action={withdrawParentConsent.bind(null, id, m.user_id)}
                        icon="warning"
                        label={t("consent.parent.withdraw")}
                        title={t("consent.parent.withdrawTitle")}
                        body={t("consent.parent.withdrawBody")}
                        className="self-start"
                      />
                    ) : (
                      <ParentConsentForm teamId={id} userId={m.user_id} />
                    )}
                  </div>
                )}
                {m.role === "athlete" && (mayAvail || mayLimit) && (
                  <form action={updateMember.bind(null, id, m.user_id)} className="flex flex-col gap-4 border-t pt-4">
                    <div className="grid grid-cols-2 gap-3">
                      {mayAvail && <label className="flex flex-col gap-1.5">
                        <span className={label}><AvailabilityIcon status={status} size={12} />{t("members.status")}</span>
                        <select name="status" defaultValue={status} className="input min-h-11 w-full">
                          {(Object.keys(AVAILABILITY_KEY) as Availability[]).map((k) => <option key={k} value={k}>{t(AVAILABILITY_KEY[k])}</option>)}
                        </select>
                      </label>}
                      {mayLimit && <div className="flex flex-col gap-1.5">
                        <span className={`${label} justify-between`}>
                          <span className="flex items-center gap-1.5"><Gauge size={12} aria-hidden />{t("members.maxLoad")}</span>
                          <Link href="/help#limits" aria-label={t("common.nav.help")} className="link -m-3 grid size-10 place-items-center"><CircleHelp size={14} aria-hidden /></Link>
                        </span>
                        <input name="max_weekly_load" type="number" inputMode="numeric" min={1} defaultValue={lim.get(m.user_id)?.max_weekly_load ?? ""} aria-label={t("members.maxLoad")} className="input min-h-11 w-full" />
                      </div>}
                      {mayAvail && <label className="col-span-2 flex flex-col gap-1.5">
                        <span className={label}><MessageSquare size={12} aria-hidden />{t("members.note")}</span>
                        <input name="note" defaultValue={a?.note ?? ""} className="input min-h-11 w-full" />
                      </label>}
                    </div>
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

      {isHead && (
        <div className="card flex flex-col gap-3 text-sm">
          <div>
            <h2 className="display text-xl">{t("roles.title")}</h2>
            <p className="mt-1 text-muted">{t("roles.intro")}</p>
          </div>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th scope="col" className="eyebrow pb-2 pr-2 text-left font-normal">{t("roles.what")}</th>
                {STAFF_KINDS.map((k) => (
                  <th key={k} scope="col" title={t(`common.staffKind.${k}`)} className="eyebrow w-11 pb-2 text-center font-normal">
                    {t(`roles.short.${k}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX_ROWS.map((cap) => (
                <tr key={cap} className="border-t">
                  <th scope="row" className="py-2.5 pr-2 text-left font-normal">{t(`roles.cap.${cap}`)}</th>
                  {STAFF_KINDS.map((k) => (
                    <td key={k} className="py-2.5 text-center">
                      {can(k, cap) ? (
                        <><Check size={16} aria-hidden className="mx-auto text-[var(--ok)]" /><span className="sr-only">{t("roles.yes")}</span></>
                      ) : (
                        <><span aria-hidden className="text-muted">·</span><span className="sr-only">{t("roles.no")}</span></>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
