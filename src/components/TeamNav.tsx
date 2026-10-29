"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CircleHelp, LayoutDashboard, User, Users } from "lucide-react";
import { useT } from "@/lib/i18n/client";

export function TeamNav({ teamId, isStaff }: { teamId: string; isStaff: boolean }) {
  const { t } = useT();
  const path = usePathname();
  const base = `/team/${teamId}`;
  const items = [
    { href: base, label: t("common.nav.overview"), Icon: LayoutDashboard, exact: true },
    { href: `${base}/sessions`, label: t("common.nav.sessions"), Icon: CalendarDays },
    ...(isStaff ? [{ href: `${base}/members`, label: t("common.nav.members"), Icon: Users }] : []),
    { href: "/profile", label: t("common.nav.profile"), Icon: User },
    { href: "/help", label: t("common.nav.help"), Icon: CircleHelp },
  ];
  return (
    <nav
      aria-label="Team"
      className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t bg-[var(--surface)] pb-[env(safe-area-inset-bottom)] md:static md:mb-6 md:justify-start md:gap-1 md:border-t-0 md:border-b md:bg-transparent md:pb-3"
    >
      {items.map(({ href, label, Icon, exact }) => {
        const active = exact ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 px-2 py-2 text-[11px] md:flex-none md:flex-row md:gap-2 md:rounded-full md:px-3 md:py-1.5 md:text-sm ${active ? "font-semibold text-primary md:bg-[var(--surface-2)]" : "text-muted hover:text-[var(--foreground)]"}`}
          >
            <Icon size={20} aria-hidden />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
