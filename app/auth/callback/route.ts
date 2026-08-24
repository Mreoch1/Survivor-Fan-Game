import { NextResponse } from "next/server";
import { createAuthClient } from "../../../lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) await (await createAuthClient()).auth.exchangeCodeForSession(code);
  const next = url.searchParams.get("next");
  return NextResponse.redirect(new URL(next?.startsWith("/") && !next.startsWith("//") ? next : "/play", url.origin));
}
