import Link from "next/link";
import { CircleHelp, KeyRound, LogOut, Plus, Shield, User, UserPlus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LogoMark } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getT } from "@/lib/i18n/server";
import { ROLE_KEY } from "@/lib/i18n";
import { createTeam, joinTeam, signOut } from "./actions";

const iconBtn = "inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:text-[var(--foreground)]";

export default async function Home() {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("team_members")
    .select("role, teams(id, name)")
    .order("joined_at");

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" aria-label={t("common.appName")}><LogoMark size={30} /></Link>
          <h1 className="truncate text-xl font-bold">{t("home.title")}</h1>
        </div>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <Link href="/profile" aria-label={t("common.nav.profile")} className={iconBtn}><User size={18} aria-hidden /></Link>
          <Link href="/help" aria-label={t("common.nav.help")} className={iconBtn}><CircleHelp size={18} aria-hidden /></Link>
          <form action={signOut}>
            <button aria-label={t("common.logout")} title={t("common.logout")} className={iconBtn}><LogOut size={18} aria-hidden /></button>
          </form>
        </div>
      </header>

      <ul className="flex flex-col gap-2">
        {memberships?.map((m) => {
          const team = m.teams as unknown as { id: string; name: string };
          const RoleIcon = m.role === "staff" ? Shield : Users;
          return (
            <li key={team.id}>
              <Link href={`/team/${team.id}`} className="card flex items-center justify-between gap-3 hover:border-[var(--primary)]">
                <span className="flex min-w-0 items-center gap-2">
                  <RoleIcon size={18} aria-hidden className="shrink-0 text-muted" />
                  <span className="truncate">{team.name}</span>
                </span>
                <span className="text-sm text-muted">{t(ROLE_KEY[m.role as keyof typeof ROLE_KEY])}</span>
              </Link>
            </li>
          );
        })}
        {!memberships?.length && <li className="flex items-center gap-2 text-muted"><Users size={16} aria-hidden />{t("home.empty")}</li>}
      </ul>

      <form action={createTeam} className="flex gap-2">
        <div className="relative flex-1">
          <Users size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input name="name" required placeholder={t("home.newTeam")} aria-label={t("home.newTeam")} className="input w-full pl-9" />
        </div>
        <button className="btn btn-primary inline-flex items-center gap-1"><Plus size={16} aria-hidden />{t("home.create")}</button>
      </form>
      <form action={joinTeam} className="flex gap-2">
        <div className="relative flex-1">
          <KeyRound size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input name="code" required placeholder={t("home.code")} aria-label={t("home.code")} className="input w-full pl-9" />
        </div>
        <button className="btn inline-flex items-center gap-1"><UserPlus size={16} aria-hidden />{t("home.join")}</button>
      </form>
    </main>
  );
}
