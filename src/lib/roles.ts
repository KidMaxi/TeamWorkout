/**
 * Staff roles within a team. The database enforces these rules (RLS); this file only mirrors them
 * so the UI can show the right controls. Athletes have no staff kind (null).
 */
export const STAFF_KINDS = ["head", "sc", "basketball", "medical"] as const;
export type StaffKind = (typeof STAFF_KINDS)[number];
export const isStaffKind = (v: unknown): v is StaffKind => typeof v === "string" && (STAFF_KINDS as readonly string[]).includes(v);

export type Capability =
  | "planGym"          // plan/edit/cancel gym sessions
  | "planCourt"        // plan/edit/cancel academy, evening, match and other sessions
  | "manageLibrary"    // exercises, workouts, 5RM tests, iPad mode, PINs, coach review of runs
  | "planRules"        // weekly rules, limits, taking an athlete out of a session, enter logs
  | "writeNotes"       // workload notes, follow-up notes
  | "setAvailability"
  | "viewHealth"       // read check-ins/pain (still only with the athlete's consent)
  | "manageMembers"    // invites, kinds, removing members, recording parental consent
  | "manageTeam"       // team settings, workload thresholds, deleting the team (owner)
  ;

const MATRIX: Record<StaffKind, ReadonlySet<Capability>> = {
  head: new Set<Capability>(["planGym", "planCourt", "manageLibrary", "planRules", "writeNotes", "setAvailability", "viewHealth", "manageMembers", "manageTeam"]),
  sc: new Set<Capability>(["planGym", "manageLibrary", "planRules", "writeNotes", "setAvailability", "viewHealth"]),
  basketball: new Set<Capability>(["planCourt", "planRules", "writeNotes", "setAvailability", "viewHealth"]),
  medical: new Set<Capability>(["writeNotes", "setAvailability", "viewHealth"]),
};

export function can(kind: StaffKind | null | undefined, capability: Capability): boolean {
  return kind ? MATRIX[kind].has(capability) : false;
}

/** May this kind plan a session of the given type? (gym vs everything else) */
export function canPlanType(kind: StaffKind | null | undefined, type: string): boolean {
  return can(kind, type === "gym" ? "planGym" : "planCourt");
}

/** The caller's staff kind in a team, or null when not staff of it. Pass an RLS-scoped server client. */
export async function getStaffKind(
  supabase: { from: (t: string) => any }, // eslint-disable-line @typescript-eslint/no-explicit-any
  teamId: string,
  userId: string,
): Promise<StaffKind | null> {
  const { data } = await supabase
    .from("team_members").select("role, staff_kind").eq("team_id", teamId).eq("user_id", userId).maybeSingle();
  if (data?.role !== "staff") return null;
  return isStaffKind(data.staff_kind) ? data.staff_kind : "head"; // legacy rows without a kind behave as before
}
