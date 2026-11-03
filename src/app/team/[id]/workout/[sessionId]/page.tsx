import Link from "next/link";
import { notFound } from "next/navigation";
import { BedDouble, ClipboardX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Hint } from "@/components/Hint";
import { getAuthUser, getMembership, getT } from "@/lib/auth-cache";
import { loadRunData } from "@/lib/run-data";
import { WorkoutRunner } from "@/components/WorkoutRunner";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Calm({ icon: Icon, title, body, href, back }: {
  icon: typeof ClipboardX; title: string; body: string; href: string; back: string;
}) {
  return (
    <section className="rise flex flex-col gap-4">
      <div className="card card-hero flex flex-col items-start gap-3">
        <span aria-hidden className="grid size-11 place-items-center rounded-full text-[var(--accent)]" style={{ background: "var(--surface-2)" }}>
          <Icon size={20} />
        </span>
        <h2 className="display text-2xl leading-tight">{title}</h2>
        <p className="text-muted">{body}</p>
        <Link href={href} className="link inline-flex min-h-11 items-center">{back}</Link>
      </div>
    </section>
  );
}

export default async function WorkoutPage({ params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const { id, sessionId } = await params;
  if (!UUID.test(id) || !UUID.test(sessionId)) notFound();
  const supabase = await createClient();
  const [{ t }, user] = await Promise.all([getT(), getAuthUser()]);
  if (!user) notFound();

  const sessionsHref = `/team/${id}/sessions`;
  const [me, { data: session }, { data: excluded }] = await Promise.all([
    getMembership(id, user.id),
    supabase.from("sessions").select("id, type, title, workout_id").eq("id", sessionId).eq("team_id", id).maybeSingle(),
    supabase.from("session_exclusions").select("user_id").eq("session_id", sessionId).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!me) notFound();
  if (!session) notFound();

  if (session.type !== "gym" || !session.workout_id) {
    return <Calm icon={ClipboardX} title={t("run.noWorkout.title")} body={t("run.noWorkout.body")} href={sessionsHref} back={t("run.back")} />;
  }
  if (excluded) {
    return <Calm icon={BedDouble} title={t("run.excluded.title")} body={t("run.excluded.body")} href={sessionsHref} back={t("run.back")} />;
  }

  const { workout, blocks, saved, prev, run, log } = await loadRunData(supabase, { sessionId, uid: user.id, workoutId: session.workout_id });
  if (!workout) {
    return <Calm icon={ClipboardX} title={t("run.noWorkout.title")} body={t("run.noWorkout.body")} href={sessionsHref} back={t("run.back")} />;
  }

  const workoutName = (workout.name ?? workout.title ?? session.title ?? "").toString();

  return (
    <div className="flex flex-col gap-4">
    <Hint id="workout-run" text={t("run.hint.text")} />
    <WorkoutRunner
      teamId={id}
      sessionId={sessionId}
      sessionsHref={sessionsHref}
      queueScope={`${user.id}:${sessionId}`}
      workoutName={workoutName}
      blocks={blocks}
      saved={saved}
      prev={prev}
      startedAt={run?.started_at ?? null}
      finished={
        run?.finished_at
          ? {
              durationMin: log?.duration_min ?? Math.max(1, Math.round(Number(run.active_seconds ?? 0) / 60)),
              rpe: log?.rpe ?? null,
              sets: saved.filter((s) => s.setType !== "warmup").length,
            }
          : null
      }
    />
    </div>
  );
}
