import type { CookieOptions } from "@supabase/ssr";

export const REMEMBER_COOKIE = "outlast-remember";
export const REMEMBER_MAX_AGE = 90 * 24 * 60 * 60;

// Apply at the cookie writer: @supabase/ssr overrides cookieOptions.maxAge.
// Both browser and server refreshes must preserve the same preference.
export function sessionCookieOptions(options: CookieOptions, remembered: boolean): CookieOptions {
  if (options.maxAge === 0) return options;
  const result = { ...options, path: "/", sameSite: "lax" as const };
  delete result.expires;
  if (remembered) result.maxAge = REMEMBER_MAX_AGE;
  else delete result.maxAge;
  return result;
}
