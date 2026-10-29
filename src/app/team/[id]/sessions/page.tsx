import Link from "next/link";
import { Activity, Calendar, Check, CircleHelp, Clock, Flame, Gauge, Plus, Tag, Type, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { SessionType } from "@/lib/load";
import { SessionTypeIcon } from "@/components/icons";
import { getT } from "@/lib/i18n/server";
import { SESSION_TYPE_KEY, dateLocale } from "@/lib/i18n";
import { createSession, deleteMyLog, deleteSession, logSession } from "@/app/actions";
import { ConfirmButton } from "@/components/ConfirmButton";

const chip = "inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10";

function Field({ icon: Icon, children }: { icon: typeof Tag; children: React.ReactNode }) {
  return (
    <div className="relative">
      <Icon size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      {children}
    </div>
  );
}

export default async function SessionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, locale } = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("team_members").select("role").eq("team_id", id).eq("user_id", user!.id).single();
  const isStaff = me?.role === "staff";

  const { data: sessions } = await supabase
    .from("sessions").select("*").eq("team_id", id).order("starts_at", { ascending: false }).limit(60);
  const { data: logs } = await supabase
    .from("session_logs").select("*").eq("user_id", user!.id)
    .in("session_id", (sessions ?? []).map((s) => s.id));
  const logBySession = new Map(logs?.map((l) => [l.session_id, l]));
  const now = Date.now();

  return (
    <section className="flex flex-col gap-4">
      {isStaff && (
        <form action={createSession.bind(null, id)} className="card grid grid-cols-2 gap-2 text-sm">
          <Field icon={Tag}>
            <select name="type" aria-label={t("sessions.type")} className="input w-full pl-9">
              {(Object.keys(SESSION_TYPE_KEY) as SessionType[]).map((k) => <option key={k} value={k}>{t(SESSION_TYPE_KEY[k])}</option>)}
            </select>
          </Field>
          <Field icon={Type}>
            <input name="title" placeholder={`${t("sessions.titlePh")} (${t("common.optional")})`} aria-label={t("sessions.titlePh")} className="input w-full pl-9" />
          </Field>
          <Field icon={Calendar}>
            <input name="starts_at" type="datetime-local" required aria-label={t("sessions.date")} className="input w-full pl-9" />
          </Field>
          <Field icon={Clock}>
            <input name="planned_duration_min" type="number" min={1} max={600} required placeholder={t("common.min")} aria-label={t("sessions.minutes")} className="input w-full pl-9" />
          </Field>
          <Field icon={Gauge}>
            <input name="planned_rpe" type="number" min={1} max={10} placeholder={t("sessions.rpe")} aria-label={t("sessions.plannedRpe")} className="input w-full pl-9" />
          </Field>
          <button className="btn btn-primary inline-flex items-center justify-center gap-1"><Plus size={16} aria-hidden />{t("sessions.plan")}</button>
        </form>
      )}

      <ul className="flex flex-col gap-3">
        {sessions?.map((s) => {
          const past = new Date(s.starts_at).getTime() <= now;
          const log = logBySession.get(s.id);
          return (
            <li key={s.id} className="card flex flex-col gap-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 font-semibold">
                  <SessionTypeIcon type={s.type as SessionType} size={18} className="shrink-0" />
                  <span className="truncate">{t(SESSION_TYPE_KEY[s.type as SessionType])}{s.title ? ` · ${s.title}` : ""}</span>
                </span>
                {isStaff && (
                  <ConfirmButton
                    action={deleteSession.bind(null, id, s.id)}
                    icon="trash"
                    iconOnly
                    label={t("common.delete")}
                    title={t("danger.session.title")}
                    body={t("danger.session.body")}
                  />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-muted">
                <span className={chip}><Calendar size={12} aria-hidden />{new Date(s.starts_at).toLocaleString(dateLocale(locale), { dateStyle: "short", timeStyle: "short" })}</span>
                <span className={chip}><Clock size={12} aria-hidden />{s.planned_duration_min} {t("common.min")}{s.planned_rpe ? ` · ${t("sessions.rpe")} ${s.planned_rpe}` : ""}</span>
                {s.planned_rpe ? <span className={chip} title={t("sessions.load")}><Flame size={12} aria-hidden />{s.planned_rpe * s.planned_duration_min}</span> : null}
              </div>
              {past && (
                <form action={logSession.bind(null, id, s.id)} className="flex flex-wrap items-center gap-2">
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input type="checkbox" name="attended" defaultChecked={log?.attended ?? true} className="peer sr-only" />
                    <span className="btn inline-flex items-center gap-1 peer-checked:hidden peer-focus-visible:outline"><X size={16} aria-hidden />{t("sessions.absent")}</span>
                    <span className="btn btn-primary hidden items-center gap-1 peer-checked:inline-flex peer-focus-visible:outline"><Check size={16} aria-hidden />{t("sessions.present")}</span>
                  </label>
                  <input name="duration_min" type="number" min={1} max={600} aria-label={t("sessions.minutes")} defaultValue={log?.duration_min ?? s.planned_duration_min} className="input input-sm w-20" />
                  <span className="text-muted">{t("common.min")}</span>
                  <input name="rpe" type="number" min={1} max={10} aria-label={t("sessions.rpe")} defaultValue={log?.rpe ?? s.planned_rpe ?? 5} className="input input-sm w-16" />
                  <span className="inline-flex items-center gap-1 text-muted">
                    {t("sessions.rpe")}
                    <Link href="/help#rpe" aria-label={t("common.nav.help")} className="link"><CircleHelp size={14} aria-hidden /></Link>
                  </span>
                  <button className="btn inline-flex items-center gap-1">
                    <Check size={16} aria-hidden />
                    {log ? <><span className="sr-only">{t("common.saved")}</span><Activity size={14} aria-hidden />{log.load}</> : t("common.save")}
                  </button>
                </form>
              )}
              {past && log && (
                <div>
                  <ConfirmButton
                    action={deleteMyLog.bind(null, id, s.id)}
                    icon="trash"
                    label={t("danger.log.label")}
                    title={t("danger.log.title")}
                    body={t("danger.log.body")}
                    className="!px-2 !py-1 text-xs"
                  />
                </div>
              )}
            </li>
          );
        })}
        {!sessions?.length && <li className="text-muted">{t("sessions.empty")}</li>}
      </ul>
    </section>
  );
}
