import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, CircleHelp, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getMembership, getT } from "@/lib/auth-cache";
import { LogoMark } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { can } from "@/lib/roles";
import { TeamNav } from "@/components/TeamNav";
import { getPendingCount } from "@/lib/pending";

export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ t }, user] = await Promise.all([getT(), getAuthUser()]);
  const supabase = await createClient();
  // Team name and membership are independent; the page below shares the same cached membership lookup.
  const [{ data: team }, me] = await Promise.all([
    supabase.from("teams").select("name").eq("id", id).single(),
    getMembership(id, user!.id),
  ]);
  if (!team) notFound();

  const pending = me?.role === "athlete" ? await getPendingCount(supabase, id, user!.id) : 0;

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 pb-32 pt-5 md:pb-8">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/?all=1" aria-label={t("common.nav.teams")} className="flex items-center gap-1 text-muted hover:text-[var(--foreground)]">
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
      <TeamNav teamId={id} pending={pending} isHead={can(me?.staffKind, "manageMembers")} />
      {children}
    </div>
  );
}
