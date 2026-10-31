"use client";

import { useState, useTransition } from "react";
import { setStaffKind } from "@/app/actions";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";
import { STAFF_KINDS, type StaffKind } from "@/lib/roles";

/** Head coach changes the staff kind of a member. The database re-checks everything. */
export function StaffKindSelect({ teamId, userId, name, kind }: { teamId: string; userId: string; name: string; kind: StaffKind }) {
  const { t } = useT();
  const [value, setValue] = useState<StaffKind>(kind);
  const [error, setError] = useState<MessageKey | null>(null);
  const [pending, start] = useTransition();

  function change(next: StaffKind) {
    const prev = value;
    setValue(next);
    setError(null);
    start(async () => {
      const r = await setStaffKind(teamId, userId, next);
      if (!r.ok) {
        setValue(prev);
        setError(r.error ?? "roles.error.generic");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1.5">
        <span className="eyebrow">{t("roles.kind.label")}</span>
        <select
          value={value}
          disabled={pending}
          aria-label={t("roles.kind.change", { name })}
          onChange={(e) => change(e.target.value as StaffKind)}
          className="input min-h-11 w-full"
        >
          {STAFF_KINDS.map((k) => <option key={k} value={k}>{t(`common.staffKind.${k}`)}</option>)}
        </select>
      </label>
      {error && <p role="alert" className="text-sm text-danger">{t(error)}</p>}
    </div>
  );
}
