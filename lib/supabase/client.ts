"use client";
import { createBrowserClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import { REMEMBER_COOKIE, REMEMBER_MAX_AGE, sessionCookieOptions } from "./session-cookies";

export function rememberSignIn(remembered: boolean) {
  document.cookie = serializeCookieHeader(REMEMBER_COOKIE, String(remembered), {
    path: "/", sameSite: "lax", maxAge: REMEMBER_MAX_AGE,
    secure: window.location.protocol === "https:",
  });
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => parseCookieHeader(document.cookie).map(({ name, value }) => ({ name, value: value ?? "" })),
        setAll(values) {
          const remembered = !parseCookieHeader(document.cookie).some(cookie => cookie.name === REMEMBER_COOKIE && cookie.value === "false");
          values.forEach(({ name, value, options }) => {
            document.cookie = serializeCookieHeader(name, value, {
              ...sessionCookieOptions(options, remembered), secure: window.location.protocol === "https:",
            });
          });
        },
      },
    },
  );
}
