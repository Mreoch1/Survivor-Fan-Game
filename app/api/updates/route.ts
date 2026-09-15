import { getChatGPTUser } from "../../chatgpt-auth";
import { createAdminClient } from "../../../lib/supabase/admin";
import { pendingUpdates, validAcknowledgementIds } from "../../../lib/league-updates";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "Sign in to see league updates" }, { status: 401, headers });
    const { data, error } = await createAdminClient().from("league_update_acknowledgements")
      .select("update_id").eq("user_id", user.userId);
    if (error) throw error;
    return Response.json({ updates: pendingUpdates((data || []).map(row => row.update_id)) }, { headers });
  } catch {
    return Response.json({ error: "Updates could not load. Please try again." }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "Sign in to confirm these updates" }, { status: 401, headers });
    // Reject cross-site submissions and simple HTML form requests.
    if (request.headers.get("sec-fetch-site") === "cross-site" ||
        request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      return Response.json({ error: "Open the league to confirm these updates" }, { status: 403, headers });
    }
    const body = await request.json().catch(() => null);
    if (!validAcknowledgementIds(body?.updateIds)) {
      return Response.json({ error: "Refresh the page to see the latest updates" }, { status: 400, headers });
    }
    // Use the verified account, never a client-supplied user ID or timestamp.
    // Ignore duplicate receipts so retries preserve the first acknowledgement.
    const { error } = await createAdminClient().from("league_update_acknowledgements").upsert(
      body.updateIds.map((updateId: string) => ({ user_id: user.userId, update_id: updateId })),
      { onConflict: "user_id,update_id", ignoreDuplicates: true },
    );
    if (error) throw error;
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json({ error: "Your confirmation was not saved. Please try again." }, { status: 503, headers });
  }
}
