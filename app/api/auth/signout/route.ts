import { NextResponse } from "next/server";
import { createAuthClient } from "../../../../lib/supabase/server";

export async function GET(request: Request) {
  await (await createAuthClient()).auth.signOut();
  const url = new URL(request.url);
  const next = url.searchParams.get("returnTo");
  return NextResponse.redirect(new URL(next?.startsWith("/") && !next.startsWith("//") ? next : "/", url.origin));
}
