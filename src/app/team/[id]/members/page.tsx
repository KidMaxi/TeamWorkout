import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AVAILABILITY } from "@/lib/load";
import { createInvite, updateMember } from "@/app/actions";

export default async function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
    <section className="flex flex-col gap-6">
      <div className="card text-sm">
        <form action={createInvite.bind(null, id)} className="flex gap-2">
          <select name="role" className="input">
            <option value="athlete">Atleet</option><option value="staff">Staf</option>
          </select>
          <button className="btn btn-primary">Nieuwe uitnodigingscode (14 dagen)</button>
        </form>
        <ul className="mt-2 font-mono">
          {invites?.map((i) => <li key={i.code}>{i.code} <span className="text-muted">({i.role})</span></li>)}
        </ul>
      </div>

      <ul className="flex flex-col gap-3">
        {members?.map((m) => {
          const p = name.get(m.user_id);
          const a = av.get(m.user_id);
          return (
            <li key={m.user_id} className="card text-sm">
              <p className="font-semibold">{p?.full_name || "Naamloos"} <span className="text-muted">({m.role === "staff" ? "staf" : "atleet"})</span></p>
              {m.role === "athlete" && (
                <form action={updateMember.bind(null, id, m.user_id)} className="mt-2 flex flex-wrap items-center gap-2">
                  <select name="status" defaultValue={a?.status ?? "available"} className="input input-sm">
                    {Object.entries(AVAILABILITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <input name="note" defaultValue={a?.note ?? ""} placeholder="Notitie" className="input input-sm" />
                  <input name="max_weekly_load" type="number" min={1} defaultValue={lim.get(m.user_id)?.max_weekly_load ?? ""} placeholder="Max weekload" className="input input-sm w-32" />
                  <label className="flex items-center gap-1">
                    <input type="checkbox" name="consent" defaultChecked={m.consent_given} /> Toestemming
                  </label>
                  <button className="btn">Opslaan</button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
