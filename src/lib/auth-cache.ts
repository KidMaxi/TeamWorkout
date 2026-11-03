import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, makeT, type Locale, type TFunction } from "@/lib/i18n";
import { isStaffKind, type StaffKind } from "@/lib/roles";

/**
 * Request-scoped (React cache) lookups shared by layouts and pages, so the same fact is fetched once per request.
 * Only call these while rendering (never from a server action that mutates what they read).
 */

export type AuthUser = { id: string; email: string | undefined };

/**
 * The signed-in user. Uses getClaims(): with asymmetric JWT signing keys the token is verified locally (no round trip);
 * with a symmetric secret the library itself falls back to a getUser() call, so correctness is unchanged.
 * The middleware has already refreshed and verified the session for page requests.
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : undefined };
});

export type Membership = { role: "staff" | "athlete"; staffKind: StaffKind | null };

/** The user's role (and staff kind; legacy staff rows without a kind count as head) in a team, or null. */
export const getMembership = cache(async (teamId: string, userId: string): Promise<Membership | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("team_members").select("role, staff_kind").eq("team_id", teamId).eq("user_id", userId).maybeSingle();
  if (!data) return null;
  if (data.role !== "staff") return { role: data.role as "athlete", staffKind: null };
  return { role: "staff", staffKind: isStaffKind(data.staff_kind) ? data.staff_kind : "head" };
});

/** Profile columns the shell needs; one query per request, only the columns asked for by the first caller set. */
export const getProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("full_name, locale, terms_version").eq("id", userId).maybeSingle();
  return data;
});

/** Cookie wins; otherwise the profile setting; otherwise Dutch. Resolved once per request. */
export const getLocale = cache(async (): Promise<Locale> => {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  try {
    const user = await getAuthUser();
    if (user) {
      const p = await getProfile(user.id);
      if (isLocale(p?.locale)) return p.locale;
    }
  } catch {
    // fall through to the default
  }
  return DEFAULT_LOCALE;
});

export const getT = cache(async (): Promise<{ t: TFunction; locale: Locale }> => {
  const locale = await getLocale();
  return { t: makeT(locale), locale };
});
