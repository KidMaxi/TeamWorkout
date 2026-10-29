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
        className={iconOnly ? `p-1 text-danger ${className}` : `btn btn-danger inline-flex items-center gap-2 ${className}`}
      >
        <Icon size={iconOnly ? 16 : 18} aria-hidden />
        {!iconOnly && label}
      </button>
      <dialog ref={ref} className="confirm" onClose={() => setTyped("")}>
        <form action={formAction} className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <TriangleAlert size={20} aria-hidden className="shrink-0 text-danger" />
            {title}
          </h2>
          {body && <p className="text-sm text-muted">{body}</p>}
          {requireText && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">{t("danger.typeToConfirm", { text: requireText })}</span>
              <input
                name="confirm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                className="input"
              />
            </label>
          )}
          {state.error && <p role="alert" className="text-sm text-danger">{t(state.error)}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={close} className="btn">{t("common.cancel")}</button>
            <button disabled={!ok || pending} className="btn btn-danger inline-flex items-center gap-2 !bg-[var(--danger)] !text-[var(--background)]">
              <Icon size={16} aria-hidden />
              {pending ? t("common.loading") : label}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
