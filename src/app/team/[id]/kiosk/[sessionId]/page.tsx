import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { KioskFrame, KioskGrid, type KioskAthlete } from "@/components/KioskGrid";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function KioskGridPage({ params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const { id, sessionId } = await params;
  if (!UUID.test(id) || !UUID.test(sessionId)) notFound();
  const { t } = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: me } = await supabase
    .from("team_members").select("role").eq("team_id", id).eq("user_id", user.id).maybeSingle();
  if (me?.role !== "staff") notFound();

  const exitHref = `/team/${id}/sessions`;
  const { data: session } = await supabase
    .from("sessions").select("id, type, title, workout_id").eq("id", sessionId).eq("team_id", id).maybeSingle();
  if (!session) notFound();
  if (session.type !== "gym" || !session.workout_id) {
    return (
      <KioskFrame exitHref={exitHref}>
        <section className="rise card card-hero mx-auto flex w-full max-w-xl flex-col items-start gap-3">
          <span aria-hidden className="grid size-11 place-items-center rounded-full text-[var(--accent)]" style={{ background: "var(--surface-2)" }}>
            <ClipboardX size={20} />
          </span>
          <h1 className="display text-3xl leading-tight">{t("run.noWorkout.title")}</h1>
          <p className="text-muted">{t("run.noWorkout.body")}</p>
          <Link href={`/team/${id}/kiosk`} className="btn btn-primary inline-flex min-h-14 items-center px-6">{t("kiosk.grid.switch")}</Link>
        </section>
      </KioskFrame>
    );
  }

  const [{ data: members }, { data: excl }, { data: runs }, { data: workout }] = await Promise.all([
    supabase.from("team_members").select("user_id").eq("team_id", id).eq("role", "athlete"),
    supabase.from("session_exclusions").select("user_id").eq("session_id", sessionId),
    supabase.from("workout_runs").select("user_id, finished_at").eq("session_id", sessionId),
    supabase.from("workouts").select("*").eq("id", session.workout_id).maybeSingle(),
  ]);
  const ids = (members ?? []).map((m) => m.user_id as string);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string | null)?.trim() || ""]));
  const excluded = new Set((excl ?? []).map((e) => e.user_id as string));
  const runOf = new Map((runs ?? []).map((r) => [r.user_id as string, r]));

  const athletes: KioskAthlete[] = ids
    .map((uid) => {
      const run = runOf.get(uid);
      const status: KioskAthlete["status"] = excluded.has(uid)
        ? "rest"
        : run ? (run.finished_at ? "done" : "running") : "todo";
      return { id: uid, name: names.get(uid) || t("members.unnamed"), status };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const w = (workout ?? {}) as { name?: string | null; title?: string | null };
  const title = (w.name ?? w.title ?? session.title ?? "").toString();

  return (
    <KioskFrame exitHref={exitHref}>
      <section className="rise flex flex-col gap-5">
        <div>
          <p className="eyebrow">{t("kiosk.grid.eyebrow")}</p>
          <h1 className="display mt-2 text-4xl leading-tight">{title}</h1>
        </div>
        <KioskGrid teamId={id} sessionId={sessionId} athletes={athletes} />
        <Link href={`/team/${id}/kiosk`} className="link inline-flex min-h-11 w-fit items-center text-sm">{t("kiosk.grid.switch")}</Link>
      </section>
    </KioskFrame>
  );
}
