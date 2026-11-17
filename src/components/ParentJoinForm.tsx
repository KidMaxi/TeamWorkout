"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { joinAsParent } from "@/app/parent/actions";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";

export function ParentJoinForm() {
  const { t } = useT();
  const [code, setCode] = useState("");
  const [error, setError] = useState<MessageKey | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await joinAsParent(code);
      if (r?.error) setError(r.error);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="eyebrow">{t("parent.join.code")}</span>
        <div className="relative">
          <KeyRound size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
            required
            minLength={10}
            maxLength={10}
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-describedby="parent-code-hint"
            className="input min-h-12 w-full pl-10 font-mono text-lg tracking-[0.18em]"
          />
        </div>
        <span id="parent-code-hint" className="text-xs text-muted">{t("parent.join.codeHint")}</span>
      </label>
      {error && <p role="alert" className="text-sm text-danger">{t(error)}</p>}
      <button disabled={pending || code.length !== 10} className="btn btn-primary inline-flex min-h-12 items-center justify-center gap-2">
        {pending ? t("common.loading") : t("parent.join.submit")}
      </button>
    </form>
  );
}
