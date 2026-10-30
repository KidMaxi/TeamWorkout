import Link from "next/link";
import { ChevronRight, CircleHelp, KeyRound, LogOut, Plus, Shield, User, UserPlus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LogoMark } from "@/components/Logo";
import { Avatar } from "@/components/Avatar";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getT } from "@/lib/i18n/server";
import { ROLE_KEY } from "@/lib/i18n";
import { createTeam, joinTeam, signOut } from "./actions";

const iconBtn =
  "glass inline-flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:text-[var(--foreground)]";

function InputIcon({ icon: Icon }: { icon: typeof Users }) {
  return <Icon size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />;
}

export default async function Home() {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("team_members")
    .select("role, teams(id, name)")
    .order("joined_at");

  // Clubs where the user is staff, so a new team can be added to an existing club.
  const { data: staffRows } = await supabase
    .from("team_members")
    .select("teams(club_id, clubs(name))")
    .eq("role", "staff");
  const clubMap = new Map<string, string>();
  for (const r of staffRows ?? []) {
    const team = r.teams as unknown as { club_id: string; clubs: { name: string } | null } | null;
    if (team?.club_id && !clubMap.has(team.club_id)) clubMap.set(team.club_id, team.clubs?.name ?? team.club_id);
  }
  const clubs = [...clubMap].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="stagger mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-4 pb-10 pt-4 sm:px-6">
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" aria-label={t("common.appName")}><LogoMark size={32} /></Link>
          <h1 className="display truncate text-2xl">{t("home.title")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link href="/profile" aria-label={t("common.nav.profile")} className={iconBtn}><User size={18} aria-hidden /></Link>
          <Link href="/help" aria-label={t("common.nav.help")} className={iconBtn}><CircleHelp size={18} aria-hidden /></Link>
          <form action={signOut}>
            <button aria-label={t("common.logout")} title={t("common.logout")} className={iconBtn}><LogOut size={18} aria-hidden /></button>
          </form>
        </div>
      </header>

      {memberships?.length ? (
        <ul className="flex flex-col gap-3">
          {memberships.map((m) => {
            const team = m.teams as unknown as { id: string; name: string };
            const isStaff = m.role === "staff";
            const RoleIcon = isStaff ? Shield : Users;
            return (
              <li key={team.id}>
                <Link
                  href={`/team/${team.id}`}
                  className="card flex min-h-[4.5rem] items-center gap-4 transition-colors hover:border-[var(--accent)]"
                >
                  <Avatar name={team.name} size={48} />
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
                    <span className="display block w-full truncate text-lg">{team.name}</span>
                    <span className={`badge ${isStaff ? "badge-ok" : "badge-none"}`}>
                      <RoleIcon size={12} aria-hidden />
                      {t(ROLE_KEY[m.role as keyof typeof ROLE_KEY])}
                    </span>
                  </span>
                  <ChevronRight size={20} aria-hidden className="shrink-0 text-[var(--accent)]" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="card flex flex-col items-center gap-2 py-8 text-center">
          <Users size={28} aria-hidden className="text-[var(--accent)]" />
          <p className="display text-lg">{t("home.emptyTitle")}</p>
          <p className="text-sm text-muted">{t("home.emptyHint")}</p>
        </div>
      )}

      <section className="card">
        <h2 className="display mb-3 text-lg">{t("home.createTitle")}</h2>
        <form action={createTeam} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <InputIcon icon={Users} />
              <input name="name" required placeholder={t("home.newTeam")} aria-label={t("home.newTeam")} className="input min-h-11 w-full pl-10" />
            </div>
            <button className="btn btn-primary inline-flex min-h-11 items-center gap-1.5"><Plus size={16} aria-hidden />{t("home.create")}</button>
          </div>
          {clubs.length > 0 && (
            <label className="flex flex-col gap-1">
              <span className="eyebrow">{t("home.club")}</span>
              <select name="club" defaultValue="new" className="input min-h-11 w-full">
                <option value="new">{t("home.clubNew")}</option>
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          )}
        </form>
      </section>

      <section className="card">
        <h2 className="display text-lg">{t("home.joinTitle")}</h2>
        <p className="mb-3 mt-1 text-sm text-muted">{t("home.joinHint")}</p>
        <form action={joinTeam} className="flex gap-2">
          <div className="relative flex-1">
            <InputIcon icon={KeyRound} />
            <input name="code" required placeholder={t("home.code")} aria-label={t("home.code")} className="input min-h-11 w-full pl-10" />
          </div>
          <button className="btn inline-flex min-h-11 items-center gap-1.5"><UserPlus size={16} aria-hidden />{t("home.join")}</button>
        </form>
      </section>
    </main>
  );
}
