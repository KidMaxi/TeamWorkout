"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, Copy, UserPlus } from "lucide-react";
import { createParentInvite } from "@/app/actions";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";

/** Trainer creates a parent invite code for an athlete and sees it large, with a copy button and the instruction. */
export function InviteParent({ teamId, childId, linked }: { teamId: string; childId: string; linked: number }) {
  const { t } = useT();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function create() {
    setError(null);
    setCopied(false);
    start(async () => {
      const r = await createParentInvite(teamId, childId);
      if (r.ok) setCode(r.code);
      else setError(r.error);
    });
  }

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={create} disabled={pending} className="btn inline-flex min-h-11 items-center gap-2">
          <UserPlus size={18} aria-hidden />{pending ? t("parent.invite.creating") : t("parent.invite.button")}
        </button>
        {linked > 0 && <span className="text-xs text-muted">{t("parent.invite.linked", { n: linked })}</span>}
      </div>
      {error && <p role="alert" className="text-sm text-danger">{t(error)}</p>}
      {code && (
        <div className="flex flex-col gap-3 rounded-2xl border px-4 py-3" style={{ background: "var(--surface-2)" }}>
          <span className="eyebrow">{t("parent.invite.codeLabel")}</span>
          <span className="select-all break-all font-mono text-2xl font-semibold tracking-[0.18em]">{code}</span>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={copy} className="btn inline-flex min-h-11 items-center gap-2">
              {copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
              {copied ? t("parent.invite.copied") : t("parent.invite.copy")}
            </button>
            <Link href="/parent/join" className="link inline-flex min-h-11 items-center text-sm">{t("parent.invite.link")}</Link>
          </div>
          <p className="text-xs text-muted" aria-live="polite">{t("parent.invite.instruction")}</p>
        </div>
      )}
    </div>
  );
}
