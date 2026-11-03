import Link from "next/link";
import { notFound } from "next/navigation";
import { BedDouble, ClipboardX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/roles";
import { getAuthUser, getMembership, getT } from "@/lib/auth-cache";
import { loadRunData } from "@/lib/run-data";
import { KioskFrame } from "@/components/KioskGrid";
import { KioskRunner } from "@/components/KioskRunner";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Calm({ icon: Icon, title, body, exitHref, href, back }: {
  icon: typeof ClipboardX; title: string; body: string; exitHref: string; href: string; back: string;
}) {
  return (
    <KioskFrame exitHref={exitHref}>
      <section className="rise card card-hero mx-auto flex w-full max-w-xl flex-col items-start gap-3">
        <span aria-hidden className="grid size-11 place-items-center rounded-full text-[var(--accent)]" style={{ background: "var(--surface-2)" }}>
          <Icon size={20} />
        </span>
        <h1 className="display text-3xl leading-tight">{title}</h1>
        <p className="text-muted">{body}</p>
        <Link href={href} className="btn btn-primary inline-flex min-h-14 items-center px-6">{back}</Link>
      </section>
    </KioskFrame>
  );
}

export default async function KioskAthletePage({ params }: { params: Promise<{ id: string; sessionId: string; userId: string }> }) {
  const { id, sessionId, userId: uid } = await params;
  if (!UUID.test(id) || !UUID.test(sessionId) || !UUID.test(uid)) notFound();
  const supabase = await createClient();
  const [{ t }, user] = await Promise.all([getT(), getAuthUser()]);
  if (!user) notFound();

  const exitHref = `/team/${id}/sessions`;
  const gridHref = `/team/${id}/kiosk/${sessionId}`;
  // One round trip for every check and lookup the page needs; nothing is shown unless the staff and athlete checks pass.
  const [me, athlete, { data: session }, { data: excluded }, { data: team }, { data: profile }] = await Promise.all([
    getMembership(id, user.id),
    getMembership(id, uid),
    supabase.from("sessions").select("id, type, title, workout_id").eq("id", sessionId).eq("team_id", id).neq("status", "cancelled").maybeSingle(),
    supabase.from("session_exclusions").select("user_id").eq("session_id", sessionId).eq("user_id", uid).maybeSingle(),
    supabase.from("teams").select("kiosk_pin_required").eq("id", id).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", uid).maybeSingle(),
  ]);

  // Staff only. The PIN is checked by the server actions, never by this page.
  if (!can(me?.staffKind, "manageLibrary")) notFound();
  if (athlete?.role !== "athlete") notFound();
  if (!session) notFound();

  const calm = (icon: typeof ClipboardX, title: string, body: string) => (
    <Calm icon={icon} title={title} body={body} exitHref={exitHref} href={gridHref} back={t("kiosk.run.back")} />
  );
  if (session.type !== "gym" || !session.workout_id) return calm(ClipboardX, t("run.noWorkout.title"), t("run.noWorkout.body"));
  if (excluded) return calm(BedDouble, t("kiosk.status.rest"), t("run.excluded.body"));

  const athleteName = (profile?.full_name as string | null)?.trim() || t("members.unnamed");

  const { workout, blocks, saved, prev, run, log } = await loadRunData(supabase, { sessionId, uid, workoutId: session.workout_id });
  if (!workout) return calm(ClipboardX, t("run.noWorkout.title"), t("run.noWorkout.body"));

  const workoutName = (workout.name ?? workout.title ?? session.title ?? "").toString();

  return (
    <KioskFrame exitHref={exitHref}>
      <KioskRunner
        teamId={id}
        sessionId={sessionId}
        userId={uid}
        athleteName={athleteName}
        requirePin={team?.kiosk_pin_required === true}
        gridHref={gridHref}
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
    </KioskFrame>
  );
}
