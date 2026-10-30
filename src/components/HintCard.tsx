"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CircleHelp, X } from "lucide-react";
import { dismissHint } from "@/app/hints-actions";

export type HintCardProps = {
  id: string;
  text: string;
  title?: string;
  href?: string;
  linkLabel?: string;
  label: string;
  dismissLabel: string;
};

/** A short, closable tip. Closing is remembered on the profile. */
export function HintCard({ id, text, title, href, linkLabel, label, dismissLabel }: HintCardProps) {
  const [hidden, setHidden] = useState(false);
  const [, start] = useTransition();
  if (hidden) return null;
  return (
    <aside
      role="note"
      className="card flex items-start gap-3 !border-[color-mix(in_srgb,var(--accent)_35%,var(--line))] !py-3"
    >
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full" style={{ boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent)" }}>
        <CircleHelp size={16} aria-hidden className="text-[var(--accent)]" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="eyebrow">{title ?? label}</p>
        <p className="mt-0.5 text-muted">{text}</p>
        {href && linkLabel && (
          <Link href={href} className="link mt-1 inline-block text-xs">{linkLabel}</Link>
        )}
      </div>
      <button
        type="button"
        aria-label={dismissLabel}
        onClick={() => { setHidden(true); start(async () => { await dismissHint(id); }); }}
        className="-m-2 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:text-[var(--foreground)]"
      >
        <X size={16} aria-hidden />
      </button>
    </aside>
  );
}
