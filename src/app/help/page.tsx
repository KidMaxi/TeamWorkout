import Link from "next/link";
import {
  Activity, Bell, CalendarDays, CalendarPlus, ChevronLeft, ClipboardCheck, Dumbbell, Gauge, HeartPulse, Info,
  LineChart, Lock, Percent, ShieldAlert, SmilePlus, Users, type LucideIcon,
} from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { LogoMark } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import type { MessageKey } from "@/lib/i18n";

function Section({ id, icon: Icon, title, children }: { id: string; icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-20 space-y-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--accent)]"
          style={{ boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent)", background: "var(--accent-soft)" }}
        >
          <Icon size={18} />
        </span>
        <h2 className="display text-lg leading-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2.5 pl-5 text-sm leading-relaxed text-muted marker:text-[var(--accent)]">
      {items.map((i) => <li key={i}>{i}</li>)}
    </ul>
  );
}

const RPE_BG = (n: number) => (n <= 3 ? "badge-ok" : n <= 6 ? "badge-none" : n <= 8 ? "badge-watch" : "badge-high");

export default async function HelpPage() {
  const { t } = await getT();
  const steps: { icon: LucideIcon; title: MessageKey; text: MessageKey }[] = [
    { icon: CalendarPlus, title: "help.pipeline.s1", text: "help.pipeline.s1.text" },
    { icon: ClipboardCheck, title: "help.pipeline.s2", text: "help.pipeline.s2.text" },
    { icon: SmilePlus, title: "help.pipeline.s3", text: "help.pipeline.s3.text" },
    { icon: LineChart, title: "help.pipeline.s4", text: "help.pipeline.s4.text" },
  ];
  const toc: { id: string; label: MessageKey }[] = [
    { id: "pipeline", label: "help.pipeline.title" },
    { id: "checkin", label: "help.checkin.title" },
    { id: "week", label: "help.week.title" },
    { id: "gym", label: "help.gym.title" },
    { id: "rpe", label: "help.rpe.title" },
    { id: "load", label: "help.load.title" },
    { id: "ratio", label: "help.ratio.title" },
    { id: "availability", label: "help.availability.title" },
    { id: "limits", label: "help.limits.title" },
    { id: "roles", label: "help.roles.title" },
    { id: "notifications", label: "help.notifications.title" },
    { id: "privacy", label: "help.privacy.title" },
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
        <Link href="/" className="inline-flex min-h-10 items-center gap-2" aria-label={t("common.back")}>
          <ChevronLeft size={20} aria-hidden className="text-[var(--accent)]" />
          <LogoMark size={24} />
          <span className="display text-xl">{t("help.title")}</span>
        </Link>
        <LanguageSwitcher />
      </header>

      <div className="stagger space-y-4">
        <nav aria-label={t("help.toc.label")} className="-mx-4 overflow-x-auto px-4">
          <p className="mb-2 px-1 text-xs uppercase tracking-wide text-muted">{t("help.toc")}</p>
          <ul className="flex gap-2 pb-1">
            {toc.map((c) => (
              <li key={c.id} className="shrink-0">
                <a href={`#${c.id}`} className="chip inline-flex min-h-11 items-center px-4 text-sm">{t(c.label)}</a>
              </li>
            ))}
          </ul>
        </nav>

        <section id="pipeline" className="card card-hero scroll-mt-20">
          <h1 className="display text-2xl">{t("help.intro")}</h1>
          <h2 className="mt-1 text-sm text-muted">{t("help.pipeline.title")}</h2>
          <ol className="mt-5 space-y-0">
            {steps.map((s, i) => (
              <li key={s.title} className="relative flex gap-4 pb-6 last:pb-0">
                {i < steps.length - 1 && (
                  <span aria-hidden className="absolute bottom-0 left-5 top-10 w-px -translate-x-1/2" style={{ background: "linear-gradient(var(--accent), transparent)", opacity: 0.5 }} />
                )}
                <span
                  aria-hidden
                  className="num relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-base text-[var(--accent)]"
                  style={{ background: "linear-gradient(145deg, var(--surface-3), var(--surface-2))", boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent)" }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 pt-1">
                  <p className="flex items-center gap-2 font-semibold">
                    <s.icon size={16} aria-hidden className="text-primary" />
                    {t(s.title)}
                  </p>
                  <p className="mt-1 text-sm text-muted">{t(s.text)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <Section id="checkin" icon={SmilePlus} title={t("help.checkin.title")}>
          <Bullets items={[t("help.checkin.b1"), t("help.checkin.b2"), t("help.checkin.b3")]} />
        </Section>

        <Section id="week" icon={CalendarDays} title={t("help.week.title")}>
          <Bullets items={[t("help.week.b1"), t("help.week.b2"), t("help.week.b3")]} />
        </Section>

        <Section id="gym" icon={Dumbbell} title={t("help.gym.title")}>
          <Bullets items={[t("help.gym.b1"), t("help.gym.b2"), t("help.gym.b3"), t("help.gym.b4"), t("help.gym.b5")]} />
        </Section>

        <Section id="rpe" icon={Gauge} title={t("help.rpe.title")}>
          <Bullets items={[t("help.rpe.b1"), t("help.rpe.b2")]} />
          <div>
            <div className="flex gap-1" aria-hidden>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <span key={n} className={`badge ${RPE_BG(n)} min-w-0 flex-1 justify-center px-0 py-1 before:hidden`}>{n}</span>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted">
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
          <div className="flex flex-wrap gap-2">
            {ratioBands.map((b) => (
              <span key={b.range} className={`badge ${b.cls}`}>{b.range} {t(b.label)}</span>
            ))}
          </div>
        </Section>

        <Section id="availability" icon={HeartPulse} title={t("help.availability.title")}>
          <div className="flex flex-wrap gap-2">
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

        <Section id="notifications" icon={Bell} title={t("help.notifications.title")}>
          <Bullets items={[t("help.notifications.b1"), t("help.notifications.b2"), t("help.notifications.b3")]} />
        </Section>

        <Section id="privacy" icon={Lock} title={t("help.privacy.title")}>
          <Bullets items={[t("help.privacy.b1")]} />
          <div className="flex flex-wrap gap-2">
            <Link href="/privacy" className="chip min-h-11 px-4 text-sm">{t("help.privacy.link")}</Link>
            <Link href="/terms" className="chip min-h-11 px-4 text-sm">{t("help.terms.link")}</Link>
            <Link href="/cookies" className="chip min-h-11 px-4 text-sm">{t("help.cookies.link")}</Link>
          </div>
        </Section>

        <p className="flex items-center gap-2 px-1 text-xs text-muted">
          <Info size={14} aria-hidden className="shrink-0" />
          {t("help.disclaimer")}
        </p>
        <Link href="/" className="btn flex min-h-11 w-full items-center justify-center gap-2">
          <ChevronLeft size={16} aria-hidden />
          {t("help.backToApp")}
        </Link>
      </div>
    </div>
  );
}
