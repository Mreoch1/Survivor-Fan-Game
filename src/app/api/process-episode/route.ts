import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { processEpisode } from "@/lib/process-episode";
import { NextResponse } from "next/server";

/**
 * After an episode's voted_out_player_id is set (e.g. in Supabase dashboard),
 * call this to apply survival points. Idempotent per episode.
 * Requires auth. Uses service role so all users’ picks/points can be updated.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const episodeId = typeof body.episodeId === "string" ? body.episodeId : null;
  if (!episodeId) {
    return NextResponse.json({ error: "episodeId required" }, { status: 400 });
  }

  try {
    const admin = createServiceRoleClient();
    const result = await processEpisode(admin, episodeId);
    if (!result.ok) {
      const status = result.error === "Episode not found" ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Service role not configured";
    return NextResponse.json(
      { error: "Processing failed. Ensure SUPABASE_SERVICE_ROLE_KEY is set." },
      { status: 503 }
    );
  }
}
