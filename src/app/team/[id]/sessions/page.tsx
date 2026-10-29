import { createClient } from "@/lib/supabase/server";
import { SESSION_TYPES, type SessionType } from "@/lib/load";
import { createSession, deleteSession, logSession } from "@/app/actions";

export default async function SessionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
    <section className="flex flex-col gap-6">
      {isStaff && (
        <form action={createSession.bind(null, id)} className="grid grid-cols-2 gap-2 rounded border p-3 text-sm">
          <select name="type" className="rounded border p-2 text-black">
            {Object.entries(SESSION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input name="title" placeholder="Titel (optioneel)" className="rounded border p-2 text-black" />
          <input name="starts_at" type="datetime-local" required className="rounded border p-2 text-black" />
          <input name="planned_duration_min" type="number" min={1} max={600} required placeholder="Minuten" className="rounded border p-2 text-black" />
          <input name="planned_rpe" type="number" min={1} max={10} placeholder="Geplande RPE (1-10)" className="rounded border p-2 text-black" />
          <button className="rounded bg-emerald-600 p-2 font-semibold text-white">Plan training</button>
        </form>
      )}

      <ul className="flex flex-col gap-3">
        {sessions?.map((s) => {
          const past = new Date(s.starts_at).getTime() <= now;
          const log = logBySession.get(s.id);
          return (
            <li key={s.id} className="rounded border p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-semibold">
                  {SESSION_TYPES[s.type as SessionType]} {s.title}
                </span>
                <span className="opacity-60">{new Date(s.starts_at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}</span>
              </div>
              <p className="opacity-60">
                Gepland: {s.planned_duration_min} min{s.planned_rpe ? `, RPE ${s.planned_rpe}` : ""}
                {s.planned_rpe ? ` (load ${s.planned_rpe * s.planned_duration_min} per atleet)` : ""}
              </p>
              {past && (
                <form action={logSession.bind(null, id, s.id)} className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" name="attended" defaultChecked={log?.attended ?? true} /> Aanwezig
                  </label>
                  <input name="duration_min" type="number" min={1} max={600} defaultValue={log?.duration_min ?? s.planned_duration_min} className="w-20 rounded border p-1 text-black" />
                  <span>min, RPE</span>
                  <input name="rpe" type="number" min={1} max={10} defaultValue={log?.rpe ?? s.planned_rpe ?? 5} className="w-16 rounded border p-1 text-black" />
                  <button className="rounded border px-3 py-1">{log ? `Opgeslagen (${log.load})` : "Opslaan"}</button>
                </form>
              )}
              {isStaff && (
                <form action={deleteSession.bind(null, id, s.id)} className="mt-2">
                  <button className="text-xs text-red-500 underline">Verwijderen</button>
                </form>
              )}
            </li>
          );
        })}
        {!sessions?.length && <li className="opacity-60">Nog geen trainingen gepland.</li>}
      </ul>
    </section>
  );
}
