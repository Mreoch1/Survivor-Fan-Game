import { NextResponse } from "next/server";

/**
 * Validates game code for signup. If GAME_CODE is set in env, code must match.
 * Do not expose the actual code to the client.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const required = process.env.GAME_CODE;
  if (required) {
    if (code !== required) {
      return NextResponse.json({ valid: false, error: "Invalid game code" }, { status: 400 });
    }
  }
  return NextResponse.json({ valid: true });
}
