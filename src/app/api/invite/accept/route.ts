import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const { data: accepted, error } = await supabase.rpc("accept_invite", {
    invite_token: token,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (accepted === false) {
    return NextResponse.json({ error: "Invalid invite" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
