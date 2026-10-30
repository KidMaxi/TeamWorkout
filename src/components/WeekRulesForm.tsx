"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, RotateCcw } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";
import { resetAthleteRules, saveWeekRules, type WorkloadResult } from "@/app/team/[id]/workload/actions";

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
