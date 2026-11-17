import Image from "next/image";

/**
 * Photo banner as on the Courtload demo planning page: basketball court photo on the right,
 * dark gradient on the left, small orange eyebrow, big Bebas headline and a short subtitle.
 */
export function Hero({
  eyebrow, title, subtitle, className = "",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <section className={`relative isolate overflow-hidden rounded-[var(--radius)] border ${className}`}>
      <Image
        src="/images/court-hero.jpg"
        alt=""
        fill
        priority={false}
        sizes="(min-width: 1024px) 1024px, 100vw"
        className="-z-20 object-cover object-right"
      />
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: "linear-gradient(90deg, oklch(18% 0 0 / 0.88), oklch(18% 0 0 / 0.1))" }} />
      <div className="flex min-h-40 flex-col justify-center gap-1.5 px-5 py-6 sm:min-h-52 sm:px-8">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="display text-3xl uppercase sm:text-5xl">{title}</h2>
        {subtitle && <p className="text-sm text-[oklch(95.5%_0.01_85)]">{subtitle}</p>}
      </div>
    </section>
  );
}
