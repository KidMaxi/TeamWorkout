import Link from "next/link";
import { Check, ChevronDown, Clock, Gauge, MessageSquare, Play, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { SessionType } from "@/lib/load";
import { SessionTypeIcon } from "@/components/icons";
import { getAuthUser, getMembership, getT } from "@/lib/auth-cache";
import { SESSION_TYPE_KEY, dateLocale } from "@/lib/i18n";
import { deleteMyLog, logSession } from "@/app/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { MinutesStepper } from "@/components/QuickLog";
import { RpePicker } from "@/components/RpePicker";
import { SessionsTabs } from "@/components/SessionsTabs";
import { PlanSessionCard, SessionManage } from "@/components/SessionPlanner";
import { SESSION_TYPE_LIST } from "@/lib/load";
import { canPlanType } from "@/lib/roles";
import { TIME_ZONE, addDays, isFocus, isStatus, localDay, localTime, type SessionStatus } from "@/lib/session-plan";
import type { MessageKey } from "@/lib/i18n";

const STATUS_BADGE: Record<SessionStatus, string> = { planned: "badge-none", completed: "badge-ok", adjusted: "badge-watch", cancelled: "badge-high" };

const label = "eyebrow flex items-center gap-1.5";

export default async function SessionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ t, locale }, user] = await Promise.all([getT(), getAuthUser()]);
  const [me, { data: team }, { data: sessions }] = await Promise.all([
    getMembership(id, user!.id),
    supabase.from("teams").select("club_id").eq("id", id).single(),
    supabase
      .from("sessions")
      .select("id, type, title, starts_at, planned_duration_min, planned_rpe, status, focus, location, coach_note, series_id, updated_at, updated_by, workout_id")
      .eq("team_id", id).order("starts_at", { ascending: false }).limit(60),
  ]);
  const isStaff = me?.role === "staff";
  const kind = me?.staffKinds ?? [];
  const allowedTypes = SESSION_TYPE_LIST.filter((ty) => canPlanType(kind, ty));
  const canPlan = allowedTypes.length > 0;
  const today = localDay(new Date().toISOString());
  const isAthlete = me?.role === "athlete";

  const sessionIds = (sessions ?? []).map((s) => s.id as string);
  const linkedIds = [...new Set((sessions ?? []).map((s) => s.workout_id as string | null).filter((v): v is string => !!v))];
  const adjusterIds = [...new Set((sessions ?? []).filter((s) => s.status === "adjusted" && s.updated_by).map((s) => s.updated_by as string))];
  // Everything below only needs the session list, so it is fetched in one round trip.
  const none = Promise.resolve({ data: [] as never[] });
  const [{ data: logs }, { data: workouts }, { data: linked }, { data: excl }, { data: adjusters }] = await Promise.all([
    sessionIds.length
      ? supabase.from("session_logs").select("session_id, attended, load, duration_min, rpe, note").eq("user_id", user!.id).in("session_id", sessionIds)
      : none,
    // Club workouts: the plan form picks from them, gym session cards show the linked one. Only planners see the form.
    canPlan && team?.club_id
      ? supabase.from("workouts").select("id, name").eq("club_id", team.club_id).is("archived_at", null).order("name")
      : none,
    linkedIds.length ? supabase.from("workouts").select("id, name").in("id", linkedIds) : none,
    // Athletes who are excluded from a session do not get a start link.
    isAthlete && sessionIds.length
      ? supabase.from("session_exclusions").select("session_id").eq("user_id", user!.id).in("session_id", sessionIds)
      : none,
    adjusterIds.length ? supabase.from("profiles").select("id, full_name").in("id", adjusterIds) : none,
  ]);
  const logBySession = new Map((logs ?? []).map((l) => [l.session_id, l]));
  const workoutName = new Map((linked ?? []).map((w) => [w.id as string, w.name as string]));
  const excluded = new Set((excl ?? []).map((e) => e.session_id as string));
  const adjusterName = new Map((adjusters ?? []).map((p) => [p.id as string, (p.full_name as string) || ""]));
  const now = Date.now();
  const loc = dateLocale(locale);

  const workoutList = (workouts ?? []) as { id: string; name: string }[];
  // Athletes only see sessions they take part in; staff see the whole team schedule.
  const all = (sessions ?? []).filter((s) => !(isAthlete && excluded.has(s.id)));
  const day = (s: (typeof all)[number]) => localDay(s.starts_at);
  const soonEnd = addDays(today, 14);
  const recentStart = addDays(today, -7);
  // Default view: today + next 14 days and the last 7 days; the rest sits one tap deeper.
  const coming = all.filter((s) => day(s) >= today && day(s) <= soonEnd).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const recent = all.filter((s) => day(s) < today && day(s) >= recentStart); // already newest first
  const older = all.filter((s) => day(s) < recentStart);
  const later = all.filter((s) => day(s) > soonEnd).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const statusSet = new Set(all.map((s) => (isStatus(s.status) ? s.status : "planned")));
  // No badge when every session has the same status.
  const hideStatus = statusSet.size <= 1;

  function renderSession(s: (typeof all)[number], isPast: boolean) {
    const log = logBySession.get(s.id);
    const typeLabel = t(SESSION_TYPE_KEY[s.type as SessionType]);
    const wName = s.type === "gym" && s.workout_id ? workoutName.get(s.workout_id) : undefined;
    const status: SessionStatus = isStatus(s.status) ? s.status : "planned";
    const cancelled = status === "cancelled";
    const focus = ((s.focus ?? []) as string[]).filter(isFocus);
    const canStart = !cancelled && !!wName && isAthlete && !excluded.has(s.id) && (isPast || localDay(s.starts_at) === today);
    const canManage = canPlan && canPlanType(kind, s.type);
    const adjustedAt = s.updated_at ? new Date(s.updated_at).toLocaleDateString(loc, { day: "numeric", month: "short", timeZone: TIME_ZONE }) : "";
    const adjustedBy = s.updated_by ? adjusterName.get(s.updated_by) : "";
    const meta = [
      s.title ? typeLabel : null,
      `${s.planned_duration_min} ${t("common.min")}`,
      s.planned_rpe ? `${t("sessions.rpe")} ${s.planned_rpe}` : null,
      isStaff && s.planned_rpe && !cancelled ? `${s.planned_rpe * s.planned_duration_min} ${t("sessions.load")}` : null,
      s.location,
      ...focus.map((f) => t(`sessions.focus.${f}` as MessageKey)),
      wName,
      s.series_id ? t("sessions.series") : null,
    ].filter(Boolean).join(" · ");
    const gymLinks = isStaff && !!wName && s.type === "gym" && !cancelled;
    const sets = { href: `/team/${id}/gym/${s.id}`, label: t("gymsum.link") };
    const extra = [
      { href: `/team/${id}/kiosk/${s.id}`, label: t("sessions.ipadMode") },
      { href: `/team/${id}/review/${s.id}`, label: t("sessions.reviewLink") },
    ];
    // One primary action per state: planned -> Manage, done gym -> Logged sets (manage moves behind "...").
    const lead = gymLinks && isPast ? (
      <Link href={sets.href} className="btn inline-flex min-h-11 items-center">{sets.label}</Link>
    ) : undefined;
    const links = gymLinks ? (isPast ? extra : [...extra, sets]) : [];
    return (
      <li key={s.id} className="card flex flex-col gap-2 text-sm">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-md text-[var(--accent)]"
            style={{ background: "var(--surface-2)" }}
          >
            <SessionTypeIcon type={s.type as SessionType} size={18} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="flex items-baseline justify-between gap-2">
              <span className={`flex min-w-0 items-center gap-2 font-semibold ${cancelled ? "text-muted line-through" : ""}`}>
                <span className="truncate">{s.title || typeLabel}</span>
                {!hideStatus && status !== "planned" && <span className={`badge shrink-0 ${STATUS_BADGE[status]}`}>{t(`sessions.status.${status}` as MessageKey)}</span>}
              </span>
              <span className="num shrink-0 text-muted">{localTime(s.starts_at).hm}</span>
            </p>
            <p className="text-xs text-muted">{meta}</p>
            {s.coach_note && <p className="text-muted">{s.coach_note}</p>}
            {status === "adjusted" && s.updated_at && (
              <p className="text-xs text-muted">
                {adjustedBy ? t("sessions.adjustedBy", { name: adjustedBy, date: adjustedAt }) : t("sessions.adjustedOn", { date: adjustedAt })}
              </p>
            )}
            {canStart && (
              <Link href={`/team/${id}/workout/${s.id}`} className="btn btn-primary mt-2 inline-flex min-h-11 w-fit items-center gap-2">
                <Play size={16} aria-hidden />{t("sessions.startWorkout")}
              </Link>
            )}
          </div>
        </div>

        {canManage ? (
          <SessionManage
            teamId={id}
            allowedTypes={allowedTypes}
            workouts={workoutList}
            today={today}
            lead={lead}
            links={links}
            session={{
              id: s.id, type: s.type as SessionType, day: localDay(s.starts_at), time: localTime(s.starts_at).hm,
              duration: s.planned_duration_min, rpe: s.planned_rpe, focus, location: s.location ?? null, note: s.coach_note ?? null,
              workoutId: s.workout_id ?? null, status, inSeries: !!s.series_id,
            }}
          />
        ) : gymLinks ? (
          <div className="border-t pt-1">
            {lead}
            {!isPast && (
              <details className="group/m">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm text-muted [&::-webkit-details-marker]:hidden">
                  {t("sessions.moreActions")}
                  <ChevronDown size={16} aria-hidden className="transition-transform group-open/m:rotate-180" />
                </summary>
                <div className="flex flex-wrap gap-x-4">
                  {links.map((l) => <Link key={l.href} href={l.href} className="link inline-flex min-h-11 items-center text-sm">{l.label}</Link>)}
                </div>
              </details>
            )}
            {isPast && (
              <div className="flex flex-wrap gap-x-4">
                {links.map((l) => <Link key={l.href} href={l.href} className="link inline-flex min-h-11 items-center text-sm">{l.label}</Link>)}
              </div>
            )}
          </div>
        ) : null}

        {cancelled && isPast && <p className="border-t pt-3 text-xs text-muted">{t("sessions.noLogNeeded")}</p>}

        {isPast && !cancelled && isAthlete && !excluded.has(s.id) && (
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
                  className="grid grid-cols-2 gap-1 rounded-md border p-1 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)]"
                  style={{ background: "var(--surface-2)" }}
                >
                  <span className="flex min-h-11 items-center justify-center gap-2 rounded-md font-semibold bg-[var(--surface-3)] text-foreground group-has-[:checked]/seg:bg-transparent group-has-[:checked]/seg:text-muted">
                    <X size={16} aria-hidden />{t("sessions.absent")}
                  </span>
                  <span className="flex min-h-11 items-center justify-center gap-2 rounded-md font-semibold text-muted group-has-[:checked]/seg:bg-[var(--primary)] group-has-[:checked]/seg:text-[var(--on-primary)]">
                    <Check size={16} aria-hidden />{t("sessions.present")}
                  </span>
                </span>
              </label>

              <div className="flex flex-col gap-1.5">
                <span className={label}><Clock size={12} aria-hidden />{t("sessions.minutes")}</span>
                <MinutesStepper defaultValue={log?.duration_min ?? s.planned_duration_min} />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className={label}><Gauge size={12} aria-hidden />{t("sessions.rpe")}</span>
                <RpePicker defaultValue={log?.rpe ?? s.planned_rpe ?? 5} plannedRpe={s.planned_rpe} />
              </div>
              <label className="flex flex-col gap-1.5">
                <span className={label}><MessageSquare size={12} aria-hidden />{t("quicklog.note.label")}</span>
                <textarea
                  name="note"
                  rows={2}
                  maxLength={300}
                  defaultValue={(log?.note as string | null) ?? ""}
                  placeholder={t("quicklog.note.placeholder")}
                  className="input w-full resize-none"
                />
                <span className="text-xs text-muted">{t("quicklog.note.help")}</span>
              </label>

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

  /** Rows grouped under one heading per day. */
  function renderDays(list: typeof all) {
    const days: { day: string; items: typeof all }[] = [];
    for (const s of list) {
      const last = days[days.length - 1];
      if (last && last.day === day(s)) last.items.push(s);
      else days.push({ day: day(s), items: [s] });
    }
    return (
      <div className="flex flex-col gap-5">
        {days.map((g) => {
          const head = new Date(g.items[0].starts_at).toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long", timeZone: TIME_ZONE });
          return (
            <div key={g.day} className="flex flex-col gap-2">
              <h3 className={`eyebrow !font-sans ${g.day === today ? "!text-[var(--accent)]" : ""}`}>
                {g.day === today ? `${t("calendar.today")} · ` : ""}{head}
              </h3>
              <ul className="flex flex-col gap-2">{g.items.map((s) => renderSession(s, new Date(s.starts_at).getTime() <= now))}</ul>
            </div>
          );
        })}
      </div>
    );
  }

  const folded = (list: typeof all, key: "sessions.older" | "sessions.later") => list.length > 0 && (
    <details className="group">
      <summary className="btn flex min-h-11 w-full cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
        <span>{t(key, { n: list.length })}</span>
        <ChevronDown size={16} aria-hidden className="text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-4">{renderDays(list)}</div>
    </details>
  );

  return (
    <section className="flex flex-col gap-6">
      <SessionsTabs teamId={id} />
      {canPlan && <PlanSessionCard teamId={id} allowedTypes={allowedTypes} workouts={workoutList} today={today} />}

      <div className="stagger flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h2 className="eyebrow !font-sans">{t("sessions.comingUp")}</h2>
          {coming.length > 0 ? renderDays(coming) : <p className="text-muted">{t("calendar.empty")}</p>}
        </div>
        {later.length > 0 && folded(later, "sessions.later")}
        {recent.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="eyebrow !font-sans">{t("sessions.recent")}</h2>
            {renderDays(recent)}
          </div>
        )}
        {older.length > 0 && folded(older, "sessions.older")}
        {!all.length && <p className="text-muted">{t("sessions.empty")}</p>}
      </div>
    </section>
  );
}
