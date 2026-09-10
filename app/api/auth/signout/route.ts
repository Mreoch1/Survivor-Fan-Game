import { NextResponse } from "next/server";
import { createAuthClient } from "../../../../lib/supabase/server";
import { safeAuthReturnPath } from "../../../../lib/auth-return-path";

export async function GET(request: Request) {
  await (await createAuthClient()).auth.signOut({ scope: "local" });
  const url = new URL(request.url);
  const next = safeAuthReturnPath(url.searchParams.get("returnTo") ?? "/");
  return NextResponse.redirect(new URL(next, url.origin));
}
