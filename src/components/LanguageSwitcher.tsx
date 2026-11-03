"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { setLocale } from "@/app/actions";
import { useT } from "@/lib/i18n/client";

/** Compact NL | EN toggle. Saves the choice in a cookie and, when signed in, in the profile. */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className={`inline-flex items-center gap-1 text-xs ${className}`} role="group" aria-label={t("common.language.label")}>
      <Languages size={14} aria-hidden className="text-muted" />
      {(["nl", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          aria-pressed={locale === l}
          title={t(`common.language.${l}`)}
          onClick={() => start(async () => { await setLocale(l); router.refresh(); })}
          className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2 font-semibold uppercase ${locale === l ? "bg-[var(--primary)] text-[var(--on-primary)]" : "text-muted hover:text-[var(--foreground)]"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
