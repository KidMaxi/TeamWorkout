import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, CircleHelp, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { LogoMark } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { can, getStaffKind } from "@/lib/roles";
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
    <div className="mx-auto min-h-dvh max-w-3xl px-4 pb-32 pt-5 md:pb-8">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/" aria-label={t("common.nav.teams")} className="flex items-center gap-1 text-muted hover:text-[var(--foreground)]">
            <ChevronLeft size={18} aria-hidden />
            <LogoMark size={22} />
          </Link>
          <h1 className="display truncate text-xl">{team.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link href="/help" aria-label={t("common.nav.help")} title={t("common.nav.help")} className="-m-2.5 grid size-11 place-items-center text-muted hover:text-[var(--foreground)]">
            <CircleHelp size={18} aria-hidden />
          </Link>
          <Link href={`/team/${id}/settings`} aria-label={t("danger.settings.title")} title={t("danger.settings.title")} className="text-muted hover:text-[var(--foreground)]">
            <Settings size={18} aria-hidden />
          </Link>
        </div>
      </header>
      <TeamNav teamId={id} isHead={can(me?.role === "staff" ? await getStaffKind(supabase, id, user!.id) : null, "manageMembers")} />
      {children}
    </div>
  );
}
