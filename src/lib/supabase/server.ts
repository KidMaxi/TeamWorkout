import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Auth methods that change who the user is (or their profile); they drop the per-client getUser() memo below. */
const AUTH_MUTATORS = [
  "signInWithPassword", "signInWithOtp", "signUp", "signOut", "updateUser", "setSession",
  "refreshSession", "exchangeCodeForSession", "verifyOtp", "resetPasswordForEmail",
] as const;

async function build() {
  const cookieStore = await cookies();
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(list) {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // called from a Server Component; the middleware refreshes the session
          }
        },
      },
    },
  );

  // getUser() is a network round trip to Supabase Auth. Within one request (one client) the answer cannot change
  // unless an auth mutator ran, so layouts, pages and helpers that each ask share a single call.
  const auth = client.auth as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
  const original = auth.getUser.bind(client.auth);
  let memo: Promise<unknown> | null = null;
  auth.getUser = (...args: unknown[]) => {
    if (args.length > 0 && args[0] !== undefined) return original(...args); // explicit JWT: not the session user
    return (memo ??= original());
  };
  for (const name of AUTH_MUTATORS) {
    const fn = auth[name];
    if (typeof fn !== "function") continue;
    const bound = fn.bind(client.auth);
    auth[name] = (...args: unknown[]) => {
      memo = null;
      return bound(...args).finally(() => { memo = null; });
    };
  }
  return client;
}

/**
 * Request-scoped Supabase client: every caller in the same render (layout, page, helpers) gets the same instance,
 * so its getUser() memo is shared. Outside a render (route handlers, actions) it simply builds a client per call.
 */
export const createClient = cache(build);
