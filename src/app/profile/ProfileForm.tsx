"use client";

import { useActionState } from "react";
import { Cake, Check, Languages, LogOut, Mail, Ruler, Scale, ShieldCheck, User } from "lucide-react";
import { signOut } from "@/app/actions";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useT } from "@/lib/i18n/client";
import { updateProfile, type ProfileResult } from "./actions";

type Initial = { fullName: string; birthDate: string; heightCm: string; weightKg: string };

function initials(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const s = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? email).slice(0, 2);
  return s.toUpperCase();
}

function ageOf(birth: string) {
  const d = new Date(`${birth}T00:00:00`);
  if (!birth || Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--;
  return a >= 0 && a < 130 ? a : null;
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <span className="flex items-center gap-2">
        <span className="text-muted" aria-hidden>{icon}</span>
        {children}
      </span>
    </label>
  );
}

export function ProfileForm({ email, initial }: { email: string; initial: Initial }) {
  const { t } = useT();
  const [state, action, pending] = useActionState<ProfileResult | null, FormData>(updateProfile, null);
  const age = ageOf(initial.birthDate);

  return (
    <div className="space-y-4">
      <section className="card flex items-center gap-4">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-xl font-bold text-[var(--on-primary)]"
          aria-hidden
        >
          {initials(initial.fullName, email)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{initial.fullName || email}</p>
          <p className="flex items-center gap-1.5 truncate text-sm text-muted">
            <Mail size={14} aria-hidden className="shrink-0" />
            <span className="truncate" title={t("profile.email")}>{email}</span>
          </p>
          {age !== null && <p className="text-xs text-muted">{t("profile.age", { n: age })}</p>}
        </div>
      </section>

      <form action={action} className="card space-y-3">
        <Field icon={<User size={18} />} label={t("profile.fullName")}>
          <input name="full_name" className="input w-full" maxLength={80} defaultValue={initial.fullName} autoComplete="name" />
        </Field>
        <Field icon={<Cake size={18} />} label={t("profile.birthDate")}>
          <input name="birth_date" type="date" className="input w-full" defaultValue={initial.birthDate} autoComplete="bday" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field icon={<Ruler size={18} />} label={t("profile.height")}>
            <input name="height_cm" type="number" inputMode="numeric" min={100} max={250} step={1} className="input w-full" defaultValue={initial.heightCm} />
          </Field>
          <Field icon={<Scale size={18} />} label={t("profile.weight")}>
            <input name="weight_kg" type="number" inputMode="decimal" min={30} max={250} step={0.1} className="input w-full" defaultValue={initial.weightKg} />
          </Field>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Languages size={18} aria-hidden className="text-muted" />
            {t("profile.language")}
          </span>
          <LanguageSwitcher />
        </div>
        <p className="flex items-start gap-2 text-xs text-muted">
          <ShieldCheck size={16} aria-hidden className="mt-px shrink-0" />
          {t("profile.privacy")}
        </p>
        <div className="flex items-center gap-3" aria-live="polite">
          <button type="submit" className="btn btn-primary" disabled={pending}>
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

      <form action={signOut}>
        <button type="submit" className="btn w-full">
          <LogOut size={16} aria-hidden />
          {t("common.logout")}
        </button>
      </form>
    </div>
  );
}
