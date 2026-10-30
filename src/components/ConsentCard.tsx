"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Lock, ShieldCheck, UserCheck } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { giveParentConsent, setMyConsent } from "@/app/consent-actions";
import type { ConsentResult } from "@/app/consent-actions";
import type { MessageKey } from "@/lib/i18n";

export type ConsentCardProps = {
  teamId: string;
  teamName: string;
  given: boolean;
  /** Pre-formatted date (server, user's locale), or "" */
  dateLabel: string;
  by: "self" | "parent" | null;
  /** adult = 16+, minor = under 16, unknown = no birth date */
  age: "adult" | "minor" | "unknown";
};

/** Athlete's own consent for sharing wellness data with a team's staff. */
export function ConsentCard({ teamId, teamName, given, dateLabel, by, age }: ConsentCardProps) {
  const { t } = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<MessageKey | null>(null);

  function toggle() {
    setError(null);
    start(async () => {
      const r = await setMyConsent(teamId, !given);
      if (!r.ok) setError(r.error ?? "consent.error.generic");
    });
  }

  const status = given
    ? by === "parent"
      ? t("consent.status.parent", { date: dateLabel })
      : t("consent.status.self", { date: dateLabel })
    : t("consent.status.none");

  return (
    <section className="card flex flex-col gap-3" aria-labelledby={`consent-${teamId}`}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full text-[var(--accent)]"
          style={{ background: "linear-gradient(145deg, var(--surface-3), var(--surface-2))", boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent)" }}
        >
          {given ? <ShieldCheck size={18} /> : <Lock size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{t("consent.card.eyebrow")}</p>
          <h2 id={`consent-${teamId}`} className="display mt-1 truncate text-lg">{teamName}</h2>
        </div>
      </div>

      <p className="text-sm text-muted">{t("consent.card.body1")} {t("consent.card.body2")}</p>

      {age === "adult" && (
        <div className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-4" style={{ background: "var(--surface-2)" }}>
          <span id={`consent-sw-${teamId}`} className="text-sm font-medium">
            {t("consent.card.switch", { team: teamName })}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={given}
            aria-labelledby={`consent-sw-${teamId}`}
            disabled={pending}
            onClick={toggle}
            className="relative -mr-2 grid h-11 w-14 shrink-0 place-items-center disabled:opacity-50"
          >
            <span
              aria-hidden
              className="relative h-7 w-12 rounded-full border transition-colors"
              style={{
                background: given ? "var(--primary)" : "var(--surface-3)",
                borderColor: given ? "transparent" : "var(--line)",
              }}
            >
              <span
                className="absolute top-0.5 size-6 rounded-full shadow transition-all"
                style={{ left: given ? "1.3rem" : "0.15rem", background: given ? "var(--on-primary)" : "var(--muted)" }}
              />
            </span>
            <span className="sr-only">{given ? t("consent.card.on") : t("consent.card.off")}</span>
          </button>
        </div>
      )}

      {age === "minor" && (
        <p className="flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm" style={{ background: "var(--surface-2)" }}>
          <Lock size={16} aria-hidden className="mt-0.5 shrink-0 text-[var(--accent)]" />
          {t("consent.locked.minor")}
        </p>
      )}

      {age === "unknown" && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border px-4 py-3 text-sm" style={{ background: "var(--surface-2)" }}>
          <span>{t("consent.needBirth.text")}</span>
          <a href="#birth_date" className="link inline-flex min-h-11 items-center">{t("consent.needBirth.link")}</a>
        </p>
      )}

      <p className="text-sm" aria-live="polite">
        <span className={given ? "text-ok" : "text-muted"}>{status}</span>
      </p>
      {error && <p role="alert" className="text-sm text-danger">{t(error)}</p>}

      <Link href="/privacy#health" className="link inline-flex min-h-11 items-center self-start text-sm">
        {t("consent.card.more")}
      </Link>
    </section>
  );
}

/** Staff: record parental consent for an athlete under 16 (note required). */
export function ParentConsentForm({ teamId, userId }: { teamId: string; userId: string }) {
  const { t } = useT();
  const [state, action, pending] = useActionState<ConsentResult | null, FormData>(
    giveParentConsent.bind(null, teamId, userId),
    null,
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor={`pc-${userId}`} className="eyebrow flex items-center gap-1.5">
        <UserCheck size={12} aria-hidden />{t("consent.parent.note")}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={`pc-${userId}`}
          name="note"
          required
          maxLength={200}
          placeholder={t("consent.parent.placeholder")}
          className="input min-h-11 w-full flex-1"
        />
        <button disabled={pending} className="btn inline-flex min-h-11 items-center justify-center gap-2">
          <ShieldCheck size={16} aria-hidden />{t("consent.parent.give")}
        </button>
      </div>
      {state && !state.ok && state.error && <p role="alert" className="text-sm text-danger">{t(state.error)}</p>}
    </form>
  );
}
