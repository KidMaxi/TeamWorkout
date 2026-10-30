"use client";

import { useId, useRef, useState, useTransition } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";

type Props = {
  /** Visible label of the trigger button. */
  triggerLabel: string;
  /** Accessible name of the trigger when the visible label is not enough. */
  triggerAriaLabel?: string;
  title: string;
  /** Ask for the PIN twice (self-service). */
  twice?: boolean;
  onSave: (pin: string) => Promise<{ ok: boolean; error?: MessageKey }>;
  primary?: boolean;
  className?: string;
};

const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

export function PinDialog({ triggerLabel, triggerAriaLabel, title, twice = false, onSave, primary = false, className = "" }: Props) {
  const { t } = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [pending, start] = useTransition();

  function reset() {
    setPin("");
    setAgain("");
    setShow(false);
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pin.length < 4) return setError("pins.dialog.invalid");
    if (twice && pin !== again) return setError("pins.dialog.mismatch");
    setError(null);
    start(async () => {
      const r = await onSave(pin);
      if (r.ok) {
        ref.current?.close();
      } else {
        setError(r.error ?? "pins.error.generic");
      }
    });
  }

  const valid = pin.length >= 4 && (!twice || again.length >= 4);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-label={triggerAriaLabel}
        className={`btn ${primary ? "btn-primary" : ""} inline-flex min-h-11 items-center justify-center gap-2 ${className}`}
      >
        <KeyRound size={16} aria-hidden />
        {triggerLabel}
      </button>
      <dialog
        ref={ref}
        className="confirm !rounded-3xl !p-6"
        aria-labelledby={`${id}-t`}
        onClose={reset}
      >
        <form onSubmit={submit} className="flex flex-col gap-4" autoComplete="off">
          <div className="flex flex-col gap-2">
            <h2 id={`${id}-t`} className="display text-2xl leading-tight">{title}</h2>
            <p className="text-sm text-muted">{t("pins.dialog.hint")}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-p`} className="text-sm text-muted">{t("pins.dialog.pin")}</label>
            <div className="flex items-center gap-2">
              <input
                id={`${id}-p`}
                value={pin}
                onChange={(e) => setPin(digits(e.target.value))}
                type={show ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]*"
                minLength={4}
                maxLength={6}
                autoComplete="off"
                autoFocus
                className="input min-h-14 flex-1 text-center text-2xl tracking-[0.4em]"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-pressed={show}
                aria-label={show ? t("pins.dialog.hide") : t("pins.dialog.show")}
                className="btn grid size-14 shrink-0 place-items-center !p-0"
              >
                {show ? <EyeOff size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
              </button>
            </div>
          </div>

          {twice && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-a`} className="text-sm text-muted">{t("pins.dialog.confirm")}</label>
              <input
                id={`${id}-a`}
                value={again}
                onChange={(e) => setAgain(digits(e.target.value))}
                type={show ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]*"
                minLength={4}
                maxLength={6}
                autoComplete="off"
                className="input min-h-14 text-center text-2xl tracking-[0.4em]"
              />
            </div>
          )}

          <p role="alert" className="min-h-0 text-sm text-danger">{error ? t(error) : ""}</p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => ref.current?.close()} className="btn min-h-14 sm:min-w-28">
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={!valid || pending} className="btn btn-primary inline-flex min-h-14 items-center justify-center gap-2">
              {pending ? t("common.loading") : t("pins.dialog.save")}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
