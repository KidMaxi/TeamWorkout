"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Dumbbell, LayoutDashboard, Trophy, Users } from "lucide-react";
import { useT } from "@/lib/i18n/client";

export function TeamNav({ teamId, isHead, pending = 0, showLeaderboard = false }: { teamId: string; isHead: boolean; pending?: number; showLeaderboard?: boolean }) {
  const { t } = useT();
  const path = usePathname();
  const base = `/team/${teamId}`;
  if (path.includes("/kiosk")) return null; // shared iPad: no navigation for athletes
  const items = [
    { href: base, label: t("common.nav.overview"), Icon: LayoutDashboard, exact: true },
    { href: `${base}/sessions`, label: t("common.nav.training"), Icon: CalendarDays },
    { href: `${base}/strength`, label: t("common.nav.strength"), Icon: Dumbbell },
    ...(showLeaderboard ? [{ href: "/leaderboard", label: t("common.nav.records"), Icon: Trophy }] : []),
    ...(isHead ? [{ href: `${base}/members`, label: t("common.nav.members"), Icon: Users }] : []),
  ];
  return (
    <nav
      aria-label="Team"
      className="glass fixed inset-x-0 bottom-0 z-20 flex justify-around border-x-0 border-b-0 px-1 pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-1.5 md:static md:mb-6 md:w-fit md:justify-start md:gap-1 md:rounded-md md:border md:p-1"
    >
      {items.map(({ href, label, Icon, exact }) => {
        const active = exact ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[10.5px] font-medium tracking-wide transition-colors md:flex-none md:flex-row md:gap-2 md:px-4 md:py-2 md:text-sm ${
              active
                ? "bg-[var(--accent-soft)] text-[var(--primary)]"
                : "text-muted hover:text-[var(--foreground)]"
            }`}
          >
            <span className="relative">
              <Icon size={20} aria-hidden />
              {exact && pending > 0 && (
                <span
                  role="img"
                  aria-label={t("common.nav.pending", { n: pending })}
                  className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-bold leading-none text-[var(--background)] ring-2 ring-[var(--surface-2)]"
                >
                  {pending > 9 ? "9+" : pending}
                </span>
              )}
            </span>
            <span className="max-w-full truncate">{label}</span>
            {active && <span aria-hidden className="absolute -top-1.5 h-0.5 w-6 bg-[var(--primary)] md:hidden" />}
          </Link>
        );
      })}
    </nav>
  );
}
