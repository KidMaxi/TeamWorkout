import Link from "next/link";
import { Calendar, Check, ChevronDown, CircleHelp, ClipboardList, Clock, Flame, Gauge, Play, Plus, Tag, Type, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { SessionType } from "@/lib/load";
import { SessionTypeIcon } from "@/components/icons";
import { getT } from "@/lib/i18n/server";
import { SESSION_TYPE_KEY, dateLocale } from "@/lib/i18n";
import { createSession, deleteMyLog, deleteSession, logSession } from "@/app/actions";
import { ConfirmButton } from "@/components/ConfirmButton";

const label = "eyebrow flex items-center gap-1.5";

function Field({ icon: Icon, text, children }: { icon: typeof Tag; text: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={label}><Icon size={12} aria-hidden />{text}</span>
      {children}
    </label>
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

  const { data: team } = await supabase.from("teams").select("club_id").eq("id", id).single();
  const { data: sessions } = await supabase
    .from("sessions").select("*").eq("team_id", id).order("starts_at", { ascending: false }).limit(60);
  const { data: logs } = await supabase
    .from("session_logs").select("*").eq("user_id", user!.id)
    .in("session_id", (sessions ?? []).map((s) => s.id));
  const logBySession = new Map(logs?.map((l) => [l.session_id, l]));

  // Club workouts: the plan form picks from them, gym session cards show the linked one.
  const { data: workouts } = team?.club_id
    ? await supabase.from("workouts").select("id, name").eq("club_id", team.club_id).is("archived_at", null).order("name")
    : { data: [] };
  const linkedIds = [...new Set((sessions ?? []).map((s) => s.workout_id as string | null).filter((v): v is string => !!v))];
  const { data: linked } = linkedIds.length
    ? await supabase.from("workouts").select("id, name").in("id", linkedIds)
    : { data: [] };
  const workoutName = new Map((linked ?? []).map((w) => [w.id as string, w.name as string]));

  // Athletes who are excluded from a session do not get a start link.
  const isAthlete = me?.role === "athlete";
  const { data: excl } = isAthlete && linkedIds.length
    ? await supabase.from("session_exclusions").select("session_id").eq("user_id", user!.id)
        .in("session_id", (sessions ?? []).map((s) => s.id))
    : { data: [] };
  const excluded = new Set((excl ?? []).map((e) => e.session_id as string));
  const now = Date.now();
  const loc = dateLocale(locale);

  const all = sessions ?? [];
  const todayKey = new Date().toDateString();
  const upcoming = all.filter((s) => new Date(s.starts_at).getTime() > now).reverse();
  const past = all.filter((s) => new Date(s.starts_at).getTime() <= now);

  function renderSession(s: (typeof all)[number], isPast: boolean) {
    const log = logBySession.get(s.id);
    const d = new Date(s.starts_at);
    const typeLabel = t(SESSION_TYPE_KEY[s.type as SessionType]);
    const wName = s.type === "gym" && s.workout_id ? workoutName.get(s.workout_id) : undefined;
    const canStart = !!wName && isAthlete && !excluded.has(s.id) && (isPast || d.toDateString() === todayKey);
    return (
      <li key={s.id} className="card flex flex-col gap-3 text-sm">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid size-11 shrink-0 place-items-center rounded-full text-[var(--accent)]"
            style={{
              background: "linear-gradient(145deg, var(--surface-3), var(--surface-2))",
              boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent)",
            }}
          >
            <SessionTypeIcon type={s.type as SessionType} size={20} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="truncate font-semibold">
              {typeLabel}{s.title ? ` · ${s.title}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="chip"><Clock size={12} aria-hidden />{d.toLocaleTimeString(loc, { timeStyle: "short" })}</span>
              <span className="chip">{s.planned_duration_min} {t("common.min")}{s.planned_rpe ? ` · ${t("sessions.rpe")} ${s.planned_rpe}` : ""}</span>
              {s.planned_rpe ? (
                <span className="chip" title={t("sessions.plannedLoad")}>
                  <Flame size={12} aria-hidden className="text-[var(--accent)]" />{s.planned_rpe * s.planned_duration_min}
                </span>
              ) : null}
              {wName && (
                <span className="chip max-w-full" title={t("sessions.workout")}>
                  <ClipboardList size={12} aria-hidden className="shrink-0 text-[var(--accent)]" />
                  <span className="sr-only">{t("sessions.workout")}: </span>
                  <span className="truncate">{wName}</span>
                </span>
              )}
            </div>
            {isStaff && wName && s.type === "gym" && (
              <div className="flex flex-wrap gap-x-4">
                <Link href={`/team/${id}/kiosk/${s.id}`} className="link inline-flex min-h-11 items-center text-sm">{t("sessions.ipadMode")}</Link>
                <Link href={`/team/${id}/review/${s.id}`} className="link inline-flex min-h-11 items-center text-sm">{t("sessions.reviewLink")}</Link>
              </div>
            )}
            {canStart && (
              <Link href={`/team/${id}/workout/${s.id}`} className="btn btn-primary inline-flex min-h-11 w-fit items-center gap-2">
                <Play size={16} aria-hidden />{t("sessions.startWorkout")}
              </Link>
            )}
          </div>
          <div className="flex shrink-0 items-start gap-1">
            <div className="flex w-10 flex-col items-center gap-1 pt-0.5 text-center">
              <span className="num text-2xl">{d.toLocaleDateString(loc, { day: "numeric" })}</span>
              <span className="eyebrow">{d.toLocaleDateString(loc, { month: "short" }).replace(".", "")}</span>
            </div>
            {isStaff && (
              <ConfirmButton
                action={deleteSession.bind(null, id, s.id)}
                icon="trash"
                iconOnly
                label={t("common.delete")}
                title={t("danger.session.title")}
                body={t("danger.session.body")}
                className="-mr-2 -mt-1"
              />
            )}
          </div>
        </div>

        {isPast && (
          <details open={!log} className="group border-t pt-3">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
              <span className={label}>{t("sessions.yourLog")}</span>
              {log ? (
                <span className="flex items-center gap-2">
                  <span className="sr-only">{t("common.saved")}</span>
                  <Check size={14} aria-hidden className="text-[var(--ok)]" />
                  <span className="text-muted">{log.attended ? t("sessions.present") : t("sessions.absent")}</span>
                  <span className="num text-xl">{log.load}</span>
                  <span className="text-xs text-muted">{t("sessions.load")}</span>
                  <ChevronDown size={16} aria-hidden className="text-muted transition-transform group-open:rotate-180" />
                  <span className="sr-only">{t("sessions.change")}</span>
                </span>
              ) : (
                <ChevronDown size={16} aria-hidden className="text-muted transition-transform group-open:rotate-180" />
              )}
            </summary>
            <form action={logSession.bind(null, id, s.id)} className="mt-3 flex flex-col gap-4">
              <label className="group/seg block cursor-pointer">
                <input type="checkbox" name="attended" defaultChecked={log?.attended ?? true} className="peer sr-only" />
                <span
                  className="grid grid-cols-2 gap-1 rounded-2xl border p-1 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)]"
                  style={{ background: "var(--surface-2)" }}
                >
                  <span className="flex min-h-11 items-center justify-center gap-2 rounded-xl font-semibold bg-[var(--surface-3)] text-foreground group-has-[:checked]/seg:bg-transparent group-has-[:checked]/seg:text-muted">
                    <X size={16} aria-hidden />{t("sessions.absent")}
                  </span>
                  <span className="flex min-h-11 items-center justify-center gap-2 rounded-xl font-semibold text-muted group-has-[:checked]/seg:bg-[var(--primary)] group-has-[:checked]/seg:text-[var(--on-primary)]">
                    <Check size={16} aria-hidden />{t("sessions.present")}
                  </span>
                </span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <Field icon={Clock} text={`${t("sessions.minutes")}`}>
                  <input name="duration_min" type="number" inputMode="numeric" min={1} max={600} defaultValue={log?.duration_min ?? s.planned_duration_min} className="input num h-14 text-center text-2xl" />
                </Field>
                <div className="flex flex-col gap-1.5">
                  <span className={`${label} justify-between`}>
                    <span className="flex items-center gap-1.5"><Gauge size={12} aria-hidden />{t("sessions.rpe")}</span>
                    <Link href="/help#rpe" aria-label={t("sessions.help")} className="link -m-2.5 grid size-10 place-items-center"><CircleHelp size={14} aria-hidden /></Link>
                  </span>
                  <input name="rpe" type="number" inputMode="numeric" min={1} max={10} aria-label={t("sessions.rpe")} defaultValue={log?.rpe ?? s.planned_rpe ?? 5} className="input num h-14 text-center text-2xl" />
                </div>
              </div>

              <button className="btn btn-primary inline-flex min-h-12 w-full items-center justify-center gap-2">
                <Check size={18} aria-hidden />{t("common.save")}
              </button>
            </form>
            {log && (
              <div className="mt-2 flex justify-center">
                <ConfirmButton
                  action={deleteMyLog.bind(null, id, s.id)}
                  icon="trash"
                  label={t("danger.log.label")}
                  title={t("danger.log.title")}
                  body={t("danger.log.body")}
                  className="!min-h-10 !bg-transparent !px-3 !text-xs !text-muted hover:!text-danger"
                />
              </div>
            )}
          </details>
        )}
      </li>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      {isStaff && (
        <details className="card group !p-0">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-2 px-4 font-semibold [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2"><Plus size={18} aria-hidden className="text-[var(--accent)]" />{t("sessions.planTraining")}</span>
            <ChevronDown size={16} aria-hidden className="text-muted transition-transform group-open:rotate-180" />
          </summary>
          <form action={createSession.bind(null, id)} className="grid grid-cols-2 gap-3 border-t p-4 text-sm">
            <div className="col-span-2">
              <Field icon={Tag} text={t("sessions.type")}>
                <select name="type" className="input min-h-11 w-full">
                  {(Object.keys(SESSION_TYPE_KEY) as SessionType[]).map((k) => <option key={k} value={k}>{t(SESSION_TYPE_KEY[k])}</option>)}
                </select>
              </Field>
            </div>
            <div className="col-span-2">
              <Field icon={Type} text={`${t("sessions.titlePh")} (${t("common.optional")})`}>
                <input name="title" className="input min-h-11 w-full" />
              </Field>
            </div>
            <div className="col-span-2">
              <Field icon={Calendar} text={t("sessions.date")}>
                <input name="starts_at" type="datetime-local" required className="input min-h-11 w-full" />
              </Field>
            </div>
            {(workouts ?? []).length > 0 && (
              <div className="col-span-2">
                <Field icon={ClipboardList} text={`${t("sessions.workout")} (${t("sessions.workoutHint")})`}>
                  <select name="workout_id" defaultValue="" className="input min-h-11 w-full">
                    <option value="">{t("sessions.workoutNone")}</option>
                    {(workouts ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </Field>
              </div>
            )}
            <Field icon={Clock} text={t("sessions.minutes")}>
              <input name="planned_duration_min" type="number" inputMode="numeric" min={1} max={600} required className="input min-h-11 w-full" />
            </Field>
            <Field icon={Gauge} text={t("sessions.plannedRpe")}>
              <input name="planned_rpe" type="number" inputMode="numeric" min={1} max={10} className="input min-h-11 w-full" />
            </Field>
            <button className="btn btn-primary col-span-2 mt-1 inline-flex min-h-12 w-full items-center justify-center gap-2">
              <Plus size={18} aria-hidden />{t("sessions.plan")}
            </button>
          </form>
        </details>
      )}

      <div className="stagger flex flex-col gap-6">
        {upcoming.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="eyebrow !font-sans">{t("sessions.upcoming")}</h2>
            <ul className="flex flex-col gap-3">{upcoming.map((s) => renderSession(s, false))}</ul>
          </div>
        )}
        {past.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="eyebrow !font-sans">{t("sessions.past")}</h2>
            <ul className="flex flex-col gap-3">{past.map((s) => renderSession(s, true))}</ul>
          </div>
        )}
        {!all.length && <p className="text-muted">{t("sessions.empty")}</p>}
      </div>
    </section>
  );
}
