"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";

/**
 * Segmented control shared by the 5RM page, the exercise library and workouts.
 * Staff plan workouts most, so they get Workouts first; athletes land on their 5RM.
 */
export function StrengthTabs({ teamId, isStaff = false }: { teamId: string; isStaff?: boolean }) {
  const { t } = useT();
  const path = usePathname();
  const base = `/team/${teamId}/strength`;
  const workouts = { href: `${base}/workouts`, label: t("strength.tab.workouts"), active: path.startsWith(`${base}/workouts`) };
  // For staff the bare strength URL opens Workouts, so their 5RM tab carries ?tab=5rm.
  const tests = { href: isStaff ? `${base}?tab=5rm` : base, label: t("strength.tab.tests"), active: path === base };
  const library = { href: `${base}/exercises`, label: t("strength.tab.library"), active: path.startsWith(`${base}/exercises`) };
  const tabs = isStaff ? [workouts, tests, library] : [tests, workouts, library];
  return (
    <nav className="glass mb-4 flex w-fit max-w-full gap-1 overflow-x-auto rounded-md p-1" aria-label={t("strength.title")}>
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={`inline-flex min-h-11 items-center rounded-md px-4 text-sm font-medium transition-colors ${tab.active ? "bg-[var(--accent-soft)] text-[var(--primary)]" : "text-muted hover:text-[var(--foreground)]"}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
