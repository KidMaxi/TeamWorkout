"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Delete } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";

/**
 * Numeric PIN pad for shared devices. Digits live in this component's state only and are
 * cleared after every attempt; the parent decides what to do with the PIN it is handed.
 * `onSubmit` resolves to an error key (shown, pad shakes and clears) or null on success.
 */
export function PinPad({
  onSubmit, minLength = 4, maxLength = 6,
}: {
  onSubmit: (pin: string) => Promise<MessageKey | null>;
  minLength?: number;
  maxLength?: number;
}) {
  const { t } = useT();
  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [shake, setShake] = useState(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const push = useCallback((d: string) => {
    setError(null);
    setDigits((cur) => (cur.length < maxLength ? cur + d : cur));
  }, [maxLength]);
  const back = useCallback(() => {
    setError(null);
    setDigits((cur) => cur.slice(0, -1));
  }, []);

  const submit = useCallback(async () => {
    if (busy || digits.length < minLength) return;
    setBusy(true);
    setError(null);
    let err: MessageKey | null;
    try {
      err = await onSubmit(digits);
    } catch {
      err = "kiosk.pin.error";
    }
    if (!mounted.current) return;
    setBusy(false);
    setDigits("");
    if (err) {
      setError(err);
      setShake((n) => n + 1);
    }
  }, [busy, digits, minLength, onSubmit]);

  // Hardware keyboard (iPad with a keyboard, desktop testing).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) { e.preventDefault(); if (!busy) push(e.key); }
      else if (e.key === "Backspace") { e.preventDefault(); if (!busy) back(); }
      else if (e.key === "Enter" && digits.length >= minLength) {
        // A focused key button handles Enter itself.
        if (document.activeElement instanceof HTMLButtonElement) return;
        e.preventDefault();
        void submit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, push, back, submit, digits.length, minLength]);

  const key = "btn num grid h-16 min-w-16 place-items-center text-3xl sm:h-20 !rounded-2xl";

  return (
    <div className="mx-auto flex w-full max-w-xs flex-col items-center gap-5">
      <style>{`
        @keyframes pin-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-10px); } 40% { transform: translateX(9px); } 60% { transform: translateX(-6px); } 80% { transform: translateX(4px); } }
        .pin-shake { animation: pin-shake 0.35s ease-in-out; }
        @media (prefers-reduced-motion: reduce) { .pin-shake { animation: none; } }
      `}</style>

      <div
        key={shake}
        role="img"
        aria-label={t("kiosk.pin.digits", { n: digits.length })}
        className={`flex h-8 items-center justify-center gap-3 ${shake ? "pin-shake" : ""}`}
      >
        {Array.from({ length: maxLength }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className="size-4 rounded-full border-2"
            style={{
              borderColor: error ? "var(--danger)" : "var(--accent)",
              background: i < digits.length ? (error ? "var(--danger)" : "var(--accent)") : "transparent",
            }}
          />
        ))}
      </div>

      <p role="alert" className="min-h-6 text-center text-base font-medium text-danger">
        {busy ? <span className="text-muted">{t("kiosk.pin.checking")}</span> : error ? t(error) : ""}
      </p>

      <div className="grid w-full grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" className={key} aria-label={d} disabled={busy} onClick={() => push(d)}>{d}</button>
        ))}
        <button type="button" className={key} aria-label={t("kiosk.pin.delete")} disabled={busy || !digits} onClick={back}>
          <Delete size={28} aria-hidden />
        </button>
        <button type="button" className={key} aria-label="0" disabled={busy} onClick={() => push("0")}>0</button>
        <button
          type="button"
          className={`${key} btn-primary`}
          aria-label={t("kiosk.pin.submit")}
          disabled={busy || digits.length < minLength}
          onClick={() => void submit()}
        >
          <Check size={30} aria-hidden />
        </button>
      </div>
    </div>
  );
}
