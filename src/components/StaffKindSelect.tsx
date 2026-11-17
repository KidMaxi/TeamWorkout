"use client";

import { useState, useTransition } from "react";
import { setStaffKinds } from "@/app/actions";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";
import { EXTRA_KINDS, STAFF_KINDS, type StaffKind } from "@/lib/roles";

const focusRing = "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)]";

/** Head coach sets the primary role and the additional roles of a staff member. The database re-checks everything. */
export function StaffKindSelect({ teamId, userId, name, kind, extra }: { teamId: string; userId: string; name: string; kind: StaffKind; extra: StaffKind[] }) {
  const { t } = useT();
  const [primary, setPrimary] = useState<StaffKind>(kind);
  const [extras, setExtras] = useState<StaffKind[]>(extra);
  const [saved, setSaved] = useState({ kind, extra });
  const [error, setError] = useState<MessageKey | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  // The primary role cannot also be an extra; head already covers everything and is never an extra.
  const effective = extras.filter((k) => k !== primary);
  const dirty = primary !== saved.kind || effective.join() !== saved.extra.join();

  function toggle(k: StaffKind, on: boolean) {
    setOk(false);
    setExtras((cur) => (on ? [...cur.filter((x) => x !== k), k] : cur.filter((x) => x !== k)));
  }

  function save() {
    setError(null);
    setOk(false);
    const next = { kind: primary, extra: EXTRA_KINDS.filter((k) => effective.includes(k)) };
    start(async () => {
      const r = await setStaffKinds(teamId, userId, next.kind, next.extra);
      if (!r.ok) setError(r.error ?? "roles.error.generic");
      else {
        setSaved(next);
        setExtras(next.extra);
        setOk(true);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="eyebrow">{t("roles.kind.label")}</span>
        <select
          value={primary}
          disabled={pending}
          aria-label={t("roles.kind.change", { name })}
          onChange={(e) => { setPrimary(e.target.value as StaffKind); setOk(false); }}
          className="input min-h-11 w-full"
        >
          {STAFF_KINDS.map((k) => <option key={k} value={k}>{t(`common.staffKind.${k}`)}</option>)}
        </select>
      </label>
      <fieldset className="flex flex-col gap-1.5" disabled={pending}>
        <legend className="eyebrow mb-1.5">{t("roles.kind.extra")}</legend>
        <div className="flex flex-wrap gap-1.5">
          {EXTRA_KINDS.filter((k) => k !== primary).map((k) => (
            <label key={k} className="relative cursor-pointer">
              <input
                type="checkbox"
                checked={effective.includes(k)}
                onChange={(e) => toggle(k, e.target.checked)}
                className="peer sr-only"
              />
              <span className={`chip min-h-11 px-3.5 text-sm peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent-soft)] peer-checked:text-[var(--foreground)] ${focusRing}`}>
                {t(`common.staffKind.${k}`)}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted">{t("roles.kind.extraHint")}</p>
      </fieldset>
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending || !dirty} aria-busy={pending} className="btn btn-primary min-h-11">
          {t("roles.kind.save")}
        </button>
        {ok && <span role="status" className="text-sm text-muted">{t("roles.kind.saved")}</span>}
      </div>
      {error && <p role="alert" className="text-sm text-danger">{t(error)}</p>}
    </div>
  );
}
