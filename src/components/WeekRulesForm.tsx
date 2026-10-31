"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";
import { resetAthleteRules, saveWeekRules, saveWorkloadSettings, type WorkloadResult } from "@/app/team/[id]/workload/actions";
import type { WorkloadSettings } from "@/lib/workload-day";

export type RulesValues = {
  maxTrainings: number | null;
  maxGym: number | null;
  maxMatches: number | null;
  minRestDays: number | null;
};

const FIELDS: { name: string; key: keyof RulesValues; label: MessageKey; max: number }[] = [
  { name: "max_trainings", key: "maxTrainings", label: "workload.rules.maxTrainings", max: 14 },
  { name: "max_gym", key: "maxGym", label: "workload.rules.maxGym", max: 14 },
  { name: "max_matches", key: "maxMatches", label: "workload.rules.maxMatches", max: 14 },
  { name: "min_rest_days", key: "minRestDays", label: "workload.rules.minRestDays", max: 7 },
];

/**
 * Rules editor. userId null = team default; otherwise one athlete's override.
 * Empty field = no limit. For an override, `fallback` (the team default) shows as placeholder.
 */
export function WeekRulesForm({
  teamId, userId, initial, fallback, hasOverride = false,
}: {
  teamId: string;
  userId: string | null;
  initial: RulesValues;
  fallback?: RulesValues;
  hasOverride?: boolean;
}) {
  const { t } = useT();
  const [state, formAction, pending] = useActionState<WorkloadResult | null, FormData>(
    async (_prev, fd) => saveWeekRules(teamId, userId, fd),
    null,
  );
  const [resetting, startReset] = useTransition();
  const [resetState, setResetState] = useState<WorkloadResult | null>(null);
  const result = resetState ?? state;

  function reset() {
    if (userId === null) return;
    startReset(async () => setResetState(await resetAthleteRules(teamId, userId)));
  }

  const placeholder = (key: keyof RulesValues) => {
    const v = userId === null ? null : fallback?.[key] ?? null;
    return v === null ? t("workload.rules.noLimit") : t("workload.rules.default", { value: v });
  };

  return (
    <form
      action={(fd) => { setResetState(null); formAction(fd); }}
      className="flex flex-col gap-3"
    >
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <label key={f.name} className="flex flex-col gap-1.5">
            <span className="eyebrow">{t(f.label)}</span>
            <input
              name={f.name}
              type="number"
              inputMode="numeric"
              min={0}
              max={f.max}
              step={1}
              defaultValue={initial[f.key] ?? ""}
              placeholder={placeholder(f.key)}
              className="input min-h-11 w-full"
            />
          </label>
        ))}
      </div>
      <p className="text-xs text-muted">{t("workload.rules.hint")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={pending || resetting} className="btn btn-primary inline-flex min-h-11 items-center gap-2">
          <Check size={16} aria-hidden />{t("workload.rules.save")}
        </button>
        {userId !== null && hasOverride && (
          <button
            type="button"
            onClick={reset}
            disabled={pending || resetting}
            className="btn inline-flex min-h-11 items-center gap-2"
          >
            <RotateCcw size={16} aria-hidden />{t("workload.rules.useDefault")}
          </button>
        )}
      </div>
      <p role="status" aria-live="polite" className={`min-h-5 text-xs ${result && !result.ok ? "text-danger" : "text-muted"}`}>
        {result?.ok
          ? (resetState ? t("workload.rules.resetDone") : t("workload.rules.saved"))
          : result?.error ? t(result.error) : ""}
      </p>
    </form>
  );
}

const SETTING_FIELDS: {
  name: string; key: "heavyRpe" | "heavyPerDay" | "consecutiveHeavyDays" | "baselineWeeks" | "deviationPct";
  label: MessageKey; help: MessageKey; min: number; max: number; step: number;
}[] = [
  { name: "heavy_rpe", key: "heavyRpe", label: "workload.settings.heavyRpe", help: "workload.settings.heavyRpeHelp", min: 1, max: 10, step: 0.5 },
  { name: "heavy_per_day", key: "heavyPerDay", label: "workload.settings.heavyPerDay", help: "workload.settings.heavyPerDayHelp", min: 1, max: 6, step: 1 },
  { name: "consecutive_heavy_days", key: "consecutiveHeavyDays", label: "workload.settings.consecutive", help: "workload.settings.consecutiveHelp", min: 2, max: 7, step: 1 },
  { name: "baseline_weeks", key: "baselineWeeks", label: "workload.settings.baselineWeeks", help: "workload.settings.baselineWeeksHelp", min: 2, max: 12, step: 1 },
  { name: "deviation_pct", key: "deviationPct", label: "workload.settings.deviation", help: "workload.settings.deviationHelp", min: 10, max: 100, step: 1 },
];

/** Team thresholds for the day-level warnings (head coach only). Collapsed by default. */
export function WorkloadSettingsForm({ teamId, settings }: { teamId: string; settings: WorkloadSettings }) {
  const { t } = useT();
  const [state, formAction, pending] = useActionState<WorkloadResult | null, FormData>(
    async (_prev, fd) => saveWorkloadSettings(teamId, fd),
    null,
  );
  return (
    <details className="card group flex flex-col gap-3">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <SlidersHorizontal size={18} aria-hidden className="text-[var(--accent)]" />
          <span className="display text-xl">{t("workload.settings.title")}</span>
        </span>
        <ChevronDown size={18} aria-hidden className="shrink-0 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <form action={formAction} className="mt-3 flex flex-col gap-4">
        <p className="text-sm text-muted">{t("workload.settings.intro")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {SETTING_FIELDS.map((f) => (
            <label key={f.name} className="flex flex-col gap-1.5">
              <span className="eyebrow">{t(f.label)}</span>
              <input
                name={f.name}
                type="number"
                inputMode="decimal"
                min={f.min}
                max={f.max}
                step={f.step}
                required
                defaultValue={settings[f.key]}
                className="input min-h-11 w-full"
              />
              <span className="text-xs text-muted">{t(f.help)}</span>
            </label>
          ))}
        </div>
        <label className="flex min-h-11 items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-2)]/60 p-3">
          <input
            type="checkbox"
            name="show_ratio"
            defaultChecked={settings.showRatio}
            className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
          />
          <span className="flex flex-col gap-1">
            <span className="text-sm font-semibold">{t("workload.settings.showRatio")}</span>
            <span className="text-xs text-muted">{t("workload.settings.showRatioHelp")}</span>
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={pending} className="btn btn-primary inline-flex min-h-11 items-center gap-2">
            <Check size={16} aria-hidden />{t("workload.settings.save")}
          </button>
        </div>
        <p role="status" aria-live="polite" className={`min-h-5 text-xs ${state && !state.ok ? "text-danger" : "text-muted"}`}>
          {state?.ok ? t("workload.settings.saved") : state?.error ? t(state.error) : ""}
        </p>
      </form>
    </details>
  );
}
