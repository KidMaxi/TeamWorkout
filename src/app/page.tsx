import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createTeam, joinTeam, signOut } from "./actions";

export default async function Home() {
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("team_members")
    .select("role, teams(id, name)")
    .order("joined_at");

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-8 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mijn teams</h1>
        <form action={signOut}><button className="text-sm underline">Uitloggen</button></form>
      </header>

      <ul className="flex flex-col gap-2">
        {memberships?.map((m) => {
          const team = m.teams as unknown as { id: string; name: string };
          return (
            <li key={team.id}>
              <Link href={`/team/${team.id}`} className="flex justify-between rounded border p-3">
                <span>{team.name}</span>
                <span className="text-sm opacity-60">{m.role === "staff" ? "Staf" : "Atleet"}</span>
              </Link>
            </li>
          );
        })}
        {!memberships?.length && <li className="opacity-60">Je zit nog in geen team.</li>}
      </ul>

      <form action={createTeam} className="flex gap-2">
        <input name="name" required placeholder="Nieuw team (als staf)" className="flex-1 rounded border p-2 text-black" />
        <button className="rounded bg-emerald-600 px-4 font-semibold text-white">Maak</button>
      </form>
      <form action={joinTeam} className="flex gap-2">
        <input name="code" required placeholder="Uitnodigingscode" className="flex-1 rounded border p-2 text-black" />
        <button className="rounded border px-4 font-semibold">Join</button>
      </form>
    </main>
  );
}
