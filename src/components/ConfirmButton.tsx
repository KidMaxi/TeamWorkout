"use client";

import { useActionState, useRef, useState } from "react";
import { Trash2, TriangleAlert, UserMinus, LogOut } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { DangerResult } from "@/app/actions";

const ICONS = { trash: Trash2, removeUser: UserMinus, leave: LogOut, warning: TriangleAlert } as const;

type Props = {
  /** Server action bound to its target; receives the dialog's FormData. */
  action: (formData: FormData) => Promise<DangerResult | void>;
  icon: keyof typeof ICONS;
  /** Visible button label; omit for an icon-only button (then `label` is the aria-label). */
  label: string;
  iconOnly?: boolean;
  title: string;
  body?: string;
  /** If set, the user must type this text before the confirm button enables. */
  requireText?: string;
  className?: string;
};

export function ConfirmButton({ action, icon, label, iconOnly, title, body, requireText, className = "" }: Props) {
  const { t } = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [state, formAction, pending] = useActionState<DangerResult, FormData>(
    async (_prev, fd) => (await action(fd)) ?? {},
    {},
  );
  const Icon = ICONS[icon];
  const ok = !requireText || typed.trim().toLowerCase() === requireText.trim().toLowerCase();

  function close() {
    ref.current?.close();
    setTyped("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
        className={
          iconOnly
            ? `inline-grid size-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-[var(--danger-bg)] hover:text-danger ${className}`
            : `btn btn-danger inline-flex min-h-11 items-center justify-center gap-2 ${className}`
        }
      >
        <Icon size={iconOnly ? 18 : 18} aria-hidden />
        {!iconOnly && label}
      </button>
      <dialog ref={ref} className="confirm !rounded-3xl !p-6" onClose={() => setTyped("")}>
        <form action={formAction} className="flex flex-col gap-4">
          <span
            aria-hidden
            className="grid size-12 place-items-center rounded-full text-danger"
            style={{ background: "var(--danger-bg)", boxShadow: "0 0 0 1px color-mix(in srgb, var(--danger) 35%, transparent)" }}
          >
            <TriangleAlert size={22} />
          </span>
          <div className="flex flex-col gap-2">
            <h2 className="display text-2xl leading-tight">{title}</h2>
            {body && <p className="text-sm text-muted">{body}</p>}
          </div>
          {requireText && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted">{t("danger.typeToConfirm", { text: requireText })}</span>
              <input
                name="confirm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                className="input min-h-11"
              />
            </label>
          )}
          {state.error && <p role="alert" className="text-sm text-danger">{t(state.error)}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={close} className="btn min-h-11 sm:min-w-28">{t("common.cancel")}</button>
            <button
              disabled={!ok || pending}
              className="btn btn-danger inline-flex min-h-11 items-center justify-center gap-2 !bg-[var(--danger)] !text-[var(--background)]"
            >
              <Icon size={16} aria-hidden />
              {pending ? t("common.loading") : label}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
