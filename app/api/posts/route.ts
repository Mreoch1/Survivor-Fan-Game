import { getChatGPTUser } from "../../chatgpt-auth";
import { createAdminClient } from "../../../lib/supabase/admin";
import { buildCampfireThreads, type CampfirePostRow } from "../../../lib/community";
import { ensureDatabase, publishDueResults } from "../../../db/runtime";

async function spoilerWindow() {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const { data } = await db
    .from("episodes")
    .select("reveal_at")
    .lte("air_at", now)
    .gt("reveal_at", now)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function joinedUser() {
  const user = await getChatGPTUser();
  if (!user) return null;
  const { data } = await createAdminClient()
    .from("profiles")
    .select("league_joined_at")
    .eq("id", user.userId)
    .maybeSingle();
  return data?.league_joined_at ? user : null;
}

export async function GET() {
  const readThrough = new Date().toISOString();
  const user = await joinedUser();
  if (!user) return Response.json({ error: "Join the league first" }, { status: 403 });
  await ensureDatabase();
  await publishDueResults();
  const db = createAdminClient();
  const locked = await spoilerWindow();
  const { data: roots, error: rootError } = await db
    .from("posts")
    .select("id,body,created_at,user_id,parent_post_id")
    .is("parent_post_id", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (rootError) return Response.json({ error: "Campfire unavailable" }, { status: 500 });

  const rootIds = (roots || []).map((post) => post.id);
  const { data: replies, error: replyError } = rootIds.length
    ? await db
        .from("posts")
        .select("id,body,created_at,user_id,parent_post_id")
        .in("parent_post_id", rootIds)
        .order("created_at")
        .limit(1000)
    : { data: [], error: null };
  if (replyError) return Response.json({ error: "Campfire replies could not load" }, { status: 500 });

  const posts = [...(roots || []), ...(replies || [])] as CampfirePostRow[];
  const authorIds = [...new Set(posts.map((post) => post.user_id))];
  const [{ data: profiles, error: profileError }, { data: votes, error: voteError }] = await Promise.all([
    authorIds.length
      ? db.from("profiles").select("id,display_name,team_name,avatar_key").in("id", authorIds)
      : Promise.resolve({ data: [], error: null }),
    rootIds.length
      ? db.from("post_votes").select("post_id,user_id,vote").in("post_id", rootIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profileError || voteError) return Response.json({ error: "Campfire unavailable" }, { status: 500 });

  return Response.json({
    threads: buildCampfireThreads(posts, votes || [], profiles || [], user.userId),
    locked: Boolean(locked),
    revealAt: locked?.reveal_at || null,
    readThrough,
  });
}

export async function POST(request: Request) {
  const user = await joinedUser();
  if (!user) return Response.json({ error: "Join the league first" }, { status: 403 });
  await ensureDatabase();
  await publishDueResults();
  const locked = await spoilerWindow();
  if (locked) {
    return Response.json(
      { error: "Campfire posting reopens after the 9:00 AM spoiler reveal", revealAt: locked.reveal_at },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => null)) as { body?: unknown; parentPostId?: unknown } | null;
  const text = typeof body?.body === "string" ? body.body.trim().slice(0, 500) : "";
  if (!text) return Response.json({ error: "Bring an idea or reply to the fire first" }, { status: 400 });

  const db = createAdminClient();
  let parentPostId: number | null = null;
  if (body?.parentPostId !== undefined && body.parentPostId !== null) {
    parentPostId = Number(body.parentPostId);
    if (!Number.isInteger(parentPostId) || parentPostId <= 0) {
      return Response.json({ error: "That Campfire idea is not available" }, { status: 400 });
    }
    const { data: parent } = await db
      .from("posts")
      .select("id,parent_post_id")
      .eq("id", parentPostId)
      .maybeSingle();
    if (!parent || parent.parent_post_id !== null) {
      return Response.json({ error: "Replies must stay under a main Campfire idea" }, { status: 400 });
    }
  }

  const { error } = await db.from("posts").insert({
    user_id: user.userId,
    body: text,
    parent_post_id: parentPostId,
    created_at: new Date().toISOString(),
  });
  return error
    ? Response.json({ error: parentPostId ? "That reply could not be posted" : "That idea could not be posted" }, { status: 500 })
    : Response.json({ ok: true, kind: parentPostId ? "reply" : "idea" });
}

export async function PUT(request: Request) {
  const user = await joinedUser();
  if (!user) return Response.json({ error: "Join the league first" }, { status: 403 });
  await ensureDatabase();
  await publishDueResults();
  const locked = await spoilerWindow();
  if (locked) {
    return Response.json(
      { error: "Campfire voting reopens after the 9:00 AM spoiler reveal", revealAt: locked.reveal_at },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => null)) as { postId?: unknown; vote?: unknown } | null;
  const postId = Number(body?.postId);
  const vote = Number(body?.vote);
  if (!Number.isInteger(postId) || ![0, 1, -1].includes(vote)) {
    return Response.json({ error: "Choose an upvote or downvote" }, { status: 400 });
  }
  const db = createAdminClient();
  const { data: post } = await db.from("posts").select("id,parent_post_id").eq("id", postId).maybeSingle();
  if (!post) return Response.json({ error: "That Campfire idea is no longer available" }, { status: 404 });
  if (post.parent_post_id !== null) {
    return Response.json({ error: "Vote on the main idea instead of its replies" }, { status: 400 });
  }

  const now = new Date().toISOString();
  if (vote === 0) {
    const { error } = await db.from("post_votes").delete().eq("post_id", postId).eq("user_id", user.userId);
    return error
      ? Response.json({ error: "Your vote could not be removed" }, { status: 500 })
      : Response.json({ ok: true, vote: 0, updatedAt: now });
  }
  const { error } = await db
    .from("post_votes")
    .upsert({ post_id: postId, user_id: user.userId, vote, updated_at: now }, { onConflict: "post_id,user_id" });
  return error
    ? Response.json({ error: "Your vote could not be counted" }, { status: 500 })
    : Response.json({ ok: true, vote, updatedAt: now });
}
