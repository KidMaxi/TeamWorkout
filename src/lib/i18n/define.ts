/** Both languages must define exactly the same keys; the compiler enforces it. */
export function defineMessages<T extends Record<string, string>>(
  nl: T,
  en: Record<keyof T, string>,
) {
  return { nl, en } as const;
}
