import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { LogoMark } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { TeamNav } from "@/components/TeamNav";

export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { t } = await getT();
  const supabase = await createClient();
  const { data: team } = await supabase.from("teams").select("name").eq("id", id).single();
  if (!team) notFound();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("team_members").select("role").eq("team_id", id).eq("user_id", user!.id).single();

  return (
    <div className="mx-auto min-h-dvh max-w-3xl p-4 pb-24 md:pb-4">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/" aria-label={t("common.nav.teams")} className="flex items-center gap-1 text-muted hover:text-[var(--foreground)]">
            <ChevronLeft size={18} aria-hidden />
            <LogoMark size={22} />
          </Link>
          <h1 className="truncate text-lg font-bold">{team.name}</h1>
        </div>
        <LanguageSwitcher />
      </header>
      <TeamNav teamId={id} isStaff={me?.role === "staff"} />
      {children}
    </div>
  );
}
