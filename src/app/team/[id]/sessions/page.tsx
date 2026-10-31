import Link from "next/link";
import { Check, ChevronDown, CircleHelp, ClipboardList, Clock, Flame, Gauge, MapPin, Play, Repeat, Tag, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { SessionType } from "@/lib/load";
import { SessionTypeIcon } from "@/components/icons";
import { getT } from "@/lib/i18n/server";
import { SESSION_TYPE_KEY, dateLocale } from "@/lib/i18n";
import { deleteMyLog, logSession } from "@/app/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SessionsTabs } from "@/components/SessionsTabs";
import { PlanSessionCard, SessionManage } from "@/components/SessionPlanner";
import { SESSION_TYPE_LIST } from "@/lib/load";
import { canPlanType, getStaffKind } from "@/lib/roles";
import { TIME_ZONE, isFocus, isStatus, localDay, localTime, type SessionStatus } from "@/lib/session-plan";
import type { MessageKey } from "@/lib/i18n";

const STATUS_BADGE: Record<SessionStatus, string> = { planned: "badge-none", completed: "badge-ok", adjusted: "badge-watch", cancelled: "badge-high" };

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
  const kind = await getStaffKind(supabase, id, user!.id);
  const allowedTypes = SESSION_TYPE_LIST.filter((ty) => canPlanType(kind, ty));
  const canPlan = allowedTypes.length > 0;
  const today = localDay(new Date().toISOString());

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
  const adjusterIds = [...new Set((sessions ?? []).filter((s) => s.status === "adjusted" && s.updated_by).map((s) => s.updated_by as string))];
  const { data: adjusters } = adjusterIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", adjusterIds)
    : { data: [] };
  const adjusterName = new Map((adjusters ?? []).map((p) => [p.id as string, (p.full_name as string) || ""]));
  const now = Date.now();
  const loc = dateLocale(locale);

  const workoutList = (workouts ?? []) as { id: string; name: string }[];
  const all = sessions ?? [];
  const upcoming = all.filter((s) => new Date(s.starts_at).getTime() > now).reverse();
  const past = all.filter((s) => new Date(s.starts_at).getTime() <= now);

  function renderSession(s: (typeof all)[number], isPast: boolean) {
    const log = logBySession.get(s.id);
    const d = new Date(s.starts_at);
    const typeLabel = t(SESSION_TYPE_KEY[s.type as SessionType]);
    const wName = s.type === "gym" && s.workout_id ? workoutName.get(s.workout_id) : undefined;
    const status: SessionStatus = isStatus(s.status) ? s.status : "planned";
    const cancelled = status === "cancelled";
    const focus = ((s.focus ?? []) as string[]).filter(isFocus);
    const canStart = !cancelled && !!wName && isAthlete && !excluded.has(s.id) && (isPast || localDay(s.starts_at) === today);
    const canManage = canPlan && canPlanType(kind, s.type);
    const adjustedAt = s.updated_at ? new Date(s.updated_at).toLocaleDateString(loc, { day: "numeric", month: "short", timeZone: TIME_ZONE }) : "";
    const adjustedBy = s.updated_by ? adjusterName.get(s.updated_by) : "";
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
            <p className={`truncate font-semibold ${cancelled ? "text-muted line-through" : ""}`}>
              {typeLabel}{s.title ? ` · ${s.title}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {status !== "planned" && <span className={`badge ${STATUS_BADGE[status]}`}>{t(`sessions.status.${status}` as MessageKey)}</span>}
              {s.series_id && <span className="chip"><Repeat size={12} aria-hidden />{t("sessions.series")}</span>}
              <span className="chip"><Clock size={12} aria-hidden />{localTime(s.starts_at).hm}</span>
              <span className="chip">{s.planned_duration_min} {t("common.min")}{s.planned_rpe ? ` · ${t("sessions.rpe")} ${s.planned_rpe}` : ""}</span>
              {s.planned_rpe && !cancelled ? (
                <span className="chip" title={t("sessions.plannedLoad")}>
                  <Flame size={12} aria-hidden className="text-[var(--accent)]" />{s.planned_rpe * s.planned_duration_min}
                </span>
              ) : null}
              {s.location && <span className="chip max-w-full"><MapPin size={12} aria-hidden className="shrink-0" /><span className="truncate">{s.location}</span></span>}
              {focus.map((f) => <span key={f} className="chip">{t(`sessions.focus.${f}` as MessageKey)}</span>)}
              {wName && (
                <span className="chip max-w-full" title={t("sessions.workout")}>
                  <ClipboardList size={12} aria-hidden className="shrink-0 text-[var(--accent)]" />
                  <span className="sr-only">{t("sessions.workout")}: </span>
                  <span className="truncate">{wName}</span>
                </span>
              )}
            </div>
            {s.coach_note && <p className="text-muted">{s.coach_note}</p>}
            {status === "adjusted" && s.updated_at && (
              <p className="text-xs text-muted">
                {adjustedBy ? t("sessions.adjustedBy", { name: adjustedBy, date: adjustedAt }) : t("sessions.adjustedOn", { date: adjustedAt })}
              </p>
            )}
            {isStaff && wName && s.type === "gym" && !cancelled && (
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
              <span className="num text-2xl">{d.toLocaleDateString(loc, { day: "numeric", timeZone: TIME_ZONE })}</span>
              <span className="eyebrow">{d.toLocaleDateString(loc, { month: "short", timeZone: TIME_ZONE }).replace(".", "")}</span>
            </div>
          </div>
        </div>

        {canManage && (
          <SessionManage
            teamId={id}
            allowedTypes={allowedTypes}
            workouts={workoutList}
            today={today}
            session={{
              id: s.id, type: s.type as SessionType, day: localDay(s.starts_at), time: localTime(s.starts_at).hm,
              duration: s.planned_duration_min, rpe: s.planned_rpe, focus, location: s.location ?? null, note: s.coach_note ?? null,
              workoutId: s.workout_id ?? null, status, inSeries: !!s.series_id,
            }}
          />
        )}

        {cancelled && isPast && <p className="border-t pt-3 text-xs text-muted">{t("sessions.noLogNeeded")}</p>}

        {isPast && !cancelled && (
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
      <SessionsTabs teamId={id} />
      {canPlan && <PlanSessionCard teamId={id} allowedTypes={allowedTypes} workouts={workoutList} today={today} />}

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
