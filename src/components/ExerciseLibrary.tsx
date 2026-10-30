"use client";

import { useActionState, useMemo, useState } from "react";
import {
  Cable, ChevronDown, CircleDot, Cog, Dumbbell, Ellipsis, ExternalLink, PersonStanding, Search, Sparkles, Spline, Weight,
} from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { Equipment, ExerciseRow } from "@/lib/exercises";
import { EQUIPMENT, MUSCLES } from "@/lib/exercises";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ExerciseForm } from "@/components/ExerciseForm";
import {
  archiveExercise, seedStarterExercises, type SeedResult,
} from "@/app/team/[id]/strength/exercises/actions";

const EQUIPMENT_ICON: Record<Equipment, typeof Dumbbell> = {
  none: CircleDot,
  bodyweight: PersonStanding,
  barbell: Dumbbell,
  trap_bar: Weight,
  dumbbell: Dumbbell,
  kettlebell: Weight,
  machine: Cog,
  cable: Cable,
  band: Spline,
  other: Ellipsis,
};

const label = "eyebrow flex items-center gap-1.5";
const isHttps = (u: string | null): u is string => !!u && u.startsWith("https://");

export function ExerciseLibrary({ teamId, exercises, isStaff }: { teamId: string; exercises: ExerciseRow[]; isStaff: boolean }) {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [equipment, setEquipment] = useState("");
  const [muscle, setMuscle] = useState("");
  const [noPrimary, setNoPrimary] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return exercises.filter((e) => {
      if (equipment && e.equipment !== equipment) return false;
      if (muscle && e.primary_muscle !== muscle) return false;
      if (noPrimary && e.primary_muscle) return false;
      if (!needle) return true;
      const hay = [
        e.name,
        t(`exercises.equipment.${e.equipment}`),
        e.primary_muscle ? t(`exercises.muscle.${e.primary_muscle}`) : "",
      ].join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [exercises, q, equipment, muscle, noPrimary, t]);

  const filtering = !!(q || equipment || muscle || noPrimary);
  function reset() { setQ(""); setEquipment(""); setMuscle(""); setNoPrimary(false); }

  if (!exercises.length) {
    return (
      <div className="flex flex-col gap-4">
        {isStaff && <div className="flex justify-end"><ExerciseForm teamId={teamId} /></div>}
        <EmptyState teamId={teamId} isStaff={isStaff} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <label className="relative block">
          <span className="sr-only">{t("exercises.search.label")}</span>
          <Search size={18} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={t("exercises.search.ph")} autoComplete="off"
            className="input min-h-12 w-full !pl-11"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={label}>{t("exercises.filter.equipment")}</span>
            <select value={equipment} onChange={(e) => setEquipment(e.target.value)} className="input min-h-11 w-full">
              <option value="">{t("exercises.filter.all")}</option>
              {EQUIPMENT.map((e) => <option key={e} value={e}>{t(`exercises.equipment.${e}`)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={label}>{t("exercises.filter.muscle")}</span>
            <select value={muscle} onChange={(e) => setMuscle(e.target.value)} className="input min-h-11 w-full">
              <option value="">{t("exercises.filter.all")}</option>
              {MUSCLES.map((m) => <option key={m} value={m}>{t(`exercises.muscle.${m}`)}</option>)}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button" aria-pressed={noPrimary} onClick={() => setNoPrimary((v) => !v)}
            className={`chip min-h-11 !px-4 text-sm transition-colors ${noPrimary ? "!border-[var(--accent)] !bg-[var(--accent-soft)] !text-[var(--foreground)]" : ""}`}
          >
            {t("exercises.filter.noPrimary")}
          </button>
          {filtering && (
            <button type="button" onClick={reset} className="link min-h-11 px-2 text-sm">{t("exercises.filter.reset")}</button>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted" aria-live="polite">
            {filtered.length === 1 ? t("exercises.count.one") : t("exercises.count.many", { n: filtered.length })}
          </p>
          {isStaff && <ExerciseForm teamId={teamId} />}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-muted">{t("exercises.empty.filtered")}</p>
      ) : (
        <ul className="stagger flex flex-col gap-3">
          {filtered.map((e) => <Row key={e.id} e={e} teamId={teamId} isStaff={isStaff} />)}
        </ul>
      )}
    </div>
  );
}

function Row({ e, teamId, isStaff }: { e: ExerciseRow; teamId: string; isStaff: boolean }) {
  const { t } = useT();
  const Icon = EQUIPMENT_ICON[e.equipment];
  const meta = [
    e.primary_muscle ? t(`exercises.muscle.${e.primary_muscle}`) : t("exercises.detail.noPrimary"),
    t(`exercises.equipment.${e.equipment}`),
    t(`exercises.kind.${e.kind}`) + (e.per_side ? ` (${t("exercises.detail.perSide")})` : ""),
  ].join(" · ");
  const media = e.media_kind !== "none" && isHttps(e.media_url) ? e.media_url : null;

  return (
    <li className="card group !p-0 text-sm">
      <details>
        <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
          <span
            aria-hidden
            className="grid size-11 shrink-0 place-items-center rounded-full text-[var(--accent)]"
            style={{
              background: "linear-gradient(145deg, var(--surface-3), var(--surface-2))",
              boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent)",
            }}
          >
            <Icon size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate font-semibold">{e.name}</span>
            <span className="truncate text-xs text-muted">{meta}</span>
          </span>
          <ChevronDown size={16} aria-hidden className="shrink-0 text-muted transition-transform [details[open]_&]:rotate-180" />
        </summary>

        <div className="flex flex-col gap-4 border-t px-4 pb-4 pt-4">
          <div className="flex flex-col gap-1.5">
            <h3 className={`${label} !font-sans`}>{t("exercises.detail.instructions")}</h3>
            <p className="whitespace-pre-line leading-relaxed">{e.instructions}</p>
          </div>

          {e.other_muscles.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <h3 className={`${label} !font-sans`}>{t("exercises.detail.other")}</h3>
              <ul className="flex flex-wrap gap-1.5">
                {e.other_muscles.map((m) => <li key={m} className="chip">{t(`exercises.muscle.${m}`)}</li>)}
              </ul>
            </div>
          )}

          {(e.track_pr || e.track_5rm) && (
            <div className="flex flex-wrap gap-2">
              {e.track_pr && <span className="badge badge-ok">{t("exercises.detail.pr")}</span>}
              {e.track_5rm && <span className="badge badge-watch">{t("exercises.detail.5rm")}</span>}
            </div>
          )}

          {media && e.media_kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media} alt={t("exercises.detail.mediaAlt", { name: e.name })} loading="lazy" referrerPolicy="no-referrer"
              className="max-h-80 w-full rounded-2xl border object-contain" style={{ background: "var(--surface-2)" }}
            />
          )}
          {media && e.media_kind === "video" && (
            <a href={media} target="_blank" rel="noopener noreferrer" className="btn inline-flex min-h-11 w-fit items-center gap-2">
              <ExternalLink size={16} aria-hidden />{t("exercises.detail.video")}
            </a>
          )}

          {isStaff && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              <ExerciseForm teamId={teamId} exercise={e} />
              <ConfirmButton
                action={archiveExercise.bind(null, teamId, e.id)}
                icon="trash"
                label={t("exercises.archive.label")}
                title={t("exercises.archive.title")}
                body={t("exercises.archive.body")}
              />
            </div>
          )}
        </div>
      </details>
    </li>
  );
}

