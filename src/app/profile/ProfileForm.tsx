"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Cake, Check, Download, KeyRound, Languages, LogOut, Mail, Ruler, Scale, ShieldCheck, User } from "lucide-react";
import { deleteAccount, signOut } from "@/app/actions";
import { Avatar } from "@/components/Avatar";
import { ConfirmButton } from "@/components/ConfirmButton";
import { NotificationsCard } from "@/components/NotificationsCard";
import { PinDialog } from "@/components/PinDialog";
import { clearPin, setPin } from "@/app/pin-actions";
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

export function ProfileForm({
  email,
  initial,
  remindersEnabled = false,
  hasSubscription = false,
  consent = null,
  isAthlete = false,
  hasPin = false,
}: {
  email: string;
  initial: Initial;
  remindersEnabled?: boolean;
  hasSubscription?: boolean;
  consent?: React.ReactNode;
  isAthlete?: boolean;
  hasPin?: boolean;
}) {
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
            <input id="birth_date" name="birth_date" type="date" className="input min-h-11 w-full pl-10" defaultValue={initial.birthDate} autoComplete="bday" />
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

      {consent}

      {isAthlete && (
        <section className="card flex flex-col gap-3" aria-labelledby="my-pin">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="grid size-10 shrink-0 place-items-center rounded-full text-[var(--accent)]"
              style={{ background: "linear-gradient(145deg, var(--surface-3), var(--surface-2))", boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent)" }}
            >
              <KeyRound size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="my-pin" className="display text-lg">{t("pins.self.title")}</h2>
              <p className="mt-1 text-sm text-muted">{t("pins.self.body")}</p>
            </div>
          </div>
          <p className="text-sm" aria-live="polite">
            <span className={hasPin ? "text-ok" : "text-muted"}>{hasPin ? t("pins.self.set") : t("pins.self.none")}</span>
          </p>
          <p className="text-xs text-muted">{t("pins.guard")}</p>
          <div className="flex flex-wrap gap-2">
            <PinDialog
              twice
              triggerLabel={hasPin ? t("pins.action.change") : t("pins.action.set")}
              title={t("pins.dialog.titleSelf")}
              onSave={(pin) => setPin(null, pin)}
              className="flex-1"
            />
            {hasPin && (
              <ConfirmButton
                action={async () => {
                  const r = await clearPin(null);
                  return r.ok ? {} : { error: r.error };
                }}
                icon="trash"
                label={t("pins.action.remove")}
                title={t("pins.remove.title")}
                body={t("pins.remove.bodySelf")}
                className="flex-1"
              />
            )}
          </div>
        </section>
      )}

      <section className="card flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Languages size={18} aria-hidden className="text-[var(--accent)]" />
          {t("profile.language")}
        </span>
        <LanguageSwitcher />
      </section>

      <NotificationsCard initialEnabled={remindersEnabled && hasSubscription} hasSubscription={hasSubscription} />

      <section className="card flex flex-col gap-3">
        <h2 className="display text-lg">{t("consent.privacy.title")}</h2>
        <div>
          <p className="text-sm text-muted">{t("consent.export.body")}</p>
          <a href="/api/me/export" download className="btn mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2">
            <Download size={16} aria-hidden />
            {t("consent.export.button")}
          </a>
        </div>
        <nav aria-label={t("consent.privacy.title")} className="flex flex-wrap gap-x-4 text-sm">
          <Link href="/privacy" className="link inline-flex min-h-11 items-center">{t("legal.nav.privacy")}</Link>
          <Link href="/terms" className="link inline-flex min-h-11 items-center">{t("legal.nav.terms")}</Link>
          <Link href="/cookies" className="link inline-flex min-h-11 items-center">{t("legal.nav.cookies")}</Link>
        </nav>
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
