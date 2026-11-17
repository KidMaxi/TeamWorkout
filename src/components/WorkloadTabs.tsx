"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useT } from "@/lib/i18n/client";

/**
 * Segmented control on the staff overview: current dashboard | weekly planning.
 * With `rules` it also shows one "Rules" button at the top right that opens that panel below the tabs.
 */
export function WorkloadTabs({ teamId, rules }: { teamId: string; rules?: ReactNode }) {
  const { t } = useT();
  const path = usePathname();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const base = `/team/${teamId}`;
  const tabs = [
    { href: base, label: t("workload.tab.now"), active: path === base },
    { href: `${base}/workload`, label: t("workload.tab.week"), active: path.startsWith(`${base}/workload`) },
  ];
  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <nav className="glass flex w-fit gap-1 rounded-md p-1" aria-label={t("workload.title")}>
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${tab.active ? "bg-[var(--accent-soft)] text-[var(--primary)]" : "text-muted hover:text-[var(--foreground)]"}`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        {rules && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((o) => !o)}
            className={`btn inline-flex min-h-11 shrink-0 items-center gap-2 ${open ? "!border-[var(--primary)]" : ""}`}
          >
            <SlidersHorizontal size={16} aria-hidden className="text-[var(--accent)]" />
            {t("workload.rules.button")}
          </button>
        )}
      </div>
      {rules && (
        <div id={panelId} className={open ? "card flex flex-col gap-5" : "hidden"}>
          {rules}
        </div>
      )}
    </div>
  );
}
