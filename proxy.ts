import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { REMEMBER_COOKIE, sessionCookieOptions } from "./lib/supabase/session-cookies";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;
  const supabase = createServerClient(url, key, {
    cookieOptions: { secure: request.nextUrl.protocol === "https:" },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        // Forward refreshed tokens to this request as well as the browser.
        // Otherwise the page can try to reuse the old refresh token.
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value,
          sessionCookieOptions(options, request.cookies.get(REMEMBER_COOKIE)?.value !== "false")));
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
