import { dateLocale, type Locale } from "@/lib/i18n";

/** Eyebrow for the hero banners: weekday and date of today in the club time zone, e.g. "DONDERDAG 5 NOVEMBER". */
export function todayLabel(locale: Locale, now: Date = new Date()): string {
  const loc = dateLocale(locale);
  return new Intl.DateTimeFormat(loc, { timeZone: "Europe/Amsterdam", weekday: "long", day: "numeric", month: "long" })
    .format(now)
    .toLocaleUpperCase(loc);
}
