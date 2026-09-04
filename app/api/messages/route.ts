import { getChatGPTUser } from "../../chatgpt-auth";
import { createAdminClient } from "../../../lib/supabase/admin";
import { ensureDatabase } from "../../../db/runtime";

type MemberRow = { id: string; display_name: string; team_name: string; avatar_key: string };
type MessageRow = {
  id: number;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function memberName(member: MemberRow) {
  return member.team_name || member.display_name || "Player";
}

export async function GET(request: Request) {
  const user = await joinedUser();
  if (!user) return Response.json({ error: "Join the league first" }, { status: 403 });
  await ensureDatabase();
  const db = createAdminClient();
  const selectedId = new URL(request.url).searchParams.get("with") || "";
  const [{ data: memberRows, error: memberError }, { data: recentRows, error: recentError }] = await Promise.all([
    db
      .from("profiles")
      .select("id,display_name,team_name,avatar_key")
      .not("league_joined_at", "is", null)
      .order("display_name"),
    db
      .from("private_messages")
      .select("id,sender_id,recipient_id,body,read_at,created_at")
      .or(`sender_id.eq.${user.userId},recipient_id.eq.${user.userId}`)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);
  if (memberError || recentError) {
    return Response.json({ error: "Private Messages could not load" }, { status: 500 });
  }

  const members = (memberRows || []) as MemberRow[];
  const memberMap = new Map(members.map((member) => [member.id, member]));
  const otherMembers = members.filter((member) => member.id !== user.userId);
  if (selectedId && (selectedId === user.userId || !memberMap.has(selectedId))) {
    return Response.json({ error: "That league member is not available" }, { status: 404 });
  }

  const conversationMap = new Map<string, { latest: MessageRow; unread: number }>();
  for (const message of (recentRows || []) as MessageRow[]) {
    const otherId = message.sender_id === user.userId ? message.recipient_id : message.sender_id;
    const existing = conversationMap.get(otherId);
    if (!existing) conversationMap.set(otherId, { latest: message, unread: 0 });
    if (message.recipient_id === user.userId && !message.read_at) {
      const summary = conversationMap.get(otherId);
      if (summary) summary.unread += 1;
    }
  }

  let selectedMessages: MessageRow[] = [];
  if (selectedId) {
    const { data, error } = await db
      .from("private_messages")
      .select("id,sender_id,recipient_id,body,read_at,created_at")
      .or(
        `and(sender_id.eq.${user.userId},recipient_id.eq.${selectedId}),and(sender_id.eq.${selectedId},recipient_id.eq.${user.userId})`,
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return Response.json({ error: "That conversation could not load" }, { status: 500 });
    selectedMessages = ((data || []) as MessageRow[]).reverse();
  }

  const conversations = [...conversationMap.entries()]
    .map(([otherId, summary]) => {
      const member = memberMap.get(otherId);
      if (!member) return null;
      return {
        otherId,
        name: memberName(member),
        displayName: member.display_name,
        avatarKey: member.avatar_key,
        latestBody: summary.latest.body,
        latestAt: summary.latest.created_at,
        unread: summary.unread,
      };
    })
    .filter(Boolean);

  return Response.json({
    currentUserId: user.userId,
    members: otherMembers.map((member) => ({
      id: member.id,
      name: memberName(member),
      displayName: member.display_name,
      avatarKey: member.avatar_key,
    })),
    conversations,
    selectedMember: selectedId
      ? (() => {
          const member = memberMap.get(selectedId)!;
          return { id: member.id, name: memberName(member), displayName: member.display_name, avatarKey: member.avatar_key };
        })()
      : null,
    messages: selectedMessages.map((message) => ({
      id: message.id,
      senderId: message.sender_id,
      body: message.body,
      readAt: message.read_at,
      createdAt: message.created_at,
    })),
  });
}

export async function POST(request: Request) {
  const user = await joinedUser();
  if (!user) return Response.json({ error: "Join the league first" }, { status: 403 });
  await ensureDatabase();
  const body = (await request.json().catch(() => null)) as { recipientId?: unknown; body?: unknown } | null;
  const recipientId = typeof body?.recipientId === "string" ? body.recipientId : "";
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!UUID_PATTERN.test(recipientId) || recipientId === user.userId) {
    return Response.json({ error: "Choose another league member" }, { status: 400 });
  }
  if (!text) return Response.json({ error: "Write a private message first" }, { status: 400 });
  if (text.length > 1000) return Response.json({ error: "Private messages must be 1,000 characters or fewer" }, { status: 400 });

  const db = createAdminClient();
  const { data: recipient } = await db
    .from("profiles")
    .select("id")
    .eq("id", recipientId)
    .not("league_joined_at", "is", null)
    .maybeSingle();
  if (!recipient) return Response.json({ error: "That league member is not available" }, { status: 404 });

  const createdAt = new Date().toISOString();
  const { data: message, error } = await db
    .from("private_messages")
    .insert({ sender_id: user.userId, recipient_id: recipientId, body: text, created_at: createdAt })
    .select("id")
    .single();
  return error
    ? Response.json({ error: "Your private message could not be sent" }, { status: 500 })
    : Response.json({ ok: true, id: message.id, createdAt });
}

export async function PUT(request: Request) {
  const user = await joinedUser();
  if (!user) return Response.json({ error: "Join the league first" }, { status: 403 });
  await ensureDatabase();
  const body = (await request.json().catch(() => null)) as { withUserId?: unknown } | null;
  const withUserId = typeof body?.withUserId === "string" ? body.withUserId : "";
  if (!UUID_PATTERN.test(withUserId) || withUserId === user.userId) {
    return Response.json({ error: "Choose a conversation" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: member } = await db
    .from("profiles")
    .select("id")
    .eq("id", withUserId)
    .not("league_joined_at", "is", null)
    .maybeSingle();
  if (!member) return Response.json({ error: "That league member is not available" }, { status: 404 });

  const readAt = new Date().toISOString();
  const { error } = await db
    .from("private_messages")
    .update({ read_at: readAt })
    .eq("sender_id", withUserId)
    .eq("recipient_id", user.userId)
    .is("read_at", null);
  return error
    ? Response.json({ error: "Messages could not be marked as read" }, { status: 500 })
    : Response.json({ ok: true, readAt });
}
