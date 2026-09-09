import { getChatGPTUser } from "../../chatgpt-auth";
import { isProfileIconKey } from "../../profile-icons";
import { createAdminClient } from "../../../lib/supabase/admin";
import { isTeamNameConflict, normalizeTeamName, TEAM_NAME_TAKEN } from "../../../lib/team-name";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { data, error } = await createAdminClient().from("profiles").select("display_name,team_name,avatar_key,updated_at").eq("id", user.userId).maybeSingle();
  if (error) return Response.json({ error: "Your profile could not be loaded" }, { status: 500 });
  if (!data) return Response.json({ error: "Your player profile was not found" }, { status: 404 });
  return Response.json({ profile: { displayName: data.display_name, teamName: data.team_name, avatarKey: data.avatar_key, updatedAt: data.updated_at, email: user.email } });
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { displayName?: unknown; teamName?: unknown; avatarKey?: unknown } | null;
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  const teamName = normalizeTeamName(body?.teamName);
  if (!displayName) return Response.json({ error: "Your player name is required" }, { status: 400 });
  if (displayName.length > 40) return Response.json({ error: "Player name must be 40 characters or fewer" }, { status: 400 });
  if (teamName.length > 50) return Response.json({ error: "Team name must be 50 characters or fewer" }, { status: 400 });
  if (!isProfileIconKey(body?.avatarKey)) return Response.json({ error: "Choose one of the available player icons" }, { status: 400 });
  const updatedAt = new Date().toISOString();
  const { data, error } = await createAdminClient().from("profiles").update({ display_name: displayName, team_name: teamName, avatar_key: body.avatarKey, updated_at: updatedAt }).eq("id", user.userId).select("display_name,team_name,avatar_key,updated_at").maybeSingle();
  if (isTeamNameConflict(error)) return Response.json({ error: TEAM_NAME_TAKEN }, { status: 409 });
  if (error) return Response.json({ error: "Your profile was not saved" }, { status: 500 });
  if (!data) return Response.json({ error: "Your player profile was not found" }, { status: 404 });
  return Response.json({ ok: true, profile: { displayName: data.display_name, teamName: data.team_name, avatarKey: data.avatar_key, updatedAt: data.updated_at, email: user.email } });
}
