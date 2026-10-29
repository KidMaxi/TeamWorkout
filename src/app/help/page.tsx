import Link from "next/link";
import {
  Activity, ChevronLeft, ClipboardCheck, Gauge, HeartPulse, LineChart, CalendarPlus, Info,
  Percent, ShieldAlert, Users, type LucideIcon,
} from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { LogoMark } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import type { MessageKey } from "@/lib/i18n";

function Section({ id, icon: Icon, title, children }: { id: string; icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-20 space-y-2">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Icon size={20} aria-hidden className="shrink-0 text-primary" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-muted marker:text-[var(--primary)]">
      {items.map((i) => <li key={i}>{i}</li>)}
    </ul>
  );
}

const RPE_BG = (n: number) => (n <= 3 ? "badge-ok" : n <= 6 ? "badge-none" : n <= 8 ? "badge-watch" : "badge-high");

export default async function HelpPage() {
  const { t } = await getT();
  const steps: { icon: LucideIcon; title: MessageKey; text: MessageKey }[] = [
    { icon: CalendarPlus, title: "help.step.plan", text: "help.step.plan.text" },
    { icon: ClipboardCheck, title: "help.step.log", text: "help.step.log.text" },
    { icon: LineChart, title: "help.step.review", text: "help.step.review.text" },
  ];
  const ratioBands: { range: string; label: MessageKey; cls: string }[] = [
    { range: "< 0.8", label: "help.ratio.low", cls: "badge-none" },
    { range: "0.8–1.3", label: "help.ratio.ok", cls: "badge-ok" },
    { range: "1.3–1.5", label: "help.ratio.watch", cls: "badge-watch" },
    { range: "> 1.5", label: "help.ratio.high", cls: "badge-high" },
  ];

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-10">
      <header className="flex items-center justify-between py-3">
        <Link href="/" className="inline-flex items-center gap-1.5" aria-label={t("common.back")}>
          <ChevronLeft size={20} aria-hidden />
          <LogoMark size={24} />
          <span className="text-lg font-bold">{t("help.title")}</span>
        </Link>
        <LanguageSwitcher />
      </header>

      <div className="space-y-3">
        <section className="card">
          <h2 className="mb-3 text-base font-semibold">{t("help.intro")}</h2>
          <ol className="grid grid-cols-3 gap-2 text-center">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-lg bg-[var(--surface-2)] p-2">
                <s.icon size={22} aria-hidden className="mx-auto text-primary" />
                <p className="mt-1 text-sm font-semibold">{i + 1}. {t(s.title)}</p>
                <p className="text-xs text-muted">{t(s.text)}</p>
              </li>
            ))}
          </ol>
        </section>

        <Section id="rpe" icon={Gauge} title={t("help.rpe.title")}>
          <Bullets items={[t("help.rpe.b1"), t("help.rpe.b2")]} />
          <div>
            <div className="grid grid-cols-10 gap-1" aria-hidden>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <span key={n} className={`badge ${RPE_BG(n)} justify-center`}>{n}</span>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>1 {t("help.rpe.easy")}</span>
              <span>10 {t("help.rpe.hard")}</span>
            </div>
          </div>
        </Section>

        <Section id="load" icon={Activity} title={t("help.load.title")}>
          <Bullets items={[t("help.load.b1"), t("help.load.b2"), t("help.load.b3")]} />
        </Section>

        <Section id="ratio" icon={Percent} title={t("help.ratio.title")}>
          <Bullets items={[t("help.ratio.b1"), t("help.ratio.b2"), t("help.ratio.b3")]} />
          <div className="flex flex-wrap gap-1.5">
            {ratioBands.map((b) => (
              <span key={b.range} className={`badge ${b.cls}`}>{b.range} {t(b.label)}</span>
            ))}
          </div>
        </Section>

        <Section id="availability" icon={HeartPulse} title={t("help.availability.title")}>
          <div className="flex flex-wrap gap-1.5">
            <span className="badge badge-ok">{t("common.availability.available")}</span>
            <span className="badge badge-watch">{t("common.availability.limited")}</span>
            <span className="badge badge-high">{t("common.availability.unavailable")}</span>
          </div>
          <Bullets items={[t("help.availability.b1"), t("help.availability.b2")]} />
        </Section>

        <Section id="limits" icon={ShieldAlert} title={t("help.limits.title")}>
          <Bullets items={[t("help.limits.b1"), t("help.limits.b2")]} />
        </Section>

        <Section id="roles" icon={Users} title={t("help.roles.title")}>
          <Bullets items={[t("help.roles.staff"), t("help.roles.athlete"), t("help.roles.noRatio")]} />
        </Section>

        <p className="flex items-center gap-2 text-xs text-muted">
          <Info size={14} aria-hidden className="shrink-0" />
          {t("help.disclaimer")}
        </p>
        <Link href="/" className="btn flex w-full items-center justify-center gap-2">
          <ChevronLeft size={16} aria-hidden />
          {t("help.backToApp")}
        </Link>
      </div>
    </div>
  );
}
