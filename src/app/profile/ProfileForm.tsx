"use client";

import { useActionState } from "react";
import { Cake, Check, Languages, LogOut, Mail, Ruler, Scale, ShieldCheck, User } from "lucide-react";
import { deleteAccount, signOut } from "@/app/actions";
import { Avatar } from "@/components/Avatar";
import { ConfirmButton } from "@/components/ConfirmButton";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useT } from "@/lib/i18n/client";
import { updateProfile, type ProfileResult } from "./actions";

type Initial = { fullName: string; birthDate: string; heightCm: string; weightKg: string };

function ageOf(birth: string) {
  const d = new Date(`${birth}T00:00:00`);
  if (!birth || Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--;
  return a >= 0 && a < 130 ? a : null;
}

function Field({ icon: Icon, label, children }: { icon: typeof User; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      <span className="relative block">
        <Icon size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        {children}
      </span>
    </label>
  );
}

function Tile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="card flex flex-col items-center gap-1.5 px-2 py-3 text-center">
      <span className="num text-2xl">
        {value}
        {unit && <span className="ml-0.5 text-xs font-semibold text-muted">{unit}</span>}
      </span>
      <span className="eyebrow">{label}</span>
    </div>
  );
}

export function ProfileForm({ email, initial }: { email: string; initial: Initial }) {
  const { t } = useT();
  const [state, action, pending] = useActionState<ProfileResult | null, FormData>(updateProfile, null);
  const age = ageOf(initial.birthDate);
  const tiles = [
    age !== null && { label: t("profile.tile.age"), value: String(age) },
    initial.heightCm && { label: t("profile.tile.height"), value: initial.heightCm, unit: "cm" },
    initial.weightKg && { label: t("profile.tile.weight"), value: initial.weightKg, unit: "kg" },
  ].filter(Boolean) as { label: string; value: string; unit?: string }[];

  return (
    <div className="stagger space-y-4">
      <section className="card card-hero flex flex-col items-center gap-3 py-7 text-center">
        <Avatar name={initial.fullName || email} size={80} />
        <div className="min-w-0 max-w-full">
          <h1 className="display truncate text-3xl">{initial.fullName || email}</h1>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted">
            <Mail size={14} aria-hidden className="shrink-0" />
            <span className="truncate" title={t("profile.email")}>{email}</span>
          </p>
        </div>
      </section>

      {tiles.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}>
          {tiles.map((x) => <Tile key={x.label} {...x} />)}
        </div>
      )}

      <form action={action} className="space-y-4">
        <section className="card space-y-4">
          <h2 className="display text-lg">{t("profile.section.personal")}</h2>
          <Field icon={User} label={t("profile.fullName")}>
            <input name="full_name" className="input min-h-11 w-full pl-10" maxLength={80} defaultValue={initial.fullName} autoComplete="name" />
          </Field>
          <Field icon={Cake} label={t("profile.birthDate")}>
            <input name="birth_date" type="date" className="input min-h-11 w-full pl-10" defaultValue={initial.birthDate} autoComplete="bday" />
          </Field>
        </section>

        <section className="card space-y-4">
          <h2 className="display text-lg">{t("profile.section.body")}</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field icon={Ruler} label={t("profile.height")}>
              <input name="height_cm" type="number" inputMode="numeric" min={100} max={250} step={1} className="input min-h-11 w-full pl-10" defaultValue={initial.heightCm} />
            </Field>
            <Field icon={Scale} label={t("profile.weight")}>
              <input name="weight_kg" type="number" inputMode="decimal" min={30} max={250} step={0.1} className="input min-h-11 w-full pl-10" defaultValue={initial.weightKg} />
            </Field>
          </div>
          <p className="flex items-start gap-2 text-xs text-muted">
            <ShieldCheck size={16} aria-hidden className="mt-px shrink-0 text-[var(--accent)]" />
            {t("profile.privacy")}
          </p>
        </section>

        <div className="flex items-center gap-3" aria-live="polite">
          <button type="submit" className="btn btn-primary inline-flex min-h-11 flex-1 items-center justify-center gap-2" disabled={pending}>
            <Check size={16} aria-hidden />
            {t("common.save")}
          </button>
          {!pending && state?.ok && (
            <span className="inline-flex items-center gap-1 text-sm text-ok">
              <Check size={16} aria-hidden />
              {t("common.saved")}
            </span>
          )}
          {!pending && state && !state.ok && state.error && (
            <span className="text-sm text-danger">{t(state.error)}</span>
          )}
        </div>
      </form>

      <section className="card flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Languages size={18} aria-hidden className="text-[var(--accent)]" />
          {t("profile.language")}
        </span>
        <LanguageSwitcher />
      </section>

      <form action={signOut}>
        <button type="submit" className="btn inline-flex min-h-11 w-full items-center justify-center gap-2">
          <LogOut size={16} aria-hidden />
          {t("common.logout")}
        </button>
      </form>

      <div className="pt-4">
        <hr className="hairline mb-6" />
        <div className="card flex flex-col gap-2" style={{ borderColor: "color-mix(in srgb, var(--danger) 35%, var(--line))" }}>
          <ConfirmButton
            action={deleteAccount}
            icon="trash"
            label={t("danger.account.label")}
            title={t("danger.account.title")}
            body={t("danger.account.body")}
            requireText={email}
            className="self-start"
          />
        </div>
      </div>
    </div>
  );
}
