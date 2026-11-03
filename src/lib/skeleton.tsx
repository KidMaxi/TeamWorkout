"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n/client";

/** Placeholder building blocks for loading.tsx: same card footprint as the real content so nothing jumps when it arrives. */

export function Bar({ w = "100%", h = "1rem", className = "" }: { w?: string; h?: string; className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} style={{ width: w, height: h }} />;
}

export function CardSkel({ lines = 2, hero = false }: { lines?: number; hero?: boolean }) {
  return (
    <div className={`card ${hero ? "card-hero" : ""} flex flex-col gap-3`}>
      <Bar w="45%" h="1.25rem" />
      {Array.from({ length: lines }, (_, i) => <Bar key={i} w={i === lines - 1 ? "70%" : "100%"} h="0.875rem" />)}
    </div>
  );
}

/** A tab strip (pills) like SessionsTabs / StrengthTabs / WorkloadTabs. */
export function TabsSkel({ n = 3 }: { n?: number }) {
  return (
    <div aria-hidden className="flex gap-2">
      {Array.from({ length: n }, (_, i) => <Bar key={i} w="5.5rem" h="2.25rem" className="!rounded-full" />)}
    </div>
  );
}

/** Wrapper: announces the busy state to screen readers (translated) and lays children out like the pages do. */
export function SkeletonPage({ children, className = "flex flex-col gap-4" }: { children: ReactNode; className?: string }) {
  const { t } = useT();
  return (
    <section role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{t("common.loading")}</span>
      {children}
    </section>
  );
}
