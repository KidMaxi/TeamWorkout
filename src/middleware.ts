import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Offline end-to-end harness: only reachable when E2E_HARNESS=1 (never set in production).
  if (process.env.E2E_HARNESS === "1" && /^\/(api\/)?e2e\//.test(request.nextUrl.pathname)) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  // getClaims() verifies the session JWT locally when the project signs with asymmetric keys (no round trip to Supabase Auth)
  // and refreshes a token that is about to expire; with a symmetric secret the library itself falls back to a getUser() call.
  const { data: auth } = await supabase.auth.getClaims();
  const signedIn = !!auth?.claims;
  if (!signedIn && !request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|api/cron|privacy|terms|cookies|icon.svg|apple-icon.png|opengraph-image.png|icons/).*)"],
};
