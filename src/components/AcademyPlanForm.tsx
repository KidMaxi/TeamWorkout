"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, TriangleAlert } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { SESSION_TYPE_KEY, type MessageKey } from "@/lib/i18n";
import type { SessionType } from "@/lib/load";
import { createSessions } from "@/app/team/[id]/sessions/actions";

export type FormTeam = { id: string; name: string; types: SessionType[] };
export type FormDay = { ymd: string; label: string };

const label = "eyebrow";

export function AcademyPlanForm({ teams, days, defaultDay }: { teams: FormTeam[]; days: FormDay[]; defaultDay: string }) {
  const { t } = useT();
  const router = useRouter();
  const allTypes = (["academy", "gym", "evening", "match", "other"] as SessionType[]).filter((ty) => teams.some((tm) => tm.types.includes(ty)));
  const [type, setType] = useState<SessionType>(allTypes[0]);
  const teamsForType = teams.filter((tm) => tm.types.includes(type));
  const [teamId, setTeamId] = useState(teamsForType[0]?.id ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const isGym = type === "gym";
  // Keep the chosen team valid for the chosen type.
  const effectiveTeam = teamsForType.some((tm) => tm.id === teamId) ? teamId : (teamsForType[0]?.id ?? "");

  function onType(next: SessionType) {
    setType(next);
    const list = teams.filter((tm) => tm.types.includes(next));
    if (!list.some((tm) => tm.id === teamId)) setTeamId(list[0]?.id ?? "");
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const src = new FormData(form);
    const fd = new FormData();
    fd.set("type", type);
    fd.set("title", String(src.get("title") ?? ""));
    fd.set("date", String(src.get("date") ?? ""));
    fd.set("time", String(src.get("time") ?? ""));
    fd.set("duration", String(src.get("duration") ?? ""));
    if (!isGym) fd.set("rpe", String(src.get("rpe") ?? ""));
    fd.set("repeat", "none");
    setMsg(null);
    start(async () => {
      const r = await createSessions(effectiveTeam, fd);
      if (r.ok) {
        setMsg({ ok: true, text: t("acplan.form.ok") });
        router.refresh();
      } else {
        setMsg({ ok: false, text: t((r.error ?? "acplan.form.error") as MessageKey) });
      }
    });
  }

  if (allTypes.length === 0) return null;

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3 text-sm" aria-labelledby="acplan-form-title">
      <div className="flex flex-col gap-1">
        <h2 id="acplan-form-title" className="display text-lg">{t("acplan.form.title")}</h2>
        <p className="text-xs text-muted">{t("acplan.form.hint")}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <label className="col-span-2 flex flex-col gap-1.5 lg:col-span-2">
          <span className={label}>{t("acplan.form.name")}</span>
          <input name="title" maxLength={80} placeholder={t("acplan.form.namePh")} className="input min-h-11 w-full" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>{t("acplan.form.day")}</span>
          <select name="date" defaultValue={defaultDay} className="input min-h-11 w-full">
            {days.map((d) => <option key={d.ymd} value={d.ymd}>{d.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>{t("acplan.form.time")}</span>
          <input name="time" type="time" required defaultValue="18:00" className="input min-h-11 w-full" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>{t("acplan.form.type")}</span>
          <select value={type} onChange={(e) => onType(e.target.value as SessionType)} className="input min-h-11 w-full">
            {allTypes.map((k) => <option key={k} value={k}>{t(SESSION_TYPE_KEY[k])}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>{t("acplan.form.team")}</span>
          <select value={effectiveTeam} onChange={(e) => setTeamId(e.target.value)} className="input min-h-11 w-full">
            {teamsForType.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>{t("acplan.form.minutes")}</span>
          <input name="duration" type="number" inputMode="numeric" min={1} max={600} required defaultValue={90} className="input min-h-11 w-full" />
        </label>
        {!isGym && (
          <label className="flex flex-col gap-1.5">
            <span className={label}>{t("acplan.form.rpe")}</span>
            <select name="rpe" defaultValue="6" required className="input min-h-11 w-full">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
      </div>
      <div aria-live="polite">
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className={`flex items-center gap-1.5 text-sm ${msg.ok ? "text-[var(--accent)]" : "text-[var(--danger)]"}`}>
            {msg.ok ? <Check size={14} aria-hidden /> : <TriangleAlert size={14} aria-hidden />}{msg.text}
          </p>
        )}
      </div>
      <div className="action-bar">
        <button type="submit" disabled={pending || !effectiveTeam} className="btn btn-primary min-h-11 w-full sm:w-auto">
          {pending ? t("acplan.form.saving") : t("acplan.form.submit")}
        </button>
      </div>
    </form>
  );
}
