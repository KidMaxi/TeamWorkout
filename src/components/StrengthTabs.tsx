"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";

/** Segmented control shared by the 5RM page, the exercise library and workouts. */
export function StrengthTabs({ teamId }: { teamId: string }) {
  const { t } = useT();
  const path = usePathname();
  const base = `/team/${teamId}/strength`;
  const tabs = [
    { href: base, label: t("strength.tab.tests"), active: path === base },
    { href: `${base}/exercises`, label: t("strength.tab.library"), active: path.startsWith(`${base}/exercises`) },
    { href: `${base}/workouts`, label: t("strength.tab.workouts"), active: path.startsWith(`${base}/workouts`) },
  ];
  return (
    <nav className="glass mb-4 flex w-fit gap-1 rounded-full p-1" aria-label={t("strength.title")}>
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${tab.active ? "bg-[var(--primary)] text-[var(--on-primary)]" : "text-muted hover:text-[var(--foreground)]"}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
