import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, makeT, type Locale, type TFunction } from ".";

/** Cookie wins; otherwise the signed-in user's profile setting; otherwise Dutch. */
export async function getLocale(): Promise<Locale> {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("profiles").select("locale").eq("id", user.id).single();
      if (isLocale(data?.locale)) return data.locale;
    }
  } catch {
    // fall through to the default
  }
  return DEFAULT_LOCALE;
}

export async function getT(): Promise<{ t: TFunction; locale: Locale }> {
  const locale = await getLocale();
  return { t: makeT(locale), locale };
}
