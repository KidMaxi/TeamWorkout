"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Calculator, Check, ChevronDown, Dumbbell, Plus } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { dateLocale, type MessageKey } from "@/lib/i18n";
import { estimateFiveRM, roundToStep, weightFor } from "@/lib/strength";
import { ConfirmButton } from "@/components/ConfirmButton";
import { deleteStrengthTest, saveStrengthTest } from "@/app/team/[id]/strength/actions";

export type StrengthTest = {
  id: string;
  exercise_id: string;
  tested_at: string;
  weight_kg: number;
  reps: number;
  rpe: number;
  five_rm_kg: number;
  estimated: boolean;
  note: string | null;
};
export type TrackedExercise = { id: string; name: string };

const RPES = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
const REPS = Array.from({ length: 12 }, (_, i) => i + 1);
const TABLE_REPS = [1, 2, 3, 4, 5, 6, 7, 8];
const TABLE_RPES = [7, 8, 9, 10];
const HISTORY_MAX = 8;

const label = "eyebrow";

export function StrengthTests({
  teamId, athleteId, today, exercises, tests,
}: {
  teamId: string;
  athleteId: string;
  today: string;
  exercises: TrackedExercise[];
  /** Sorted newest first (tested_at, then created_at). */
  tests: StrengthTest[];
}) {
  const { t, locale } = useT();
  const loc = dateLocale(locale);
  const fmt = (n: number) => n.toLocaleString(loc, { maximumFractionDigits: 1 });
  const fmtDate = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  const byExercise = useMemo(() => {
    const m = new Map<string, StrengthTest[]>();
    for (const x of tests) m.set(x.exercise_id, [...(m.get(x.exercise_id) ?? []), x]);
    return m;
  }, [tests]);

  // ---- add-test form ----
  const formRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [exerciseId, setExerciseId] = useState(exercises[0]?.id ?? "");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState(5);
  const [rpe, setRpe] = useState(9);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState<MessageKey | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);
  const [pending, start] = useTransition();

  const weightNum = /^\d{1,4}([.,]\d{1,2})?$/.test(weight.trim()) ? Number(weight.trim().replace(",", ".")) : null;
  const est = weightNum && weightNum > 0 ? estimateFiveRM(weightNum, reps, rpe) : null;
  const outOfTable = weightNum !== null && weightNum > 0 && est === null;

  function startAdd(id: string) {
    setExerciseId(id);
    setOpen(true);
    setSavedMsg(false);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    setSavedMsg(false);
    start(async () => {
      let res: Awaited<ReturnType<typeof saveStrengthTest>>;
      try {
        res = await saveStrengthTest(teamId, athleteId, fd);
      } catch {
        res = { ok: false, error: "strength.error.save" };
      }
      if (!res.ok) {
        setError(res.error ?? "strength.error.save");
        return;
      }
      setError(null);
      setWeight("");
      setNote("");
      setSavedMsg(true);
    });
  }

  // ---- calculator ----
  const withTest = exercises.filter((x) => byExercise.has(x.id));
  const [calcId, setCalcId] = useState(withTest[0]?.id ?? "");
  const [calcReps, setCalcReps] = useState(5);
  const [calcRpe, setCalcRpe] = useState(8);
  const activeCalc = withTest.find((x) => x.id === calcId) ?? withTest[0];
  const base = activeCalc ? byExercise.get(activeCalc.id)?.[0]?.five_rm_kg ?? null : null;
  const target = base ? weightFor(base, calcReps, calcRpe) : null;

  return (
    <div className="stagger flex flex-col gap-6">
      {/* overview */}
      <ul className="flex flex-col gap-3">
        {exercises.map((ex) => {
          const list = byExercise.get(ex.id) ?? [];
          const cur = list[0];
          const prev = list.slice(1, 1 + HISTORY_MAX);
          const series = [...list.slice(0, HISTORY_MAX + 1)].reverse();
          const lo = Math.min(...series.map((s) => s.five_rm_kg));
          const hi = Math.max(...series.map((s) => s.five_rm_kg));
          return (
            <li key={ex.id} className="card flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 truncate font-semibold">{ex.name}</h3>
                {cur && (
                  <ConfirmButton
                    action={deleteStrengthTest.bind(null, teamId, cur.id)}
                    icon="trash"
                    iconOnly
                    label={t("strength.delete.test")}
                    title={t("strength.delete.title")}
                    body={t("strength.delete.body")}
                    className="-mr-2 -mt-2"
                  />
                )}
              </div>
              {cur ? (
                <>
                  <div className="flex items-end justify-between gap-3">
                    <p className="num text-4xl">
                      {cur.estimated ? "≈ " : ""}{fmt(cur.five_rm_kg)}
                      <span className="ml-1 text-base font-semibold text-muted">{t("strength.card.kg")}</span>
                    </p>
                    {series.length > 1 && (
                      <div aria-hidden className="flex h-10 items-end gap-1">
                        {series.map((s, i) => {
                          const h = hi === lo ? 70 : 25 + ((s.five_rm_kg - lo) / (hi - lo)) * 75;
                          const last = i === series.length - 1;
                          return (
                            <span
                              key={s.id}
                              className="w-1.5 rounded-full"
                              style={{ height: `${h}%`, background: last ? "var(--primary)" : "var(--surface-3)" }}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted">
                    {fmtDate(cur.tested_at)} · {t("strength.card.tested", { weight: fmt(cur.weight_kg), reps: cur.reps, rpe: fmt(cur.rpe) })}
                  </p>
                  {prev.length > 0 && (
                    <details className="group border-t pt-2">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm text-muted [&::-webkit-details-marker]:hidden">
                        {t("strength.card.history")}
                        <ChevronDown size={16} aria-hidden className="transition-transform group-open:rotate-180" />
                      </summary>
                      <ul className="flex flex-col">
                        {prev.map((p) => (
                          <li key={p.id} className="flex items-center justify-between gap-2 border-t py-1 text-sm first:border-t-0">
                            <span className="min-w-0 text-muted">
                              {fmtDate(p.tested_at)}
                              <span className="block text-xs">{p.weight_kg} × {p.reps} @ {fmt(p.rpe)}</span>
                            </span>
                            <span className="num text-lg">{p.estimated ? "≈ " : ""}{fmt(p.five_rm_kg)} {t("strength.card.kg")}</span>
                            <ConfirmButton
                              action={deleteStrengthTest.bind(null, teamId, p.id)}
                              icon="trash"
                              iconOnly
                              label={t("strength.delete.test")}
                              title={t("strength.delete.title")}
                              body={t("strength.delete.body")}
                              className="-mr-2"
                            />
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted">{t("strength.card.noTest")}</p>
              )}
              <button type="button" onClick={() => startAdd(ex.id)} className="btn inline-flex min-h-11 items-center justify-center gap-2 text-sm">
                <Plus size={16} aria-hidden className="text-[var(--accent)]" />{t("strength.card.addTest")}
              </button>
            </li>
          );
        })}
      </ul>

      {/* add test */}
      <div ref={formRef} className="scroll-mt-4">
        <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className="card group !p-0">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-2 px-4 font-semibold [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2"><Dumbbell size={18} aria-hidden className="text-[var(--accent)]" />{t("strength.form.title")}</span>
            <ChevronDown size={16} aria-hidden className="text-muted transition-transform group-open:rotate-180" />
          </summary>
          <form onSubmit={submit} className="grid grid-cols-2 gap-3 border-t p-4 text-sm" aria-busy={pending}>
            <label className="col-span-2 flex flex-col gap-1.5">
              <span className={label}>{t("strength.form.exercise")}</span>
              <select name="exercise_id" value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} required className="input min-h-11 w-full">
                {exercises.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={label}>{t("strength.form.weight")}</span>
              <input
                name="weight_kg" value={weight} onChange={(e) => setWeight(e.target.value)}
                inputMode="decimal" autoComplete="off" required placeholder="100"
                className="input num min-h-11 w-full text-xl"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={label}>{t("strength.form.reps")}</span>
              <select name="reps" value={reps} onChange={(e) => setReps(Number(e.target.value))} className="input min-h-11 w-full">
                {REPS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={label}>{t("strength.form.rpe")}</span>
              <select name="rpe" value={rpe} onChange={(e) => setRpe(Number(e.target.value))} className="input min-h-11 w-full">
                {RPES.map((n) => <option key={n} value={n}>{fmt(n)}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={label}>{t("strength.form.date")}</span>
              <input name="tested_at" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required className="input min-h-11 w-full" />
            </label>
            <label className="col-span-2 flex flex-col gap-1.5">
              <span className={label}>{t("strength.form.note")} ({t("common.optional")})</span>
              <input name="note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} className="input min-h-11 w-full" />
            </label>

            <div className="col-span-2 rounded-2xl border p-3" style={{ background: "var(--surface-2)" }} aria-live="polite">
              <p className={label}>{t("strength.form.preview")}</p>
              {est ? (
                <p className="num mt-1 text-2xl">
                  {est.estimated ? "≈ " : ""}
                  {est.estimated
                    ? t("strength.form.previewValue", { raw: fmt(est.fiveRmKg), rounded: fmt(roundToStep(est.fiveRmKg)) })
                    : t("strength.form.previewExact", { rounded: fmt(roundToStep(est.fiveRmKg)) })}
                </p>
              ) : outOfTable ? (
                <p className="mt-1 text-warn" style={{ color: "var(--warn)" }}>{t("strength.form.outOfTable")}</p>
              ) : (
                <p className="mt-1 text-muted">{t("strength.form.previewEmpty")}</p>
              )}
              <p className="mt-2 text-xs text-muted">{t("strength.form.hint")}</p>
            </div>

            {error && <p role="alert" className="col-span-2 text-danger">{t(error)}</p>}
            {savedMsg && (
              <p role="status" className="col-span-2 flex items-center gap-1.5 text-[var(--ok)]">
                <Check size={16} aria-hidden />{t("strength.form.saved")}
              </p>
            )}
            <button disabled={pending || !est} className="btn btn-primary col-span-2 inline-flex min-h-12 w-full items-center justify-center gap-2">
              <Check size={18} aria-hidden />{pending ? t("common.loading") : t("strength.form.save")}
            </button>
          </form>
        </details>
      </div>

      {/* calculator */}
      <section className="card card-hero flex flex-col gap-4" aria-labelledby="calc-title">
        <h2 id="calc-title" className="flex items-center gap-2 font-semibold">
          <Calculator size={18} aria-hidden className="text-[var(--accent)]" />{t("strength.calc.title")}
        </h2>
        {!activeCalc || !base ? (
          <p className="text-sm text-muted">{t("strength.calc.none")}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="col-span-2 flex flex-col gap-1.5">
                <span className={label}>{t("strength.calc.exercise")}</span>
                <select value={activeCalc.id} onChange={(e) => setCalcId(e.target.value)} className="input min-h-11 w-full">
                  {withTest.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={label}>{t("strength.calc.reps")}</span>
                <select value={calcReps} onChange={(e) => setCalcReps(Number(e.target.value))} className="input min-h-11 w-full">
                  {REPS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={label}>{t("strength.calc.rpe")}</span>
                <select value={calcRpe} onChange={(e) => setCalcRpe(Number(e.target.value))} className="input min-h-11 w-full">
                  {RPES.map((n) => <option key={n} value={n}>{fmt(n)}</option>)}
                </select>
              </label>
            </div>

            <div className="text-center" aria-live="polite">
              <p className={label}>{t("strength.calc.result")}</p>
              {target !== null ? (
                <p className="num mt-1 text-6xl">
                  {fmt(target)}<span className="ml-1 text-xl font-semibold text-muted">{t("strength.card.kg")}</span>
                </p>
              ) : (
                <p className="mt-1 text-muted">{t("strength.calc.outOfTable")}</p>
              )}
            </div>

            <div>
              <p className={`${label} mb-2`}>{t("strength.calc.tableTitle")}</p>
              <table className="w-full text-center text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="py-1 text-left">{t("strength.calc.reps")}</th>
                    {TABLE_RPES.map((r) => <th key={r} scope="col" className="py-1">RPE {r}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {TABLE_REPS.map((n) => (
                    <tr key={n} className="border-t">
                      <th scope="row" className="py-1.5 text-left !text-[var(--foreground)]">{n}</th>
                      {TABLE_RPES.map((r) => {
                        const w = weightFor(base, n, r);
                        const on = n === calcReps && r === calcRpe;
                        return (
                          <td key={r} className={`num py-1.5 text-base ${on ? "rounded-lg bg-[var(--primary)] text-[var(--on-primary)]" : ""}`}>
                            {w === null ? "–" : fmt(w)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted">{t("strength.calc.disclaimer")}</p>
          </>
        )}
      </section>
    </div>
  );
}
