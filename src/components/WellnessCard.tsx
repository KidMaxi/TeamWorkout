"use client";

import { useState, useTransition } from "react";
import { Bed, Brain, Check, CircleAlert, Dumbbell, Pencil, Smile, Zap, type LucideIcon } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";
import { WELLNESS_ITEMS, wellnessAverage, type WellnessEntry, type WellnessItem } from "@/lib/wellness";
import { saveWellness } from "@/app/team/[id]/wellness-actions";

const ICON: Record<WellnessItem, LucideIcon> = {
  sleep: Bed, soreness: Dumbbell, fatigue: Zap, stress: Brain, mood: Smile,
};
const STEPS = [1, 2, 3, 4, 5] as const;
type Draft = Partial<Record<WellnessItem, number>>;
const PAIN_MAX = 60;
const pickCls =
  "grid min-h-12 cursor-pointer place-items-center rounded-full border border-[var(--line)] bg-[var(--surface-2)]/60 px-4 text-base font-medium transition-colors hover:border-[var(--accent)] peer-checked:border-transparent peer-checked:bg-[var(--primary)] peer-checked:text-[var(--on-primary)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)]";

export function WellnessCard({ teamId, today }: { teamId: string; today: WellnessEntry | null }) {
  const { t } = useT();
  const [saved, setSaved] = useState<WellnessEntry | null>(null);
  const entry = saved ?? today;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const [pain, setPain] = useState<boolean | null>(null);
  const [painWhere, setPainWhere] = useState("");
  const [error, setError] = useState<MessageKey | null>(null);
  const [pending, start] = useTransition();

  const complete = WELLNESS_ITEMS.every((k) => draft[k] !== undefined) && pain !== null;

  function open() {
    setDraft(entry ? { sleep: entry.sleep, soreness: entry.soreness, fatigue: entry.fatigue, stress: entry.stress, mood: entry.mood } : {});
    setPain(entry ? (entry.pain ?? false) : null);
    setPainWhere(entry?.painLocation ?? "");
    setError(null);
    setEditing(true);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!complete || pending) return;
    const fd = new FormData();
    for (const k of WELLNESS_ITEMS) fd.set(k, String(draft[k]));
    const where = painWhere.trim();
    fd.set("pain", pain ? "yes" : "no");
    if (pain) fd.set("painLocation", where);
    start(async () => {
      let res: Awaited<ReturnType<typeof saveWellness>>;
      try {
        res = await saveWellness(teamId, fd);
      } catch {
        res = { ok: false, error: "wellness.error.save" };
      }
      if (!res.ok) {
        setError(res.error ?? "wellness.error.save");
        return;
      }
      setSaved({
        day: entry?.day ?? "",
        ...(draft as Record<WellnessItem, number>),
        pain: !!pain,
        painLocation: pain && where ? where : null,
      });
      setEditing(false);
      setError(null);
    });
  }

  if (entry && !editing) {
    return (
      <div className="card flex flex-col gap-3 !py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">{t("wellness.card.done")}</p>
            <p className="num text-sm text-muted" aria-label={t("wellness.card.avg", { avg: wellnessAverage(entry) })}>
              {wellnessAverage(entry)}<span className="text-xs"> / 5</span>
            </p>
            {entry.pain && (
              <p className="mt-1.5 flex items-start gap-1.5 text-sm text-danger">
                <CircleAlert size={14} aria-hidden className="mt-0.5 shrink-0" />
                <span className="min-w-0 break-words">
                  {entry.painLocation ? t("wellness.pain.markWhere", { where: entry.painLocation }) : t("wellness.pain.mark")}
                </span>
              </p>
            )}
          </div>
          <button type="button" onClick={open} className="btn inline-flex min-h-11 items-center gap-1.5">
            <Pencil size={14} aria-hidden /> {t("wellness.card.edit")}
          </button>
        </div>
        <ul className="grid grid-cols-5 gap-1.5">
          {WELLNESS_ITEMS.map((k) => {
            const Icon = ICON[k];
            const label = t("wellness.card.value", { item: t(`wellness.item.${k}`), n: entry[k] });
            return (
              <li
                key={k}
                className="flex flex-col items-center gap-0.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 py-2"
                aria-label={label}
                title={label}
              >
                <Icon size={14} aria-hidden className="text-[var(--accent)]" />
                <span className="num text-base">{entry[k]}</span>
              </li>
            );
          })}
        </ul>
        <p className="sr-only" role="status">{saved ? t("wellness.card.saved") : ""}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-4" aria-busy={pending}>
      <div>
        <h3 className="font-semibold">{t("wellness.card.title")}</h3>
        <p className="mt-0.5 text-sm text-muted">{t("wellness.card.hint")}</p>
      </div>
      <div className="flex flex-col gap-4">
        {WELLNESS_ITEMS.map((k) => {
          const Icon = ICON[k];
          return (
            <fieldset key={k} className="m-0 min-w-0 border-0 p-0" disabled={pending}>
              <legend className="mb-2 flex items-center gap-2 p-0 text-sm font-medium">
                <Icon size={16} aria-hidden className="text-[var(--accent)]" />
                {t(`wellness.item.${k}`)}
              </legend>
              <div role="radiogroup" aria-label={t("wellness.card.group", { item: t(`wellness.item.${k}`) })} className="grid grid-cols-5 gap-2">
                {STEPS.map((n) => (
                  <label key={n} className="relative block">
                    <input
                      type="radio"
                      name={k}
                      value={n}
                      checked={draft[k] === n}
                      onChange={() => setDraft((d) => ({ ...d, [k]: n }))}
                      className="peer sr-only"
                    />
                    <span
                      className="num grid min-h-12 cursor-pointer place-items-center rounded-full border border-[var(--line)] bg-[var(--surface-2)]/60 text-lg transition-colors hover:border-[var(--accent)] peer-checked:border-transparent peer-checked:bg-[var(--primary)] peer-checked:text-[var(--on-primary)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)]"
                    >
                      {n}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
        <div className="-mt-2 flex justify-between px-1 text-[11px] text-muted" aria-hidden>
          <span>1 {t("wellness.scale.1")}</span>
          <span>5 {t("wellness.scale.5")}</span>
        </div>
        <fieldset className="m-0 min-w-0 border-0 p-0" disabled={pending}>
          <legend className="mb-2 flex items-center gap-2 p-0 text-sm font-medium">
            <CircleAlert size={16} aria-hidden className="text-[var(--accent)]" />
            {t("wellness.pain.legend")}
          </legend>
          <div role="radiogroup" aria-label={t("wellness.pain.group")} className="grid grid-cols-2 gap-2">
            {([[true, "wellness.pain.yes"], [false, "wellness.pain.no"]] as const).map(([val, label]) => (
              <label key={label} className="relative block">
                <input
                  type="radio"
                  name="pain"
                  value={val ? "yes" : "no"}
                  checked={pain === val}
                  onChange={() => setPain(val)}
                  className="peer sr-only"
                />
                <span className={pickCls}>{t(label)}</span>
              </label>
            ))}
          </div>
          {pain === true && (
            <label className="mt-3 block">
              <span className="mb-1 block text-sm text-muted">{t("wellness.pain.where")}</span>
              <input
                type="text"
                value={painWhere}
                maxLength={PAIN_MAX}
                onChange={(e) => setPainWhere(e.target.value)}
                placeholder={t("wellness.pain.placeholder")}
                autoComplete="off"
                enterKeyHint="done"
                className="input min-h-12 w-full"
              />
            </label>
          )}
        </fieldset>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{t(error)}</p>}
      <div className="flex gap-2">
        {entry && (
          <button type="button" onClick={() => setEditing(false)} disabled={pending} className="btn min-h-12">
            {t("wellness.card.cancel")}
          </button>
        )}
        <button type="submit" disabled={!complete || pending} className="btn btn-primary inline-flex min-h-12 flex-1 items-center justify-center gap-2">
          <Check size={16} aria-hidden /> {pending ? t("common.loading") : t("wellness.card.save")}
        </button>
      </div>
    </form>
  );
}
