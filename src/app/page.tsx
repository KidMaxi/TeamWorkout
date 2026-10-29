import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoMark } from "@/components/Logo";
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
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="TeamWorkout home"><LogoMark size={30} /></Link>
          <h1 className="text-2xl font-bold">Mijn teams</h1>
        </div>
        <form action={signOut}><button className="text-sm link">Uitloggen</button></form>
      </header>

      <ul className="flex flex-col gap-2">
        {memberships?.map((m) => {
          const team = m.teams as unknown as { id: string; name: string };
          return (
            <li key={team.id}>
              <Link href={`/team/${team.id}`} className="card flex justify-between hover:border-[var(--primary)]">
                <span>{team.name}</span>
                <span className="text-sm text-muted">{m.role === "staff" ? "Staf" : "Atleet"}</span>
              </Link>
            </li>
          );
        })}
        {!memberships?.length && <li className="text-muted">Je zit nog in geen team.</li>}
      </ul>

      <form action={createTeam} className="flex gap-2">
        <input name="name" required placeholder="Nieuw team (als staf)" className="input flex-1" />
        <button className="btn btn-primary">Maak</button>
      </form>
      <form action={joinTeam} className="flex gap-2">
        <input name="code" required placeholder="Uitnodigingscode" className="input flex-1" />
        <button className="btn">Join</button>
      </form>
    </main>
  );
}
