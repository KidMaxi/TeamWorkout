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
  | "manageTeam"       // team settings, workload thresholds, deleting the team (owner: the DB only lets the creating head delete it)
  ;

const MATRIX: Record<StaffKind, ReadonlySet<Capability>> = {
  head: new Set<Capability>(["planGym", "planCourt", "manageLibrary", "planRules", "writeNotes", "setAvailability", "viewHealth", "manageMembers", "manageTeam"]),
  sc: new Set<Capability>(["planGym", "manageLibrary", "planRules", "writeNotes", "setAvailability", "viewHealth"]),
  basketball: new Set<Capability>(["planCourt", "planRules", "writeNotes", "setAvailability", "viewHealth"]),
  medical: new Set<Capability>(["writeNotes", "setAvailability", "viewHealth"]),
};

/** One kind, several kinds (a person can hold more than one role), or none. Capabilities are the union. */
export type KindsInput = StaffKind | readonly StaffKind[] | null | undefined;

const asList = (k: KindsInput): readonly StaffKind[] => (k == null ? [] : typeof k === "string" ? [k] : k);

export function can(kindOrKinds: KindsInput, capability: Capability): boolean {
  return asList(kindOrKinds).some((k) => MATRIX[k].has(capability));
}

/** May these kinds plan a session of the given type? (gym vs everything else) */
export function canPlanType(kindOrKinds: KindsInput, type: string): boolean {
  return can(kindOrKinds, type === "gym" ? "planGym" : "planCourt");
}

/** Additional roles a person can hold next to the primary one ('head' is never an extra). */
export const EXTRA_KINDS = ["sc", "basketball", "medical"] as const satisfies readonly StaffKind[];

/**
 * All kinds from a team_members row: primary first, then the extras (de-duplicated, invalid values dropped,
 * never 'head', never the primary). Athletes -> []. Legacy staff rows without a kind count as 'head'.
 */
export function kindsFromRow(row: { role?: unknown; staff_kind?: unknown; extra_kinds?: unknown } | null | undefined): StaffKind[] {
  if (row?.role !== "staff") return [];
  const primary: StaffKind = isStaffKind(row.staff_kind) ? row.staff_kind : "head";
  const extras = Array.isArray(row.extra_kinds) ? row.extra_kinds : [];
  const out: StaffKind[] = [primary];
  for (const k of extras) if (isStaffKind(k) && k !== "head" && !out.includes(k)) out.push(k);
  return out;
}

type Db = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

/** All staff kinds (primary first) of a user in a team; [] when not staff of it. Pass an RLS-scoped server client. */
export async function getStaffKinds(supabase: Db, teamId: string, userId: string): Promise<StaffKind[]> {
  const { data } = await supabase
    .from("team_members").select("role, staff_kind, extra_kinds").eq("team_id", teamId).eq("user_id", userId).maybeSingle();
  return kindsFromRow(data);
}

/** The primary staff kind in a team, or null when not staff of it. Prefer getStaffKinds for authorisation. */
export async function getStaffKind(supabase: Db, teamId: string, userId: string): Promise<StaffKind | null> {
  return (await getStaffKinds(supabase, teamId, userId))[0] ?? null;
}
