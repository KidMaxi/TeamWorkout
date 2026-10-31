import common from "./messages/common";
import auth from "./messages/auth";
import home from "./messages/home";
import sessions from "./messages/sessions";
import members from "./messages/members";
import dashboard from "./messages/dashboard";
import athlete from "./messages/athlete";
import profile from "./messages/profile";
import help from "./messages/help";
import danger from "./messages/danger";
import wellness from "./messages/wellness";
import detail from "./messages/detail";
import notify from "./messages/notify";
import strength from "./messages/strength";
import exercises from "./messages/exercises";
import legal from "./messages/legal";
import consent from "./messages/consent";
import workload from "./messages/workload";
import workouts from "./messages/workouts";
import run from "./messages/run";
import kiosk from "./messages/kiosk";
import pins from "./messages/pins";
import review from "./messages/review";
import calendar from "./messages/calendar";
import roles from "./messages/roles";

export type Locale = "nl" | "en";
export const LOCALES: Locale[] = ["nl", "en"];
export const DEFAULT_LOCALE: Locale = "nl";
export const LOCALE_COOKIE = "tw_locale";

const areas = { common, auth, home, sessions, members, dashboard, athlete, profile, help, danger, wellness, detail, notify, strength, exercises, legal, consent, workload, workouts, run, kiosk, pins, review, calendar, roles };
type Areas = typeof areas;

/** "area.key", e.g. "common.save" or "dashboard.tiles.load" */
export type MessageKey = {
  [A in keyof Areas]: `${A & string}.${keyof Areas[A]["nl"] & string}`;
}[keyof Areas];

const flat: Record<Locale, Record<string, string>> = { nl: {}, en: {} };
for (const [area, m] of Object.entries(areas)) {
  for (const loc of LOCALES) {
    for (const [k, v] of Object.entries(m[loc] as Record<string, string>)) flat[loc][`${area}.${k}`] = v;
  }
}

export type Vars = Record<string, string | number>;
export type TFunction = (key: MessageKey, vars?: Vars) => string;

export function makeT(locale: Locale): TFunction {
  return (key, vars) => {
    const raw = flat[locale][key] ?? flat[DEFAULT_LOCALE][key] ?? key;
    return vars ? raw.replace(/\{(\w+)\}/g, (_, n) => String(vars[n] ?? `{${n}}`)) : raw;
  };
}

export const isLocale = (v: unknown): v is Locale => v === "nl" || v === "en";

/** BCP-47 tag for Intl / toLocale*String */
export const dateLocale = (l: Locale) => (l === "nl" ? "nl-NL" : "en-GB");

export const SESSION_TYPE_KEY = {
  academy: "common.sessionType.academy",
  gym: "common.sessionType.gym",
  evening: "common.sessionType.evening",
  match: "common.sessionType.match",
  other: "common.sessionType.other",
} as const satisfies Record<string, MessageKey>;

export const AVAILABILITY_KEY = {
  available: "common.availability.available",
  limited: "common.availability.limited",
  unavailable: "common.availability.unavailable",
} as const satisfies Record<string, MessageKey>;

export const ROLE_KEY = {
  staff: "common.role.staff",
  athlete: "common.role.athlete",
} as const satisfies Record<string, MessageKey>;
