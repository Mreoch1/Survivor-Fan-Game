import { getChatGPTUser } from "../../chatgpt-auth";
import { createAdminClient } from "../../../lib/supabase/admin";
import { validReadThrough } from "../../../lib/notifications";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

async function viewer() {
  const user = await getChatGPTUser();
  if (!user) return null;
  const db = createAdminClient();
  const { data, error } = await db.from("profiles")
    .select("league_joined_at,campfire_read_at").eq("id", user.userId).maybeSingle();
  if (error) throw error;
  return data?.league_joined_at ? { userId: user.userId, readAt: data.campfire_read_at as string | null, db } : null;
}

export async function GET() {
  try {
    const user = await viewer();
    if (!user) return Response.json({ error: "Join the league first" }, { status: 403, headers });
    let posts = user.db.from("posts").select("id", { count: "exact", head: true }).neq("user_id", user.userId);
    if (user.readAt) posts = posts.gt("created_at", user.readAt);
    const [campfire, messages] = await Promise.all([
      posts,
      user.db.from("private_messages").select("id", { count: "exact", head: true })
        .eq("recipient_id", user.userId).is("read_at", null),
    ]);
    if (campfire.error || messages.error) throw campfire.error || messages.error;
    return Response.json({ campfire: campfire.count ?? 0, messages: messages.count ?? 0 }, { headers });
  } catch {
    return Response.json({ error: "Notifications are temporarily unavailable" }, { status: 503, headers });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await viewer();
    if (!user) return Response.json({ error: "Join the league first" }, { status: 403, headers });
    const body = await request.json().catch(() => null);
    if (!validReadThrough(body?.readThrough)) return Response.json({ error: "Invalid read time" }, { status: 400, headers });
    const readThrough = new Date(body.readThrough).toISOString();
    // Older requests from another tab must never move the cursor backwards.
    const { error } = await user.db.from("profiles").update({ campfire_read_at: readThrough })
      .eq("id", user.userId).or(`campfire_read_at.is.null,campfire_read_at.lt.${readThrough}`);
    if (error) throw error;
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json({ error: "Unread status could not be updated" }, { status: 503, headers });
  }
}
