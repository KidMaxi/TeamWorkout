"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";

/** Segmented control on the staff overview: current dashboard | weekly planning. */
export function WorkloadTabs({ teamId }: { teamId: string }) {
  const { t } = useT();
  const path = usePathname();
  const base = `/team/${teamId}`;
  const tabs = [
    { href: base, label: t("workload.tab.now"), active: path === base },
    { href: `${base}/workload`, label: t("workload.tab.week"), active: path.startsWith(`${base}/workload`) },
  ];
  return (
    <nav className="glass mb-4 flex w-fit gap-1 rounded-full p-1" aria-label={t("workload.title")}>
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
