/** Basketball positions a trainer can assign to an athlete (mirrors the check constraint on team_members.position). */
export const POSITIONS = ["point_guard", "shooting_guard", "small_forward", "power_forward", "center"] as const;
export type Position = (typeof POSITIONS)[number];
export const isPosition = (v: unknown): v is Position => typeof v === "string" && (POSITIONS as readonly string[]).includes(v);

/** Shirt number: integer 0-99. */
export const isJersey = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 99;

/** '#7 · Point guard', '#7', 'Point guard' or '' depending on what is set. `positionLabel` is the translated label. */
export function playerLabel(jersey: number | null | undefined, positionLabel: string | null | undefined): string {
  return [jersey == null ? null : `#${jersey}`, positionLabel || null].filter(Boolean).join(" · ");
}

/** Sort by shirt number (no number last), then name. */
export function byJerseyThenName<T extends { jersey: number | null; name: string }>(a: T, b: T): number {
  if (a.jersey !== b.jersey) {
    if (a.jersey == null) return 1;
    if (b.jersey == null) return -1;
    return a.jersey - b.jersey;
  }
  return a.name.localeCompare(b.name);
}
