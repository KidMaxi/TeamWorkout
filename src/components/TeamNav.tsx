"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Dumbbell, LayoutDashboard, User, Users } from "lucide-react";
import { useT } from "@/lib/i18n/client";

export function TeamNav({ teamId, isStaff }: { teamId: string; isStaff: boolean }) {
  const { t } = useT();
  const path = usePathname();
  const base = `/team/${teamId}`;
  if (path.includes("/kiosk")) return null; // shared iPad: no navigation for athletes
  const items = [
    { href: base, label: t("common.nav.overview"), Icon: LayoutDashboard, exact: true },
    { href: `${base}/sessions`, label: t("common.nav.sessions"), Icon: CalendarDays },
    { href: `${base}/strength`, label: t("strength.title"), Icon: Dumbbell },
    ...(isStaff ? [{ href: `${base}/members`, label: t("common.nav.members"), Icon: Users }] : []),
    { href: "/profile", label: t("common.nav.profile"), Icon: User },
  ];
  return (
    <nav
      aria-label="Team"
      className="glass fixed inset-x-4 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-md justify-around rounded-full p-1.5 md:static md:mb-6 md:inset-auto md:max-w-none md:justify-start md:gap-1 md:rounded-full md:p-1 md:w-fit"
    >
      {items.map(({ href, label, Icon, exact }) => {
        const active = exact ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-full px-2 py-1.5 text-[10px] font-medium tracking-wide transition-colors md:flex-none md:flex-row md:gap-2 md:px-4 md:py-2 md:text-sm ${
              active
                ? "bg-[var(--surface-3)] text-[var(--foreground)] shadow-[0_1px_0_rgb(255_255_255/0.08)_inset]"
                : "text-muted hover:text-[var(--foreground)]"
            }`}
          >
            <Icon size={20} aria-hidden className={active ? "text-primary" : ""} />
            <span>{label}</span>
            {active && <span aria-hidden className="absolute -top-0.5 h-1 w-4 rounded-full bg-[var(--primary)] shadow-[0_0_10px_var(--primary)] md:hidden" />}
          </Link>
        );
      })}
    </nav>
  );
}