function EmptyState({ teamId, isStaff }: { teamId: string; isStaff: boolean }) {
  const { t } = useT();
  const [res, formAction, pending] = useActionState<SeedResult | null, FormData>(
    async () => seedStarterExercises(teamId),
    null,
  );
  return (
    <div className="card card-hero flex flex-col items-center gap-3 py-8 text-center text-sm">
      <span
        aria-hidden
        className="grid size-12 place-items-center rounded-full text-[var(--accent)]"
        style={{
          background: "linear-gradient(145deg, var(--surface-3), var(--surface-2))",
          boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent)",
        }}
      >
        <Dumbbell size={22} />
      </span>
      <h2 className="display text-xl">{t("exercises.empty.title")}</h2>
      <p className="max-w-xs text-muted">{isStaff ? t("exercises.empty.staff") : t("exercises.empty.athlete")}</p>
      {isStaff && (
        <form action={formAction} className="flex flex-col items-center gap-2">
          <button disabled={pending} className="btn btn-primary inline-flex min-h-11 items-center gap-2">
            <Sparkles size={18} aria-hidden />{pending ? t("exercises.seed.busy") : t("exercises.seed.cta")}
          </button>
          {res?.error && <p role="alert" className="text-danger">{t(res.error)}</p>}
          {res && !res.error && res.added === 0 && <p className="text-muted">{t("exercises.seed.none")}</p>}
        </form>
      )}
    </div>
  );
}
