import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const inviteToken = searchParams.get("invite");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
    }
    const redirectUrl = inviteToken
      ? `${origin}/invite/accept?token=${encodeURIComponent(inviteToken)}`
      : next;
    return NextResponse.redirect(`${origin}${redirectUrl}`);
  }

  return NextResponse.redirect(`${origin}/login?error=no_code`);
}
