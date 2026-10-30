/**
 * Legal configuration. Fill in the operator details before real users are invited.
 * While `reviewed` is false the legal pages show a "draft" banner. Set it to true only
 * after the texts have been checked by a lawyer / privacy officer.
 */
export const LEGAL = {
  reviewed: false,
  /** Bump when the terms or privacy statement change materially; users are asked to accept again. */
  termsVersion: "2026-10-30",
  operator: {
    name: "",
    address: "",
    postalCode: "",
    city: "",
    country: "Nederland",
    kvk: "",
    email: "",
    website: "https://team-workout-zkzf.vercel.app",
  },
  /** Where people send privacy requests. Falls back to the operator e-mail. */
  privacyEmail: "",
} as const;

export const TERMS_VERSION = LEGAL.termsVersion;
export const NOT_FILLED = "[nog invullen]";
export const filled = (v: string) => (v.trim() ? v : NOT_FILLED);
export const privacyContact = () => filled(LEGAL.privacyEmail || LEGAL.operator.email);
