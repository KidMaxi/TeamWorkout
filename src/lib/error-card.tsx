"use client";

import Link from "next/link";
import { startTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { useT } from "@/lib/i18n/client";

/** Friendly error card for error.tsx: "try again" refetches the server data (router.refresh) and then re-renders the segment. */
export function ErrorCard({ reset, home }: { reset: () => void; home?: boolean }) {
  const { t } = useT();
  const router = useRouter();
  return (
    <div role="alert" className="card card-hero flex flex-col items-start gap-3">
      <span aria-hidden className="grid size-11 place-items-center rounded-full text-[var(--accent)]" style={{ background: "var(--surface-2)" }}>
        <TriangleAlert size={20} />
      </span>
      <h2 className="display text-2xl leading-tight">{t("common.error.title")}</h2>
      <p className="text-muted">{t("common.error.body")}</p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => startTransition(() => { router.refresh(); reset(); })}
          className="btn btn-primary inline-flex min-h-11 items-center gap-2"
        >
          <RefreshCw size={16} aria-hidden />{t("common.error.retry")}
        </button>
        {home && <Link href="/" className="link inline-flex min-h-11 items-center">{t("common.error.home")}</Link>}
      </div>
    </div>
  );
}
