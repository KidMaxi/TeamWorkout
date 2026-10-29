import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoMark } from "@/components/Logo";

export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: team } = await supabase.from("teams").select("name").eq("id", id).single();
  if (!team) notFound();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("team_members").select("role").eq("team_id", id).eq("user_id", user!.id).single();

  return (
    <div className="mx-auto min-h-dvh max-w-3xl p-4">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="TeamWorkout home" className="shrink-0"><LogoMark size={26} /></Link>
          <Link href="/" className="text-sm link">&larr; Teams</Link>
        </div>
        <h1 className="text-lg font-bold">{team.name}</h1>
      </header>
      <nav className="mb-6 flex gap-1 border-b pb-3 text-sm">
        <Link href={`/team/${id}`} className="tab">Overzicht</Link>
        <Link href={`/team/${id}/sessions`} className="tab">Trainingen</Link>
        {me?.role === "staff" && <Link href={`/team/${id}/members`} className="tab">Leden</Link>}
      </nav>
      {children}
    </div>
  );
}
