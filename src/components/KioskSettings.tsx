"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowRight, Info, Tablet, TriangleAlert } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";
import { Avatar } from "@/components/Avatar";
import { ConfirmButton } from "@/components/ConfirmButton";
import { PinDialog } from "@/components/PinDialog";
import { clearPin, setKioskPinRequired, setPin } from "@/app/pin-actions";

export type KioskAthlete = { userId: string; name: string; hasPin: boolean };

export function KioskSettings({
  teamId,
  pinRequired,
  athletes,
}: {
  teamId: string;
  pinRequired: boolean;
  athletes: KioskAthlete[];
}) {
  const { t } = useT();
  const [required, setRequired] = useState(pinRequired);
  const [error, setError] = useState<MessageKey | null>(null);
  const [pending, start] = useTransition();
  const missing = athletes.filter((a) => !a.hasPin).length;

  function toggle() {
    const next = !required;
    setError(null);
    setRequired(next);
    start(async () => {
      const r = await setKioskPinRequired(teamId, next);
      if (!r.ok) {
        setRequired(!next);
        setError(r.error ?? "pins.error.generic");
      }
    });
  }

  return (
    <div className="card flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-full text-[var(--accent)]"
          style={{ background: "linear-gradient(145deg, var(--surface-3), var(--surface-2))", boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent)" }}
        >
          <Tablet size={20} />
        </span>
        <div className="min-w-0">
          <h2 className="display text-xl">{t("pins.card.title")}</h2>
          <p className="mt-1 text-sm text-muted">{t("pins.card.body")}</p>
        </div>
      </div>

      <Link href={`/team/${teamId}/kiosk`} className="btn btn-primary inline-flex min-h-11 items-center justify-center gap-2">
        {t("pins.card.open")}
        <ArrowRight size={16} aria-hidden />
      </Link>

      <hr className="hairline" />

      <div className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-4 py-2" style={{ background: "var(--surface-2)" }}>
        <span className="min-w-0">
          <span id="kiosk-pin-sw" className="block text-sm font-medium">{t("pins.require.label")}</span>
          <span className="block text-xs text-muted">{t("pins.require.hint")}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={required}
          aria-labelledby="kiosk-pin-sw"
          disabled={pending}
          onClick={toggle}
          className="relative -mr-2 grid h-11 w-14 shrink-0 place-items-center disabled:opacity-50"
        >
          <span
            aria-hidden
            className="relative h-7 w-12 rounded-full border transition-colors"
            style={{ background: required ? "var(--primary)" : "var(--surface-3)", borderColor: required ? "transparent" : "var(--line)" }}
          >
            <span
              className="absolute top-0.5 size-6 rounded-full shadow transition-all"
              style={{ left: required ? "1.3rem" : "0.15rem", background: required ? "var(--on-primary)" : "var(--muted)" }}
            />
          </span>
          <span className="sr-only">{required ? t("pins.require.on") : t("pins.require.off")}</span>
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{t(error)}</p>}

      <p className="flex items-start gap-2 text-xs text-muted">
        <Info size={14} aria-hidden className="mt-px shrink-0" />
        {t("pins.guard")}
      </p>

      {required && missing > 0 && (
        <p className="badge badge-watch !whitespace-normal !rounded-2xl !px-3 !py-2 !text-xs" role="status">
          <TriangleAlert size={14} aria-hidden className="shrink-0" />
          {missing === 1 ? t("pins.warn.missingOne") : t("pins.warn.missing", { n: missing })}
        </p>
      )}

      <h3 className="eyebrow">{t("pins.list.title")}</h3>
      {athletes.length === 0 ? (
        <p className="text-sm text-muted">{t("pins.list.empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--line)]">
          {athletes.map((a) => (
            <li key={a.userId} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <Avatar name={a.name} size={40} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.name}</span>
                <span className={`badge ${a.hasPin ? "badge-ok" : "badge-none"}`}>
                  {a.hasPin ? t("pins.status.set") : t("pins.status.none")}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 pl-[52px]">
                <PinDialog
                  triggerLabel={a.hasPin ? t("pins.action.change") : t("pins.action.set")}
                  triggerAriaLabel={t("pins.action.setFor", { name: a.name })}
                  title={t("pins.dialog.titleFor", { name: a.name })}
                  onSave={(pin) => setPin(a.userId, pin, teamId)}
                />
                {a.hasPin && (
                  <ConfirmButton
                    action={async () => {
                      const r = await clearPin(a.userId, teamId);
                      return r.ok ? {} : { error: r.error };
                    }}
                    icon="trash"
                    label={t("pins.action.remove")}
                    title={t("pins.remove.title")}
                    body={t("pins.remove.body", { name: a.name })}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
