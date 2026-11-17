/** Pure helpers for the parent role (no imports from other lib files: node's test runner runs this file directly). */

/** First name of a full name; "" when empty. */
export const firstName = (name: string | null | undefined): string => (name ?? "").trim().split(/\s+/)[0] ?? "";

/** Dutch possessive of a first name: "Noah" -> "Noahs", "Max" -> "Max'", "Lars" -> "Lars'". */
export function genitiveNl(name: string): string {
  const n = name.trim();
  if (!n) return n;
  return /[sxz]$/i.test(n) ? `${n}'` : `${n}s`;
}

/** English possessive: "Noah" -> "Noah's", "James" -> "James's". */
export const genitiveEn = (name: string): string => (name.trim() ? `${name.trim()}'s` : name.trim());

/** Possessive of the child's first name for the given locale. */
export function possessive(fullName: string | null | undefined, locale: "nl" | "en"): string {
  const f = firstName(fullName);
  return locale === "nl" ? genitiveNl(f) : genitiveEn(f);
}

/** ?child must be one of the linked child ids; otherwise the first child (or null when there are none). */
export function pickChild<T extends { id: string }>(children: readonly T[], param: unknown): T | null {
  const v = Array.isArray(param) ? param[0] : param;
  return children.find((c) => c.id === v) ?? children[0] ?? null;
}

export const PARENT_CODE_LENGTH = 10;

/** Join code as typed: trimmed, spaces/dashes removed, uppercase, at most 10 characters. */
export const normalizeCode = (raw: unknown): string =>
  String(raw ?? "").replace(/[\s-]+/g, "").toUpperCase().slice(0, PARENT_CODE_LENGTH);

/** A plausible code: exactly 10 letters or digits. The database decides whether it is valid. */
export const isCodeShape = (code: string): boolean => new RegExp(`^[A-Z0-9]{${PARENT_CODE_LENGTH}}$`).test(code);
