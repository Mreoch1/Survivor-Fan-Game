import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { processEpisode } from "@/lib/process-episode";

const SEASON = 50;

/**
 * Cron: process all Season 50 episodes that have voted_out_player_id set
 * and are not yet in episode_points_processed. Run weekly (e.g. Friday 9 AM ET).
 * Secured by CRON_SECRET (Vercel sends it in Authorization when invoking the cron).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not set" },
      { status: 503 }
    );
  }

  const { data: processed } = await supabase
    .from("episode_points_processed")
    .select("episode_id");
  const rows = (processed ?? []) as { episode_id: string }[];
  const processedIds = new Set(rows.map((r) => r.episode_id));

  const { data: episodes, error: epErr } = await supabase
    .from("episodes")
    .select("id, episode_number")
    .eq("season", SEASON)
    .not("voted_out_player_id", "is", null)
    .order("episode_number", { ascending: true });

  if (epErr) {
    return NextResponse.json({ error: epErr.message }, { status: 500 });
  }

  const episodeRows = (episodes ?? []) as { id: string; episode_number: number }[];
  const pending = episodeRows.filter((ep) => !processedIds.has(ep.id));
  const results: { episodeId: string; episodeNumber: number; ok: boolean; error?: string }[] = [];

  for (const ep of pending) {
    const result = await processEpisode(supabase, ep.id);
    results.push({
      episodeId: ep.id,
      episodeNumber: ep.episode_number,
      ok: result.ok,
      ...(result.ok ? {} : { error: result.error }),
    });
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    results,
  });
}
