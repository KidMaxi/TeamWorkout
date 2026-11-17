"use client";

import { useState, useTransition } from "react";
import { setPlayerInfo } from "@/app/actions";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";
import { POSITIONS, isPosition, type Position } from "@/lib/positions";

/** Trainer sets the shirt number and position of an athlete. The database re-checks everything. */
export function PlayerInfoForm({ teamId, userId, jersey, position }: { teamId: string; userId: string; jersey: number | null; position: string | null }) {
  const { t } = useT();
  const initialPos: Position | "" = isPosition(position) ? position : "";
  const [num, setNum] = useState(jersey == null ? "" : String(jersey));
  const [pos, setPos] = useState<Position | "">(initialPos);
  const [saved, setSaved] = useState({ num: jersey == null ? "" : String(jersey), pos: initialPos });
  const [error, setError] = useState<MessageKey | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();
  const dirty = num !== saved.num || pos !== saved.pos;

  function save() {
    setError(null);
    setOk(false);
    const trimmed = num.trim();
    if (trimmed !== "" && !/^\d{1,2}$/.test(trimmed)) { setError("roles.error.invalidJersey"); return; }
    start(async () => {
      const r = await setPlayerInfo(teamId, userId, trimmed === "" ? null : Number(trimmed), pos === "" ? null : pos);
      if (!r.ok) setError(r.error ?? "roles.error.generic");
      else {
        setSaved({ num: trimmed === "" ? "" : String(Number(trimmed)), pos });
        setNum(trimmed === "" ? "" : String(Number(trimmed)));
        setOk(true);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[6rem_1fr] gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">{t("members.jersey")}</span>
          <input
            value={num}
            disabled={pending}
            inputMode="numeric"
            maxLength={2}
            pattern="[0-9]*"
            autoComplete="off"
            onChange={(e) => { setNum(e.target.value.replace(/\D/g, "").slice(0, 2)); setOk(false); }}
            className="input num min-h-11 w-full"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">{t("members.position")}</span>
          <select
            value={pos}
            disabled={pending}
            onChange={(e) => { setPos(isPosition(e.target.value) ? e.target.value : ""); setOk(false); }}
            className="input min-h-11 w-full"
          >
            <option value="">{t("members.position.none")}</option>
            {POSITIONS.map((p) => <option key={p} value={p}>{t(`members.pos.${p}`)}</option>)}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending || !dirty} aria-busy={pending} className="btn btn-primary min-h-11">
          {t("common.save")}
        </button>
        {ok && <span role="status" className="text-sm text-muted">{t("members.playerSaved")}</span>}
      </div>
      {error && <p role="alert" className="text-sm text-danger">{t(error)}</p>}
    </div>
  );
}
