"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";

/** Segmented control List | Calendar on the sessions screens (same pattern as StrengthTabs). */
export function SessionsTabs({ teamId }: { teamId: string }) {
  const { t } = useT();
  const path = usePathname();
  const base = `/team/${teamId}/sessions`;
  const onCalendar = path.startsWith(`${base}/calendar`);
  const tabs = [
    { href: base, label: t("sessions.tab.list"), active: !onCalendar },
    { href: `${base}/calendar`, label: t("sessions.tab.calendar"), active: onCalendar },
  ];
  return (
    <nav className="glass flex w-fit gap-1 rounded-full p-1" aria-label={t("sessions.tabs.label")}>
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={`inline-flex min-h-11 items-center rounded-full px-5 text-sm font-medium transition-colors ${tab.active ? "bg-[var(--primary)] text-[var(--on-primary)]" : "text-muted hover:text-[var(--foreground)]"}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
