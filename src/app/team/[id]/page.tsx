import { createClient } from "@/lib/supabase/server";
import { acwrSignal, AVAILABILITY, SESSION_TYPES, type Availability, type LoadRow, type SessionType } from "@/lib/load";

const SIGNAL = {
  none: { label: "Geen baseline", cls: "badge badge-none" },
  ok: { label: "Normaal", cls: "badge badge-ok" },
  watch: { label: "Let op", cls: "badge badge-watch" },
  high: { label: "Hoog", cls: "badge badge-high" },
};

export default async function TeamOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("team_members").select("role").eq("team_id", id).eq("user_id", user!.id).single();

  if (me?.role === "staff") {
    const { data, error } = await supabase.rpc("team_load_overview", { _team: id });
    const rows = data as LoadRow[] | null;
    if (error) throw new Error(error.message);
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Teamload</h2>
        <p className="text-xs text-muted">
          Acute load = laatste 7 dagen (RPE &times; minuten). Ratio = acute / gemiddelde weekload over 28 dagen,
          pas na 4 weken data. Een indicatie, geen blessurevoorspelling.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b">
              <th className="p-2">Atleet</th><th className="p-2">Status</th>
              <th className="p-2">Acuut</th><th className="p-2">Chronisch/wk</th>
              <th className="p-2">Ratio</th><th className="p-2">Limiet</th>
            </tr></thead>
            <tbody>
              {rows?.map((r: LoadRow) => {
                const sig = SIGNAL[acwrSignal(r.acwr)];
                return (
                  <tr key={r.user_id} className="border-b">
                    <td className="p-2">{r.full_name || "Naamloos"}</td>
                    <td className="p-2">{AVAILABILITY[(r.availability ?? "available") as Availability]}</td>
                    <td className={`p-2 ${r.over_limit ? "font-bold text-danger" : ""}`}>{r.acute_load}</td>
                    <td className="p-2">{r.chronic_weekly_avg}</td>
                    <td className="p-2"><span className={sig.cls}>{r.acwr ?? "-"} {sig.label}</span></td>
                    <td className="p-2">{r.max_weekly_load ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows?.length && <p className="p-2 text-muted">Nog geen atleten. Maak een uitnodiging bij Leden.</p>}
        </div>
      </section>
    );
  }

  const since = new Date(Date.now() - 28 * 86400_000).toISOString();
  const { data: logs } = await supabase
    .from("session_logs")
    .select("load, rpe, duration_min, attended, sessions!inner(title, type, starts_at, team_id)")
    .eq("sessions.team_id", id)
    .gte("sessions.starts_at", since);
  const week = Date.now() - 7 * 86400_000;
  const weekLoad = (logs ?? [])
    .filter((l) => new Date((l.sessions as unknown as { starts_at: string }).starts_at).getTime() >= week)
    .reduce((s, l) => s + l.load, 0);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Mijn load</h2>
      <p className="text-3xl font-bold">{weekLoad} <span className="text-sm font-normal text-muted">laatste 7 dagen</span></p>
      <ul className="flex flex-col gap-1 text-sm">
        {logs?.map((l, i) => {
          const s = l.sessions as unknown as { title: string; type: SessionType; starts_at: string };
          return (
            <li key={i} className="flex justify-between border-b py-1">
              <span>{new Date(s.starts_at).toLocaleDateString("nl-NL")} {SESSION_TYPES[s.type]} {s.title}</span>
              <span>{l.attended ? `${l.duration_min} min × RPE ${l.rpe} = ${l.load}` : "Afwezig"}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
