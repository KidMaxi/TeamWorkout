"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";

const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
type Rpe = (typeof VALUES)[number];

/** Calm to hard, built from the theme tokens only: ok -> warn -> danger. */
function scale(n: number): string {
  const p = (n - 1) / 9;
  return p <= 0.5
    ? `color-mix(in srgb, var(--warn) ${Math.round(p * 200)}%, var(--ok))`
    : `color-mix(in srgb, var(--danger) ${Math.round((p - 0.5) * 200)}%, var(--warn))`;
}

const wordKey = (n: Rpe) => `quicklog.rpe.${n}` as MessageKey;

export type RpePickerProps = {
  /** Controlled value (null = nothing chosen). Leave undefined for uncontrolled use. */
  value?: number | null;
  defaultValue?: number | null;
  onChange?: (value: Rpe) => void;
  /** Name of the hidden input that carries the value in plain forms. */
  name?: string;
  /** When set, shows an 'As planned (n)' chip that selects it. */
  plannedRpe?: number | null;
  disabled?: boolean;
};

export function RpePicker({ value, defaultValue = null, onChange, name = "rpe", plannedRpe, disabled }: RpePickerProps) {
  const { t } = useT();
  const uid = useId();
  const [inner, setInner] = useState<number | null>(defaultValue);
  const current = value !== undefined ? value : inner;
  const select = (n: Rpe) => {
    if (disabled) return;
    if (value === undefined) setInner(n);
    onChange?.(n);
  };
  const planned = VALUES.find((v) => v === plannedRpe);
  const legendId = `${uid}-legend`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p id={legendId} className="text-sm font-medium">{t("quicklog.rpe.legend")}</p>
        <Link href="/help#rpe" className="link inline-flex min-h-11 items-center gap-1.5 text-sm">
          <CircleHelp size={14} aria-hidden />{t("quicklog.rpe.help")}
        </Link>
      </div>

      <input type="hidden" name={name} value={current ?? ""} />
      <div role="radiogroup" aria-labelledby={legendId} className="grid grid-cols-5 gap-2">
        {VALUES.map((n) => (
          <label key={n} className="relative block" style={{ "--c": scale(n) } as React.CSSProperties}>
            <input
              type="radio"
              name={`${uid}-rpe`}
              value={n}
              checked={current === n}
              disabled={disabled}
              onChange={() => select(n)}
              aria-label={t("quicklog.rpe.option", { n, word: t(wordKey(n)) })}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className="num grid min-h-[3.25rem] cursor-pointer place-items-center rounded-2xl border border-[var(--line)] bg-[var(--surface-2)]/60 text-xl shadow-[inset_0_-4px_0_var(--c)] transition-colors hover:border-[var(--accent)] peer-checked:border-transparent peer-checked:bg-[var(--c)] peer-checked:text-[var(--on-primary)] peer-checked:shadow-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)]"
            >
              {n}
            </span>
          </label>
        ))}
      </div>

      <div className="flex min-h-11 items-center justify-between gap-3">
        <p className={`min-w-0 text-sm ${current ? "font-semibold" : "text-muted"}`} aria-live="polite">
          {current && current >= 1 && current <= 10 ? t(wordKey(current as Rpe)) : t("quicklog.rpe.pick")}
        </p>
        {planned !== undefined && (
          <button
            type="button"
            onClick={() => select(planned)}
            disabled={disabled}
            aria-pressed={current === planned}
            className={`chip min-h-11 shrink-0 cursor-pointer px-3.5 text-sm transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 ${current === planned ? "!border-[var(--accent)] !text-foreground" : ""}`}
          >
            {t("quicklog.rpe.planned", { n: planned })}
          </button>
        )}
      </div>
    </div>
  );
}
