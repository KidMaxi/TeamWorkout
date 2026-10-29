import Link from "next/link";
import { Check, CircleHelp, Copy, Gauge, KeyRound, MessageSquare, Plus, Shield, ShieldCheck, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Availability } from "@/lib/load";
import { AvailabilityIcon } from "@/components/icons";
import { getT } from "@/lib/i18n/server";
import { AVAILABILITY_KEY, ROLE_KEY } from "@/lib/i18n";
import { createInvite, updateMember } from "@/app/actions";

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

  return (
    <section className="flex flex-col gap-4">
      <div className="card text-sm">
        <form action={createInvite.bind(null, id)} className="flex flex-wrap items-center gap-2">
          <select name="role" aria-label={t("common.nav.members")} className="input">
            <option value="athlete">{t("common.role.athlete")}</option>
            <option value="staff">{t("common.role.staff")}</option>
          </select>
          <button className="btn btn-primary inline-flex items-center gap-1"><Plus size={16} aria-hidden />{t("members.newCode")}</button>
          <span className="text-xs text-muted">{t("members.days", { n: 14 })}</span>
        </form>
        <ul className="mt-2 flex flex-col gap-1 font-mono">
          {invites?.map((i) => (
            <li key={i.code} className="flex items-center gap-2">
              <KeyRound size={14} aria-hidden className="text-muted" />
              <span className="select-all">{i.code}</span>
              <Copy size={14} aria-hidden className="text-muted" />
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                {i.role === "staff" ? <Shield size={12} aria-hidden /> : <Users size={12} aria-hidden />}
                {t(ROLE_KEY[i.role as keyof typeof ROLE_KEY])}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <ul className="flex flex-col gap-3">
        {members?.map((m) => {
          const p = name.get(m.user_id);
          const a = av.get(m.user_id);
          const status = (a?.status ?? "available") as Availability;
          return (
            <li key={m.user_id} className="card text-sm">
              <p className="flex items-center gap-2 font-semibold">
                {m.role === "staff" ? <Shield size={16} aria-hidden /> : <Users size={16} aria-hidden />}
                <span className="truncate">{p?.full_name || t("members.unnamed")}</span>
                <span className="text-xs font-normal text-muted">{t(ROLE_KEY[m.role as keyof typeof ROLE_KEY])}</span>
              </p>
              {m.role === "athlete" && (
                <form action={updateMember.bind(null, id, m.user_id)} className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1">
                    <AvailabilityIcon status={status} size={16} />
                    <select name="status" aria-label={t("members.status")} defaultValue={status} className="input input-sm">
                      {(Object.keys(AVAILABILITY_KEY) as Availability[]).map((k) => <option key={k} value={k}>{t(AVAILABILITY_KEY[k])}</option>)}
                    </select>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare size={16} aria-hidden className="text-muted" />
                    <input name="note" defaultValue={a?.note ?? ""} placeholder={t("members.note")} aria-label={t("members.note")} className="input input-sm" />
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Gauge size={16} aria-hidden className="text-muted" />
                    <input name="max_weekly_load" type="number" min={1} defaultValue={lim.get(m.user_id)?.max_weekly_load ?? ""} placeholder={t("members.maxLoad")} aria-label={t("members.maxLoad")} className="input input-sm w-32" />
                    <Link href="/help#limits" aria-label={t("common.nav.help")} className="link"><CircleHelp size={14} aria-hidden /></Link>
                  </span>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" name="consent" defaultChecked={m.consent_given} />
                    <ShieldCheck size={16} aria-hidden />{t("members.consent")}
                  </label>
                  <button className="btn inline-flex items-center gap-1"><Check size={16} aria-hidden />{t("common.save")}</button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
