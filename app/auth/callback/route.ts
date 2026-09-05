import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createAuthClient } from "../../../lib/supabase/server";
import { safeAuthReturnPath } from "../../../lib/auth-return-path";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeAuthReturnPath(url.searchParams.get("next"));
  const supabase = await createAuthClient();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  let error: Error | null = null;

  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else {
    error = new Error("Missing authentication code");
  }

  if (error) {
    const fallback = new URL(next === "/reset-password" ? "/forgot-password" : "/login", url.origin);
    fallback.searchParams.set("error", next === "/reset-password" ? "expired" : "confirmation");
    return NextResponse.redirect(fallback);
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
